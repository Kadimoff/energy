import { baseConfig, type AppConfig } from '../config';
import type { DayInfo, DayType, EnergyDataset, HourlySeries, ImplementedMeasure } from '../types';
import { gauss } from './random';
import { MEASURE_TRUTH, SCENARIOS, scenarioById } from './scenarios';

/**
 * Deterministic mock generator for the fictional "Nümunə Polimer Zavodu"
 * (Sumqayıt climate). 13 calendar months of hourly data per equipment, ending
 * at `now`; temperature forecast and production plan until month end.
 *
 * Noise is keyed by absolute hour, so history does not change between loads.
 * Waste scenarios (spec 9.4) are placed relative to today's date so the demo
 * always shows a "current" situation.
 */

export interface GenerateOptions {
  now?: number | Date;
  seed?: number;
  config?: AppConfig;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOMINAL_RATE_T_PER_H = 3.2;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
export const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / DAY,
  );
}

/** Sumqayıt seasonal mean temperature (°C) for a day of year. */
export function seasonalTemp(doy: number): number {
  return 15.7 - 10.9 * Math.cos((2 * Math.PI * (doy - 20)) / 365.25);
}

function sunTimes(doy: number): { rise: number; set: number } {
  const c = Math.cos((2 * Math.PI * (doy + 10)) / 365.25);
  return { rise: 6.4 + 1.4 * c, set: 18.7 - 1.65 * c };
}

// numeric load-model kinds (switching on numbers keeps the hot loop fast)
const K_EXT = 1;
const K_IM = 2;
const K_COMP1 = 3;
const K_COMP2 = 4;
const K_COMP3 = 5;
const K_CHILLER = 6;
const K_CT = 7;
const K_AHU_SHOP = 8;
const K_AHU_WH = 9;
const K_LIGHT_SHOP = 10;
const K_LIGHT_WH = 11;
const K_LIGHT_SITE = 12;
const K_OFFICE = 13;
const K_BOILER = 14;
const KINDS: Record<string, number> = {
  'ext-1': K_EXT,
  'ext-2': K_EXT,
  'ext-3': K_EXT,
  'ext-4': K_EXT,
  'im-1': K_IM,
  'im-2': K_IM,
  'im-3': K_IM,
  'comp-1': K_COMP1,
  'comp-2': K_COMP2,
  'comp-3': K_COMP3,
  'chiller-1': K_CHILLER,
  'chiller-2': K_CHILLER,
  'ct-pumps': K_CT,
  'ahu-shop': K_AHU_SHOP,
  'ahu-wh': K_AHU_WH,
  'light-shop': K_LIGHT_SHOP,
  'light-wh': K_LIGHT_WH,
  'light-site': K_LIGHT_SITE,
  office: K_OFFICE,
  boiler: K_BOILER,
};

