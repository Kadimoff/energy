import type { AppConfig, EffectiveRates } from '../data/config';
import type {
  Anomaly,
  AnomalyStatus,
  Equipment,
  EquipmentGroupId,
  Recommendation,
  RecommendationState,
  RecommendationStatus,
} from '../data/types';
import type { Analysis } from './analysis';
import { annualReductionT, emissions, scope1Kg, scope2Kg } from './carbon';
import { budgetKwh, electricityCost, energyValue } from './cost';
import { DAY_MS, dailyTotals, monthlyTotals, type AnalysisCore } from './core';
import { healthScore, openCounts } from './equipment';
import {
  electricityBudgetForecast,
  forecastPeriod,
  gasBudgetForecast,
  monthDayRange,
  Z90,
  type BudgetForecast,
} from './forecast';
import { combinedMonthlySaving, paybackMonths } from './recommendations';

/**
 * Pure view-model builders. Pages render these; they never calculate.
 * React hooks wrapping them live in src/stores/derived.ts.
 */

// ---------------------------------------------------------------------------
// Date ranges

export type RangePreset = 'today' | '7d' | 'month' | 'quarter' | 'year' | 'custom';

export interface ResolvedRange {
  preset: RangePreset;
  fromDay: number;
  /** exclusive */
  toDay: number;
  from: number;
  to: number;
  resolution: 'hour' | 'day';
}

export function resolveRange(
  core: AnalysisCore,
  preset: RangePreset,
  custom?: { from: number; to: number } | null,
): ResolvedRange {
  const { ds } = core;
  const t = core.todayDay;
  const last = ds.days.length;
  let fromDay = t;
  let toDay = t + 1;
  const today = new Date(ds.days[t].start);
  const dayOf = (ms: number) => {
    const i = ds.days.findIndex((d) => d.start + DAY_MS > ms);
    return i < 0 ? last - 1 : i;
  };
  switch (preset) {
    case 'today':
      break;
    case '7d':
      fromDay = Math.max(0, t - 6);
      break;
    case 'month': {
      const r = monthDayRange(core, 0);
      fromDay = r.fromDay;
      toDay = r.toDay;
      break;
    }
    case 'quarter': {
      const q = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1).getTime();
      const qe = new Date(
        today.getFullYear(),
        Math.floor(today.getMonth() / 3) * 3 + 3,
        1,
      ).getTime();
      fromDay = dayOf(q);
      toDay = Math.min(last, dayOf(qe - 1) + 1);
      break;
    }
    case 'year': {
      const y = new Date(today.getFullYear(), today.getMonth() - 11, 1).getTime();
      fromDay = dayOf(y);
      toDay = monthDayRange(core, 0).toDay;
      break;
    }
    case 'custom':
      if (custom) {
        fromDay = dayOf(custom.from);
        toDay = Math.min(last, dayOf(custom.to) + 1);
      }
      break;
  }
  fromDay = Math.max(0, Math.min(fromDay, last - 1));
  toDay = Math.max(fromDay + 1, Math.min(toDay, last));
  return {
    preset,
    fromDay,
    toDay,
    from: ds.days[fromDay].start,
    to: ds.days[toDay - 1].start + DAY_MS,
    resolution: toDay - fromDay <= 1 ? 'hour' : 'day',
  };
}

// ---------------------------------------------------------------------------
// Actual vs optimal chart points

export interface ChartPoint {
  t: number;
  /** measured value; null in the future */
  actual: number | null;
  optimal: number;
  lower: number;
  upper: number;
  /** waste included in `actual` (kWh above the optimal band) */
  waste: number | null;
  /** forecast for today/future points */
  forecast: number | null;
  forecastLower: number | null;
  forecastUpper: number | null;
  /** daily budget share (kWh), null when no budget applies */
  budget: number | null;
  cumActual: number | null;
  cumOptimal: number;
  cumLower: number;
  cumUpper: number;
  cumForecast: number | null;
  cumForecastLower: number | null;
  cumForecastUpper: number | null;
  cumBudget: number | null;
  isFuture: boolean;
}

