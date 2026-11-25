import type { AnalysisCore } from '../core';

/**
 * Peak load planner (spec 7.8): typical workday load profile of the plant and
 * the effect of starting the extrusion lines one after another instead of
 * all together at the shift start (spec 9.4 scenario 6).
 *
 * Hourly meter data cannot show how long the start-up surge of a line lasts,
 * so the surge duration is an explicit planner assumption. The surge energy
 * measured in the start hour is conserved: a surge of S kWh/h that lasts D
 * minutes draws S × 60 / D kW during those minutes. With all lines started
 * at the shift start the simulated hourly averages reproduce the data.
 */

export const SLOT_MIN = 15;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MIN;

export interface PeakLine {
  id: string;
  /** average hourly load (kW) of a typical workday, 24 values */
  profile: number[];
  /** load before the line is started (kW): the hour before the shift start */
  preKw: number;
  /** extra kWh drawn in the start hour above the running load */
  surgeKwh: number;
}

export interface WorkdayProfile {
  /** shift start hour on workdays (lines start together here today) */
  startHour: number;
  /** load of all other electricity meters per hour (kW) */
  base: number[];
  lines: PeakLine[];
  /** number of workdays averaged */
  days: number;
  peakLimitKw: number;
}

/** Average workday profile over the last `days` complete workdays. */
export function workdayProfile(core: AnalysisCore, lineIds: string[], days = 20): WorkdayProfile {
  const { ds } = core;
  const startHour = ds.plant.schedule.weekday.start;
  const picked: number[] = [];
  for (let d = core.todayDay - 1; d >= 0 && picked.length < days; d--) {
    if (ds.days[d].dayType === 'workday' && ds.days[d].endIndex - ds.days[d].startIndex === 24)
      picked.push(d);
  }
  const avg = (id: string) => {
    const out = new Array<number>(24).fill(0);
    for (const d of picked) {
      const day = ds.days[d];
      for (let i = day.startIndex; i < day.endIndex; i++)
        out[ds.timeline.hourOfDay[i]] += ds.readings[id][i];
    }
    return out.map((v) => (picked.length ? v / picked.length : 0));
  };
  const base = new Array<number>(24).fill(0);
  for (const id of core.electricIds) {
    if (lineIds.includes(id)) continue;
    avg(id).forEach((v, h) => (base[h] += v));
  }
  const lines = lineIds.map((id) => {
    const profile = avg(id);
    const next = profile[Math.min(23, startHour + 1)];
    return {
      id,
      profile,
      preKw: profile[Math.max(0, startHour - 1)],
      surgeKwh: Math.max(0, profile[startHour] - next),
    };
  });
  return { startHour, base, lines, days: picked.length, peakLimitKw: ds.plant.peakLimitKw };
}

export interface StartPlan {
  /** line ids in start order */
  order: string[];
  /** minutes between two starts (0 = all together) */
  intervalMin: number;
  /** assumed duration of the start-up surge (minutes) */
  surgeMin: number;
}

export interface PlanSlot {
  /** minute of day */
  minute: number;
  base: number;
  lines: Record<string, number>;
  total: number;
}

export interface PlanResult {
  slots: PlanSlot[];
  /** start minute of day per line */
  starts: Record<string, number>;
  peakKw: number;
  peakMinute: number;
  /** highest hourly average (what hourly metering shows) */
  peakHourlyKw: number;
  /** daily kWh of the plan */
  energyKwh: number;
  /** minutes the last line starts after the shift start */
  lastDelayMin: number;
}

/** Start minutes per line: first line at the shift start, the rest every `intervalMin`. */
export function startMinutes(p: WorkdayProfile, plan: StartPlan): Record<string, number> {
  const out: Record<string, number> = {};
  plan.order.forEach((id, k) => (out[id] = p.startHour * 60 + k * plan.intervalMin));
  return out;
}

/** Simulate the workday at 15-minute resolution for a start plan. */
export function simulatePlan(p: WorkdayProfile, plan: StartPlan): PlanResult {
  const starts = startMinutes(p, plan);
  const surgeMin = Math.max(SLOT_MIN, plan.surgeMin);
  const slots: PlanSlot[] = [];
  let peakKw = 0;
  let peakMinute = 0;
  let energy = 0;
  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const minute = s * SLOT_MIN;
    const h = Math.floor(minute / 60);
    const lines: Record<string, number> = {};
    let total = p.base[h];
    for (const line of p.lines) {
      const st = starts[line.id] ?? p.startHour * 60;
      // running load without the start-up surge
      const running =
        h <= p.startHour ? line.profile[Math.min(23, p.startHour + 1)] : line.profile[h];
      let kw: number;
      if (minute < st) kw = h < p.startHour ? line.profile[h] : line.preKw;
      else if (minute < st + surgeMin) kw = running + (line.surgeKwh * 60) / surgeMin;
      else kw = running;
      lines[line.id] = kw;
      total += kw;
    }
    energy += (total * SLOT_MIN) / 60;
    if (total > peakKw) {
      peakKw = total;
      peakMinute = minute;
    }
    slots.push({ minute, base: p.base[h], lines, total });
  }
  let peakHourlyKw = 0;
  for (let h = 0; h < 24; h++) {
    let s = 0;
    for (let k = 0; k < 60 / SLOT_MIN; k++) s += slots[h * (60 / SLOT_MIN) + k].total;
    peakHourlyKw = Math.max(peakHourlyKw, s / (60 / SLOT_MIN));
  }
  const lastDelayMin = Math.max(0, ...Object.values(starts)) - p.startHour * 60;
  return { slots, starts, peakKw, peakMinute, peakHourlyKw, energyKwh: energy, lastDelayMin };
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]),
  );
}

export const PLAN_INTERVALS = [0, 15, 30, 45, 60];

/**
 * Suggested plan: the start order and interval with the lowest peak; among
 * plans within 1 kW of the best peak the shortest delay of the last line wins.
 */
export function suggestPlan(
  p: WorkdayProfile,
  surgeMin: number,
): StartPlan & { result: PlanResult } {
  let best: (StartPlan & { result: PlanResult }) | null = null;
  for (const intervalMin of PLAN_INTERVALS) {
    for (const order of permutations(p.lines.map((l) => l.id))) {
      const plan = { order, intervalMin, surgeMin };
      const result = simulatePlan(p, plan);
      if (
        !best ||
        result.peakKw < best.result.peakKw - 1 ||
        (Math.abs(result.peakKw - best.result.peakKw) <= 1 &&
          result.lastDelayMin < best.result.lastDelayMin)
      )
        best = { ...plan, result };
    }
  }
  return best!;
}

/** Move one line up (-1) or down (+1) in the start order. */
export function moveInOrder(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** 495 -> "08:15" */
export function minuteLabel(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Peak reduction of a plan against a reference plan (kW and %). */
export function peakReduction(plan: PlanResult, reference: PlanResult) {
  const kw = reference.peakKw - plan.peakKw;
  return {
    kw,
    pct: reference.peakKw > 0 ? (kw / reference.peakKw) * 100 : 0,
    hourlyKw: reference.peakHourlyKw - plan.peakHourlyKw,
    energyKwh: plan.energyKwh - reference.energyKwh,
  };
}