export function generateDataset(opts: GenerateOptions = {}): EnergyDataset {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cfg = opts.config ?? baseConfig;
  const seed = opts.seed ?? 2026;
  const nowMs = opts.now instanceof Date ? opts.now.getTime() : (opts.now ?? Date.now());
  const now = new Date(nowMs);
  const first = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  // forecast horizon: end of next month (covers month-end, next-month and quarter-end views)
  const end = new Date(
    now.getFullYear(),
    Math.max(now.getMonth() + 2, Math.floor(now.getMonth() / 3) * 3 + 3),
    1,
  );
  const startMs = first.getTime();
  const hours = Math.round((end.getTime() - startMs) / HOUR);
  const nowIndex = Math.min(hours, Math.floor((nowMs - startMs) / HOUR));

  const holidays = new Set(cfg.plant.holidays);
  const sched = cfg.plant.schedule;

  // ---------- timeline + days ----------
  const hourStarts = new Float64Array(hours);
  const hourOfDay = new Uint8Array(hours);
  const weekday = new Uint8Array(hours);
  const dayIndex = new Uint16Array(hours);
  const days: DayInfo[] = [];
  let prevDate = -1;
  for (let i = 0; i < hours; i++) {
    const t = startMs + i * HOUR;
    const d = new Date(t);
    hourStarts[i] = t;
    hourOfDay[i] = d.getHours();
    const wd = (d.getDay() + 6) % 7;
    weekday[i] = wd;
    if (d.getDate() !== prevDate) {
      prevDate = d.getDate();
      const key = dayKeyOf(d);
      if (days.length) days[days.length - 1].endIndex = i;
      const dayType: DayType = holidays.has(key)
        ? 'holiday'
        : wd === 6
          ? 'sunday'
          : wd === 5
            ? 'saturday'
            : 'workday';
      const s =
        dayType === 'workday'
          ? sched.weekday
          : dayType === 'saturday'
            ? sched.saturday
            : sched.sunday;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      days.push({
        key,
        start: dayStart,
        startIndex: i,
        endIndex: i,
        dayType,
        weekday: wd,
        tons: 0,
        plannedTons: 0,
        productionHours: s.shifts > 0 ? s.end - s.start : 0,
        meanTempC: 0,
        isFuture: dayStart > nowMs,
        isToday: false,
      });
    }
    dayIndex[i] = days.length - 1;
  }
  days[days.length - 1].endIndex = hours;
  const todayIdx = dayIndex[Math.min(nowIndex, hours - 1)];
  days[todayIdx].isToday = true;
  const currentMonthStartDay = days.findIndex((d) => {
    const dd = new Date(d.start);
    return dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear();
  });

  // ---------- weather ----------
  const nDays = days.length;
  const anomaly = new Float32Array(nDays + 1);
  {
    let a = 0;
    const firstDayNo = Math.floor(days[0].start / DAY);
    for (let b = -60; b <= nDays; b++) {
      a = 0.72 * a + 1.9 * gauss(seed, 11, firstDayNo + b);
      if (b >= 0) anomaly[b] = a;
    }
  }
  const temperature = new Float32Array(hours);
  const dark = new Uint8Array(hours);
  const doys = days.map((d) => dayOfYear(new Date(d.start)));
  const suns = doys.map((doy) => sunTimes(doy));
  for (let i = 0; i < hours; i++) {
    const di = dayIndex[i];
    const doy = doys[di];
    const h = hourOfDay[i];
    const seasonal = seasonalTemp(doy + h / 24);
    const amp = 3.6 + 1.6 * Math.max(0, Math.cos((2 * Math.PI * (doy - 200)) / 365.25));
    const an = anomaly[di] + (anomaly[di + 1] - anomaly[di]) * (h / 24);
    const absHour = Math.floor(hourStarts[i] / HOUR);
    temperature[i] =
      seasonal +
      an +
      amp * Math.cos((2 * Math.PI * (h - 15)) / 24) +
      0.35 * gauss(seed, 12, absHour);
    const sun = suns[di];
    dark[i] = h + 0.5 < sun.rise || h + 0.5 > sun.set ? 1 : 0;
  }
  for (const d of days) {
    let s = 0;
    for (let i = d.startIndex; i < d.endIndex; i++) s += temperature[i];
    d.meanTempC = s / Math.max(1, d.endIndex - d.startIndex);
  }

  // ---------- production ----------
  const production = new Uint8Array(hours);
  const intensity = new Float32Array(hours);
  for (let di = 0; di < nDays; di++) {
    const d = days[di];
    const doy = doys[di];
    const season = 1 + 0.06 * Math.cos((2 * Math.PI * (doy - 120)) / 365.25);
    const base = d.dayType === 'workday' ? 52 : d.dayType === 'saturday' ? 24 : 0;
    const planned = base * season;
    const dayNo = Math.floor(d.start / DAY);
    const actual = planned * (1 + 0.05 * gauss(seed, 21, dayNo));
    d.plannedTons = Math.round(planned * 10) / 10;
    d.tons = d.isFuture || d.isToday ? d.plannedTons : Math.round(actual * 10) / 10;
    const s =
      d.dayType === 'workday' ? sched.weekday : d.dayType === 'saturday' ? sched.saturday : null;
    for (let i = d.startIndex; i < d.endIndex; i++) {
      const h = hourOfDay[i];
      if (s && h >= s.start && h < s.end) {
        production[i] = 1;
        const absHour = Math.floor(hourStarts[i] / HOUR);
        intensity[i] = (d.tons / d.productionHours) * (1 + 0.04 * gauss(seed, 22, absHour));
      }
    }
  }

  // ---------- measures (M&V) ----------
  const todayStart = days[todayIdx].start;
  const measures: ImplementedMeasure[] = cfg.measures.map((m) => ({
    id: m.id,
    equipmentIds: m.equipmentIds,
    implementedAt: new Date(todayStart - m.implementedDaysAgo * DAY).setHours(0, 0, 0, 0),
    expectedSavingPct: m.expectedSavingPct,
    method: m.method,
    investmentAzn: m.investmentAzn,
  }));
  const measuresFor = (eqId: string) =>
    measures
      .filter((m) => m.equipmentIds.includes(eqId))
      .map((m) => ({ at: m.implementedAt, f: MEASURE_TRUTH[m.id] ?? 1 }));

  // ---------- scenario helpers ----------
  const activeDays = new Map(SCENARIOS.map((sc) => [sc.id, sc.activeDays]));
  const active = (id: string, i: number) => todayIdx - dayIndex[i] < (activeDays.get(id) ?? 0);
  const isOff = (dt: DayType) => dt === 'sunday' || dt === 'holiday';
  const prevDayType = (di: number): DayType => (di > 0 ? days[di - 1].dayType : 'workday');
  const weekendWindow = (i: number, endHourMonday: number): boolean => {
    const di = dayIndex[i];
    const dt = days[di].dayType;
    const h = hourOfDay[i];
    if (production[i]) return false;
    if (dt === 'saturday' && h >= sched.saturday.end) return true;
    if (isOff(dt)) return true;
    return dt === 'workday' && h < endHourMonday && isOff(prevDayType(di));
  };
  const afterShift = (i: number): boolean => {
    if (production[i]) return false;
    const di = dayIndex[i];
    const h = hourOfDay[i];
    const dt = days[di].dayType;
    if (h < 3 && prevDayType(di) === 'workday' && sched.weekday.end === 24) return true;
    return dt === 'saturday' && h >= sched.saturday.end && h < sched.saturday.end + 3;
  };
  const leakStart = todayStart - (scenarioById('s2-air-leak').activeDays - 1) * DAY;
  // +22 % reached in the most recent night (today 06:00)
  const leakFull = todayStart + 6 * HOUR;
  const leakProgress = (i: number) =>
    hourStarts[i] < leakStart
      ? 0
      : Math.min(1, (hourStarts[i] - leakStart) / (leakFull - leakStart));
  // spike sample: latest workday at least 3 days ago, 14:00-16:00
  let spikeDay = todayIdx - 3;
  while (spikeDay > 0 && days[spikeDay].dayType !== 'workday') spikeDay--;

  // per-hour lookup tables shared by all equipment (keeps the hot loop branch-light)
  const H = Math.min(hours, nowIndex + 1);
  const scen = (id: string) => {
    const a = new Uint8Array(H);
    for (let i = 0; i < H; i++) a[i] = active(id, i) ? 1 : 0;
    return a;
  };
  const aS1 = scen('s1-k2-night');
  const aS3 = scen('s3-chiller1-sunday');
  const aS4 = scen('s4-hvac-after-shift');
  const aS5 = scen('s5-warehouse-lights');
  const aS7 = scen('s7-chiller2-cold');
  const aS8 = scen('s8-boiler-weekend');
  const aX1 = scen('x1-extruder-standby');
  const isWorkday = new Uint8Array(H);
  const isOffDay = new Uint8Array(H);
  const isSaturday = new Uint8Array(H);
  const after = new Uint8Array(H);
  const weekend6 = new Uint8Array(H);
  const leak = new Float32Array(H);
  const coldDay = new Uint8Array(H);
  for (let i = 0; i < H; i++) {
    const dt = days[dayIndex[i]].dayType;
    isWorkday[i] = dt === 'workday' ? 1 : 0;
    isOffDay[i] = isOff(dt) ? 1 : 0;
    isSaturday[i] = dt === 'saturday' ? 1 : 0;
    after[i] = afterShift(i) ? 1 : 0;
    weekend6[i] = weekendWindow(i, 6) ? 1 : 0;
    leak[i] = leakProgress(i);
    coldDay[i] = days[dayIndex[i]].meanTempC < 12 ? 1 : 0;
  }

  // ---------- loads ----------
  const readings: HourlySeries = {};
  const currentLoad: Record<string, number> = {};
  const limit = Math.min(hours, nowIndex + 1);

  cfg.equipment.forEach((eq, eqNo) => {
    const arr = new Float32Array(hours).fill(Number.NaN);
    const nom = eq.nominal;
    const ms = measuresFor(eq.id);
    const kind = KINDS[eq.id] ?? 0;
    const isExt3 = eq.id === 'ext-3';
    const isChiller1 = eq.id === 'chiller-1';
    const isChiller2 = eq.id === 'chiller-2';
    // day factors (equipment specific × plant wide), one value per day
    const dayF = new Float32Array(nDays);
    for (let di = 0; di < nDays; di++) {
      const dayNo = Math.floor(days[di].start / DAY);
      dayF[di] = (1 + 0.04 * gauss(seed, 100 + eqNo, dayNo)) * (1 + 0.025 * gauss(seed, 99, dayNo));
    }
    for (let i = 0; i < limit; i++) {
      const di = dayIndex[i];
      const h = hourOfDay[i];
      const T = temperature[i];
      const prod = production[i] === 1;
      const I = prod ? intensity[i] / NOMINAL_RATE_T_PER_H : 0;
      const absHour = Math.floor(hourStarts[i] / HOUR);
      let v: number;
      let idle = false;
      switch (kind) {
        case K_EXT: {
          if (prod) {
            v = nom * 0.74 * (0.82 + 0.18 * I);
            const startHour = isSaturday[i] ? sched.saturday.start : sched.weekday.start;
            if (h === startHour) v *= 1.32; // s6: all four lines start together
            if (isExt3 && di === spikeDay && (h === 14 || h === 15)) v *= 1.5; // x2 spike
          } else {
            idle = true;
            v = nom * 0.03;
            if (aX1[i]) v = nom * 0.19; // heated standby
          }
          break;
        }
        case K_IM:
          if (prod) v = nom * 0.68 * (0.85 + 0.15 * I);
          else {
            idle = true;
            v = nom * 0.025;
          }
          break;
        case K_COMP1:
          if (prod) v = 78 * (0.9 + 0.1 * I);
          else {
            idle = true;
            v = 38;
          }
          v += 0.22 * 38 * leak[i]; // s2: night baseload +22 % over 9 days
          break;
        case K_COMP2:
          if (prod) v = nom * 0.62 * (0.85 + 0.15 * I);
          else {
            idle = true;
            v = 0;
            if (aS1[i] && isWorkday[i]) {
              if (h >= 1 && h <= 5) v = nom * 0.42;
              else if (h === 6) v = nom * 0.21; // until 06:30
            }
          }
          break;
        case K_COMP3:
          if (prod) v = nom * 0.46 * (0.9 + 0.1 * I) + 0.22 * 38 * leak[i] * 0.5;
          else {
            idle = true;
            v = 0;
          }
          break;
        case K_CHILLER:
          if (prod) {
            v = Math.max(34, 70 + 4.6 * Math.max(0, T - 18) - 2 * Math.max(0, 15.5 - T) + 6 * I);
            if (isChiller2 && aS7[i] && coldDay[i]) v = nom * 0.9; // s7
          } else {
            idle = true;
            v = 3 + 1.2 * Math.max(0, T - 22);
            if (isChiller1 && aS3[i] && isOffDay[i]) v = nom * 0.92; // s3 (Sundays and holidays)
          }
          break;
        case K_CT:
          if (prod) v = 30 + 0.25 * Math.max(0, T - 12);
          else {
            idle = true;
            v = 1.5 + (T > 24 ? 4 : 0);
          }
          break;
        case K_AHU_SHOP:
          if (prod) v = 42 + 0.5 * Math.abs(T - 17);
          else {
            idle = true;
            v = 1.5;
            if (aS4[i] && after[i]) v = 42 + 0.5 * Math.abs(T - 17); // s4
          }
          break;
        case K_AHU_WH:
          if (prod) v = 16;
          else {
            idle = true;
            v = 1;
            if (aS4[i] && after[i]) v = 16; // s4
          }
          break;
        case K_LIGHT_SHOP:
          if (prod) v = 37;
          else {
            idle = true;
            v = 0.8;
          }
          break;
        case K_LIGHT_WH:
          if (prod) v = 21;
          else {
            idle = true;
            v = 0.5;
            if (aS5[i] && h < 8) v = 22; // s5
          }
          break;
        case K_LIGHT_SITE:
          v = dark[i] ? 14 : 0.3;
          idle = !prod;
          break;
        case K_OFFICE:
          if (prod) v = 24 + 0.25 * Math.abs(T - 20);
          else {
            idle = true;
            v = 5;
          }
          break;
        case K_BOILER: {
          const hdh = Math.max(0, 16 - T);
          if (prod) v = 90 * (0.85 + 0.15 * I) + 2.3 * hdh;
          else {
            idle = true;
            v = 13 + 0.8 * hdh;
            if (aS8[i] && weekend6[i]) v = 30 + 2.3 * hdh; // s8
          }
          break;
        }
        default:
          v = prod ? nom * 0.5 : nom * 0.05;
          idle = !prod;
      }
      for (let k = 0; k < ms.length; k++) if (hourStarts[i] >= ms[k].at) v *= ms[k].f;
      const sigma = idle ? 0.04 : 0.035;
      // idle baseloads are physically steadier than production loads: damp the day factor
      v =
        v *
          (idle ? 1 + 0.25 * (dayF[di] - 1) : dayF[di]) *
          (1 + sigma * gauss(seed, 200 + eqNo, absHour)) +
        (idle ? 0.15 * gauss(seed, 300 + eqNo, absHour) : 0);
      v = Math.max(0, v);
      if (i < nowIndex) arr[i] = v;
      else currentLoad[eq.id] = v;
    }
    readings[eq.id] = arr;
  });

  const offlineEquipment = [{ id: 'ahu-wh', since: nowMs - 12 * 60_000 }];
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    generatedAt: nowMs,
    generationMs: t1 - t0,
    plant: cfg.plant,
    groups: cfg.groups,
    equipment: cfg.equipment,
    timeline: {
      startMs,
      hours,
      nowIndex,
      nowMs,
      hourStarts,
      hourOfDay,
      weekday,
      dayIndex,
      currentMonthStartDay,
    },
    days,
    context: { temperature, production, intensity, dark },
    readings,
    currentLoad,
    measures,
    offlineEquipment,
  };
}