export interface ChartSeriesOptions {
  eqIds: string[];
  range: ResolvedRange;
  /** forecast (from forecastPeriod) covering the range; enables forecast fields */
  forecast?: BudgetForecast | null;
  /** budget in kWh for the calendar month (adds budget line) */
  monthBudgetKwh?: number | null;
}

export function chartSeries(core: AnalysisCore, o: ChartSeriesOptions): ChartPoint[] {
  const { ds } = core;
  const now = ds.timeline.nowIndex;
  const pts: ChartPoint[] = [];
  let cA = 0;
  let cO = 0;
  let cL = 0;
  let cU = 0;
  let cF = 0;
  let cB = 0;
  if (o.range.resolution === 'hour') {
    const day = ds.days[o.range.fromDay];
    for (let i = day.startIndex; i < ds.days[o.range.toDay - 1].endIndex; i++) {
      let a = 0;
      let e = 0;
      let lo = 0;
      let up = 0;
      let w = 0;
      for (const id of o.eqIds) {
        const b = core.bands[id];
        a += ds.readings[id][i];
        e += b.expected[i];
        lo += b.lower[i];
        up += b.upper[i];
        w += b.waste[i];
      }
      const past = i < now;
      if (past) cA += a;
      cO += e;
      cL += lo;
      cU += up;
      pts.push({
        t: ds.timeline.hourStarts[i],
        actual: past ? a : null,
        optimal: e,
        lower: lo,
        upper: up,
        waste: past ? w : null,
        forecast: past ? null : e,
        forecastLower: past ? null : lo,
        forecastUpper: past ? null : up,
        budget: null,
        cumActual: past ? cA : null,
        cumOptimal: cO,
        cumLower: cL,
        cumUpper: cU,
        cumForecast: null,
        cumForecastLower: null,
        cumForecastUpper: null,
        cumBudget: null,
        isFuture: !past,
      });
    }
    return pts;
  }
  const dt = dailyTotals(core, o.eqIds);
  const fcByDay = new Map(o.forecast?.days.map((d) => [d.dayIndex, d]) ?? []);
  const k = Z90 * dt.sigma;
  for (let d = o.range.fromDay; d < o.range.toDay; d++) {
    const day = ds.days[d];
    const complete = day.endIndex <= now;
    const fd = fcByDay.get(d);
    const monthDays = new Date(
      new Date(day.start).getFullYear(),
      new Date(day.start).getMonth() + 1,
      0,
    ).getDate();
    const budget = o.monthBudgetKwh ? o.monthBudgetKwh / monthDays : null;
    if (complete) cA += dt.actual[d];
    cO += dt.expected[d];
    cL += dt.lower[d];
    cU += dt.upper[d];
    if (budget !== null) cB += budget;
    const hasFc = !complete && !!fd;
    if (fd) cF = fd.cumMean;
    pts.push({
      t: day.start,
      actual: complete ? dt.actual[d] : null,
      optimal: dt.expected[d],
      lower: dt.lower[d],
      upper: dt.upper[d],
      waste: complete ? dt.waste[d] : null,
      forecast: hasFc ? fd.total : null,
      forecastLower: hasFc ? Math.max(0, fd.total - k) : null,
      forecastUpper: hasFc ? fd.total + k : null,
      budget,
      cumActual: complete ? cA : null,
      cumOptimal: cO,
      cumLower: cL,
      cumUpper: cU,
      cumForecast: fd ? cF : null,
      cumForecastLower: fd ? fd.cumP10 : null,
      cumForecastUpper: fd ? fd.cumP90 : null,
      cumBudget: budget !== null ? cB : null,
      isFuture: !complete,
    });
  }
  // connect the forecast line to the last actual point
  let lastActual = -1;
  for (let i = 0; i < pts.length; i++) if (pts[i].actual !== null) lastActual = i;
  if (lastActual >= 0 && lastActual < pts.length - 1 && pts[lastActual + 1].forecast !== null) {
    const p = pts[lastActual];
    p.forecast = p.actual;
    p.forecastLower = p.actual;
    p.forecastUpper = p.actual;
    p.cumForecast = p.cumActual;
    p.cumForecastLower = p.cumActual;
    p.cumForecastUpper = p.cumActual;
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Recommendations

export interface RecommendationVM extends Recommendation {
  state: RecommendationState;
  status: RecommendationStatus;
  aznPerMonth: number;
  tCo2PerYear: number;
  paybackMonths: number;
  equipmentNames: string[];
}

export function effectiveRecStates(
  base: Record<string, RecommendationState>,
  overrides: Record<string, RecommendationState>,
): Record<string, RecommendationState> {
  return { ...base, ...overrides };
}

export function recommendationVMs(
  recs: Recommendation[],
  states: Record<string, RecommendationState>,
  rates: EffectiveRates,
  equipment: Equipment[],
): RecommendationVM[] {
  const names = new Map(equipment.map((e) => [e.id, e.code]));
  return recs
    .map((r) => {
      const state = states[r.id] ?? { status: 'proposed' as const, updatedAt: 0 };
      const azn = energyValue(r.kwhPerMonth, r.m3PerMonth, rates);
      return {
        ...r,
        state,
        status: state.status,
        aznPerMonth: azn,
        tCo2PerYear: annualReductionT(r.kwhPerMonth, r.m3PerMonth, rates),
        paybackMonths: paybackMonths(r.investmentAzn, azn),
        equipmentNames: r.equipmentIds.map((id) => names.get(id) ?? id),
      };
    })
    .sort((a, b) => b.aznPerMonth - a.aznPerMonth);
}

export interface RecommendationSummary {
  pendingCount: number;
  /** combined potential of proposed recommendations (no double counting) */
  potentialKwhPerMonth: number;
  potentialM3PerMonth: number;
  potentialAznPerMonth: number;
  potentialTCo2PerYear: number;
  /** combined effect of accepted (active) recommendations */
  acceptedAznPerMonth: number;
  acceptedKwhPerMonth: number;
  /** approved/scheduled this calendar month */
  acceptedThisMonth: number;
  /** all recommendations together, share of the monthly electricity run-rate */
  allSharePct: number;
}

export function recommendationSummary(
  a: Analysis,
  vms: RecommendationVM[],
  rates: EffectiveRates,
): RecommendationSummary {
  const pending = vms.filter((v) => v.status === 'proposed');
  const active = vms.filter((v) =>
    ['approved', 'scheduled', 'in_progress', 'measuring', 'verified'].includes(v.status),
  );
  const pot = combinedMonthlySaving(
    a.ds,
    a.engine,
    pending.map((v) => v.id),
  );
  const acc = combinedMonthlySaving(
    a.ds,
    a.engine,
    active.map((v) => v.id),
  );
  const all = combinedMonthlySaving(
    a.ds,
    a.engine,
    vms.map((v) => v.id),
  );
  const monthStart = new Date(
    new Date(a.ds.days[a.todayDay].start).getFullYear(),
    new Date(a.ds.days[a.todayDay].start).getMonth(),
    1,
  ).getTime();
  // monthly electricity run-rate: last 28 days scaled to a month
  const dt = dailyTotals(a, a.electricIds);
  let last28 = 0;
  for (let d = Math.max(0, a.todayDay - 28); d < a.todayDay; d++) last28 += dt.actual[d];
  const runRate = (last28 / 28) * 30.4375;
  return {
    pendingCount: pending.length,
    potentialKwhPerMonth: pot.kwh,
    potentialM3PerMonth: pot.m3,
    potentialAznPerMonth: energyValue(pot.kwh, pot.m3, rates),
    potentialTCo2PerYear: annualReductionT(pot.kwh, pot.m3, rates),
    acceptedAznPerMonth: energyValue(acc.kwh, acc.m3, rates),
    acceptedKwhPerMonth: acc.kwh,
    acceptedThisMonth: active.filter((v) => v.state.updatedAt >= monthStart).length,
    allSharePct: runRate > 0 ? (all.kwh / runRate) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Anomalies

export interface AnomalyVM extends Anomaly {
  lossAzn: number;
  lossKgCo2: number;
  equipmentNames: string[];
}

export function anomalyVMs(
  anomalies: Anomaly[],
  statusOverrides: Record<string, AnomalyStatus>,
  rates: EffectiveRates,
  equipment: Equipment[],
): AnomalyVM[] {
  const names = new Map(equipment.map((e) => [e.id, e.code]));
  return anomalies.map((x) => ({
    ...x,
    status: statusOverrides[x.id] ?? x.status,
    lossAzn: energyValue(x.lossKwh, x.lossM3, rates),
    lossKgCo2: scope2Kg(x.lossKwh, rates) + scope1Kg(x.lossM3, rates),
    equipmentNames: x.equipmentIds.map((id) => names.get(id) ?? id),
  }));
}

// ---------------------------------------------------------------------------
// Month overview (KPIs)

export interface Kpi {
  value: number;
  /** comparison value of the previous period (same number of days) */
  previous: number;
  /** relative change in % (value vs previous) */
  deltaPct: number;
  spark: number[];
}

export interface MonthOverview {
  monthStart: number;
  daysElapsed: number;
  daysInMonth: number;
  electricity: BudgetForecast;
  gas: BudgetForecast;
  consumptionKwh: Kpi;
  costAzn: Kpi & { budgetAzn: number; forecastAzn: number; usedPct: number };
  enpi: Kpi & { targetKwhPerT: number };
  co2T: Kpi & { forecastT: number; monthlyTargetT: number };
  waste: Kpi & { kwh: number; m3: number; sharePct: number };
}

function pctDelta(v: number, p: number) {
  return p > 0 ? (v / p - 1) * 100 : 0;
}

export function monthOverview(
  a: Analysis,
  rates: EffectiveRates,
  recStates: Record<string, RecommendationState>,
): MonthOverview {
  const { ds } = a;
  const cur = monthDayRange(a, 0);
  const prev = monthDayRange(a, -1);
  const elec = electricityBudgetForecast(
    forecastPeriod(a, { eqIds: a.electricIds, ...cur, engine: a.engine, recStates }),
    rates,
  );
  const gas = gasBudgetForecast(
    forecastPeriod(a, { eqIds: a.gasIds, ...cur, engine: a.engine, recStates }),
    rates,
  );
  const e = dailyTotals(a, a.electricIds);
  const g = dailyTotals(a, a.gasIds);
  const elapsed = a.todayDay - cur.fromDay; // complete days
  const sumDays = (arr: Float64Array, from: number, n: number) => {
    let s = 0;
    for (let d = from; d < from + n; d++) s += Number.isNaN(arr[d]) ? 0 : arr[d];
    return s;
  };
  const tons = (from: number, n: number) =>
    ds.days.slice(from, from + n).reduce((s, d) => s + d.tons, 0);
  const n = Math.max(1, elapsed);
  const kwh = sumDays(e.actual, cur.fromDay, n);
  const kwhPrev = sumDays(e.actual, prev.fromDay, n);
  const m3 = sumDays(g.actual, cur.fromDay, n);
  const m3Prev = sumDays(g.actual, prev.fromDay, n);
  const wK = sumDays(e.waste, cur.fromDay, n);
  const wM = sumDays(g.waste, cur.fromDay, n);
  const wKp = sumDays(e.waste, prev.fromDay, n);
  const wMp = sumDays(g.waste, prev.fromDay, n);
  const t = tons(cur.fromDay, n);
  const tp = tons(prev.fromDay, n);
  const last30 = Array.from({ length: 30 }, (_, i) => a.todayDay - 30 + i).filter((d) => d >= 0);
  const em = emissions(kwh, m3, t, rates);
  const emPrev = emissions(kwhPrev, m3Prev, tp, rates);
  const months = monthlyTotals(a, a.electricIds);
  const gm = monthlyTotals(a, a.gasIds);
  // annual CO₂ target spread per month: baseline = previous 12 complete months
  const complete = months.filter((m) => m.complete).slice(-12);
  const baseT = complete.reduce((s, m) => {
    const gg = gm.find((x) => x.key === m.key);
    return s + emissions(m.actual, gg?.actual ?? 0, m.tons, rates).totalT;
  }, 0);
  const monthlyTargetT = (baseT * (1 - rates.annualCo2ReductionPct / 100)) / 12;
  const weekly = Array.from({ length: 8 }, (_, w) => {
    const from = a.todayDay - (8 - w) * 7;
    const kk = sumDays(e.actual, Math.max(0, from), 7);
    const tt = tons(Math.max(0, from), 7);
    return tt > 0 ? kk / tt : 0;
  });
  const fcGas = gas.total;
  return {
    monthStart: ds.days[cur.fromDay].start,
    daysElapsed: elapsed,
    daysInMonth: cur.toDay - cur.fromDay,
    electricity: elec,
    gas,
    consumptionKwh: {
      value: kwh,
      previous: kwhPrev,
      deltaPct: pctDelta(kwh, kwhPrev),
      spark: last30.map((d) => e.actual[d]),
    },
    costAzn: {
      value: electricityCost(kwh, rates),
      previous: electricityCost(kwhPrev, rates),
      deltaPct: pctDelta(kwh, kwhPrev),
      spark: elec.days.map((d) => electricityCost(d.cumMean, rates)),
      budgetAzn: rates.electricityBudgetAzn,
      forecastAzn: elec.costMean,
      usedPct:
        rates.electricityBudgetAzn > 0 ? (elec.costMean / rates.electricityBudgetAzn) * 100 : 0,
    },
    enpi: {
      value: t > 0 ? kwh / t : 0,
      previous: tp > 0 ? kwhPrev / tp : 0,
      deltaPct: pctDelta(t > 0 ? kwh / t : 0, tp > 0 ? kwhPrev / tp : 0),
      spark: weekly,
      targetKwhPerT: rates.enpiTargetKwhPerT,
    },
    co2T: {
      value: em.totalT,
      previous: emPrev.totalT,
      deltaPct: pctDelta(em.totalT, emPrev.totalT),
      spark: last30.map((d) => emissions(e.actual[d], g.actual[d], ds.days[d].tons, rates).totalT),
      forecastT: emissions(elec.total, fcGas, 0, rates).totalT,
      monthlyTargetT,
    },
    waste: {
      value: energyValue(wK, wM, rates),
      previous: energyValue(wKp, wMp, rates),
      deltaPct: pctDelta(energyValue(wK, wM, rates), energyValue(wKp, wMp, rates)),
      spark: last30.map((d) => energyValue(e.waste[d], g.waste[d], rates)),
      kwh: wK,
      m3: wM,
      sharePct: kwh > 0 ? (wK / kwh) * 100 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Waste breakdown by group (current month to date)

export interface GroupBreakdown {
  group: EquipmentGroupId;
  energy: 'electricity' | 'gas';
  actual: number;
  productive: number;
  waste: number;
  /** waste recoverable by recommendations (month to date share) */
  recoverable: number;
  wasteAzn: number;
}

export function wasteByGroup(
  a: Analysis,
  rates: EffectiveRates,
  cfg: Pick<AppConfig, 'groups'>,
): GroupBreakdown[] {
  const cur = monthDayRange(a, 0);
  const days = Math.max(1, a.todayDay - cur.fromDay);
  return cfg.groups
    .map((g) => {
      const ids = a.ds.equipment.filter((e) => e.group === g.id).map((e) => e.id);
      const dt = dailyTotals(a, ids);
      let act = 0;
      let w = 0;
      for (let d = cur.fromDay; d < a.todayDay; d++) {
        act += dt.actual[d];
        w += dt.waste[d];
      }
      const recIds = a.engine.recommendations.filter((r) => r.group === g.id).map((r) => r.id);
      const s = combinedMonthlySaving(a.ds, a.engine, recIds);
      const rec = ((g.energy === 'gas' ? s.m3 : s.kwh) * days) / 30.4375;
      return {
        group: g.id,
        energy: g.energy,
        actual: act,
        productive: act - w,
        waste: w,
        recoverable: Math.min(w, rec),
        wasteAzn:
          g.energy === 'gas' ? w * rates.gasRateAznPerM3 : w * rates.electricityRateAznPerKwh,
      };
    })
    .sort((x, y) => y.wasteAzn - x.wasteAzn);
}

// ---------------------------------------------------------------------------
// Equipment table rows (current month to date)

export interface EquipmentRow {
  equipment: Equipment;
  monthActual: number;
  monthWaste: number;
  wastePct: number;
  health: number;
  lastAnomaly: Anomaly | null;
  openAnomalies: number;
  status: 'normal' | 'waste' | 'attention';
}

export function equipmentRows(a: Analysis, anomalies: Anomaly[]): EquipmentRow[] {
  const cur = monthDayRange(a, 0);
  return a.ds.equipment.map((eq) => {
    const dt = dailyTotals(a, [eq.id]);
    let act = 0;
    let w = 0;
    for (let d = cur.fromDay; d < a.todayDay; d++) {
      act += dt.actual[d];
      w += dt.waste[d];
    }
    const wastePct = act > 0 ? (w / act) * 100 : 0;
    const oc = openCounts(anomalies, eq.id);
    const health = healthScore({
      wastePct,
      openCritical: oc.critical,
      openHigh: oc.high,
      rising: oc.rising,
    });
    return {
      equipment: eq,
      monthActual: act,
      monthWaste: w,
      wastePct,
      health,
      lastAnomaly: oc.last,
      openAnomalies: anomalies.filter(
        (x) =>
          x.equipmentIds.includes(eq.id) && (x.status === 'open' || x.status === 'investigating'),
      ).length,
      status:
        wastePct >= 10 ? 'waste' : oc.critical + oc.high > 0 || oc.rising ? 'attention' : 'normal',
    };
  });
}

// ---------------------------------------------------------------------------
// Carbon by month

export interface CarbonMonth {
  key: string;
  start: number;
  kwh: number;
  m3: number;
  tons: number;
  scope1T: number;
  scope2T: number;
  totalT: number;
  intensityKgPerT: number;
  complete: boolean;
}

export function carbonByMonth(a: AnalysisCore, rates: EffectiveRates): CarbonMonth[] {
  const el = monthlyTotals(a, a.electricIds);
  const gs = monthlyTotals(a, a.gasIds);
  return el.map((m) => {
    const g = gs.find((x) => x.key === m.key);
    const e = emissions(m.actual, g?.actual ?? 0, m.tons, rates);
    return {
      key: m.key,
      start: m.start,
      kwh: m.actual,
      m3: g?.actual ?? 0,
      tons: m.tons,
      scope1T: e.scope1T,
      scope2T: e.scope2T,
      totalT: e.totalT,
      intensityKgPerT: e.intensityKgPerT,
      complete: m.complete,
    };
  });
}

/** Electricity budget expressed in kWh for chart budget lines. */
export const monthBudgetKwh = (rates: EffectiveRates) => budgetKwh(rates);
