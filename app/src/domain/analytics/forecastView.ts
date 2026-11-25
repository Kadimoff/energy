import type { EffectiveRates } from '../../data/config';
import type { RecommendationState } from '../../data/types';
import { budgetKwh, electricityCost, energyValue } from '../cost';
import { DAY_MS, type AnalysisCore } from '../core';
import { forecastPeriod, monthDayRange, Z90, type PeriodForecast } from '../forecast';
import { ACTIVE_STATUSES, type RecommendationEngineResult } from '../recommendations';
import type { ScenarioInput, ScenarioOutcome, ScenarioResult } from '../scenario';
import { normalCdf } from '../stats';

/**
 * View models for the forecast page (spec 7.8): month-end and quarter-end
 * forecast with a P10–P90 fan, the "what if" simulator wiring and the
 * scenario comparison. Pure functions; React hooks live in the page folder.
 */

export type ForecastHorizon = 'month' | 'quarter';

/** z of the 75th percentile, used for the inner (P25–P75) fan band */
export const Z75 = 0.6744897501960817;

export interface HorizonRange {
  horizon: ForecastHorizon;
  fromDay: number;
  /** exclusive */
  toDay: number;
  from: number;
  /** end of the last covered day (ms) */
  to: number;
  /** calendar months covered (budget multiplier) */
  months: number;
  /** false when the dataset ends before the calendar end of the period */
  complete: boolean;
}

/** Current calendar month or quarter, clipped to the days available in the dataset. */
export function horizonRange(core: AnalysisCore, horizon: ForecastHorizon): HorizonRange {
  const { ds } = core;
  if (horizon === 'month') {
    const r = monthDayRange(core, 0);
    return {
      horizon,
      ...r,
      from: ds.days[r.fromDay].start,
      to: ds.days[r.toDay - 1].start + DAY_MS,
      months: 1,
      complete: true,
    };
  }
  const today = new Date(ds.days[core.todayDay].start);
  const q0 = Math.floor(today.getMonth() / 3) * 3;
  const qStart = new Date(today.getFullYear(), q0, 1).getTime();
  const qEnd = new Date(today.getFullYear(), q0 + 3, 1).getTime();
  let fromDay = ds.days.findIndex((d) => d.start >= qStart);
  if (fromDay < 0) fromDay = 0;
  let toDay = fromDay;
  while (toDay < ds.days.length && ds.days[toDay].start < qEnd) toDay++;
  const lastEnd = ds.days[toDay - 1].start + DAY_MS;
  const months = new Set(ds.days.slice(fromDay, toDay).map((d) => d.key.slice(0, 7))).size;
  return {
    horizon,
    fromDay,
    toDay,
    from: ds.days[fromDay].start,
    to: lastEnd,
    months,
    complete: lastEnd >= qEnd && ds.days[fromDay].start <= qStart,
  };
}

export interface HorizonForecast extends PeriodForecast {
  range: HorizonRange;
  budgetAzn: number;
  budgetKwh: number;
  costMean: number;
  costP10: number;
  costP90: number;
  /** cost − budget (positive = overrun) */
  overrunAzn: number;
  /** 0..1 */
  overrunProbability: number;
  /** complete days elapsed / days in period */
  elapsedDays: number;
  totalDays: number;
  /** variable cost of the measured part, the forecast part and the accepted recommendations' effect */
  actualToDateAzn: number;
  remainingAzn: number;
  recommendationEffectAzn: number;
}

/**
 * Electricity forecast of a period against `months` × monthly budget
 * (generalises electricityBudgetForecast to quarters).
 */
export function periodBudgetForecast(
  fc: PeriodForecast,
  rates: EffectiveRates,
  months: number,
): Omit<
  HorizonForecast,
  | 'range'
  | 'elapsedDays'
  | 'totalDays'
  | 'actualToDateAzn'
  | 'remainingAzn'
  | 'recommendationEffectAzn'
> {
  const bKwh = budgetKwh(rates, months);
  const budget = rates.electricityBudgetAzn * months;
  const prob = fc.sd > 0 ? 1 - normalCdf((bKwh - fc.total) / fc.sd) : fc.total > bKwh ? 1 : 0;
  const costMean = electricityCost(fc.total, rates, months);
  return {
    ...fc,
    budgetAzn: budget,
    budgetKwh: bKwh,
    costMean,
    costP10: electricityCost(Math.max(0, fc.p10), rates, months),
    costP90: electricityCost(fc.p90, rates, months),
    overrunAzn: costMean - budget,
    overrunProbability: prob,
  };
}

export function horizonForecast(
  core: AnalysisCore,
  horizon: ForecastHorizon,
  rates: EffectiveRates,
  engine: RecommendationEngineResult,
  recStates: Record<string, RecommendationState>,
): HorizonForecast {
  const range = horizonRange(core, horizon);
  const fc = forecastPeriod(core, {
    eqIds: core.electricIds,
    fromDay: range.fromDay,
    toDay: range.toDay,
    engine,
    recStates,
  });
  return {
    ...periodBudgetForecast(fc, rates, range.months),
    range,
    elapsedDays: Math.max(0, Math.min(core.todayDay, range.toDay) - range.fromDay),
    totalDays: range.toDay - range.fromDay,
    actualToDateAzn: energyValue(fc.actualToDate, 0, rates),
    remainingAzn: energyValue(fc.remaining, 0, rates),
    recommendationEffectAzn: energyValue(fc.recommendationEffect, 0, rates),
  };
}

export interface FanPoint {
  t: number;
  /** cumulative cost of complete days (AZN), null after the last complete day */
  actual: number | null;
  /** forecast mean and bands (AZN), null before the last complete day */
  mean: number | null;
  p10: number | null;
  p90: number | null;
  p25: number | null;
  p75: number | null;
  /** budget of the whole period (horizontal line) */
  budget: number;
  /** pro-rata budget path (budget spread evenly over the days) */
  budgetPace: number;
  isFuture: boolean;
}

/**
 * Cumulative cost fan (AZN) for the chart. Actual line covers complete
 * days; the fan starts at the last complete day so the two connect.
 */
export function fanSeries(f: HorizonForecast, rates: EffectiveRates): FanPoint[] {
  const months = f.range.months;
  const cost = (kwh: number) => electricityCost(Math.max(0, kwh), rates, months);
  const n = f.days.length;
  let lastComplete = -1;
  f.days.forEach((d, i) => {
    if (!d.isToday && !d.isFuture) lastComplete = i;
  });
  return f.days.map((d, i) => {
    const complete = i <= lastComplete;
    const showFan = i >= lastComplete;
    const sd = (d.cumP90 - d.cumMean) / Z90;
    const anchor = i === lastComplete;
    return {
      t: d.start,
      actual: complete ? cost(d.cumActual ?? 0) : null,
      mean: showFan ? cost(d.cumMean) : null,
      p10: showFan ? (anchor ? cost(d.cumMean) : cost(d.cumP10)) : null,
      p90: showFan ? (anchor ? cost(d.cumMean) : cost(d.cumP90)) : null,
      p25: showFan ? (anchor ? cost(d.cumMean) : cost(d.cumMean - Z75 * sd)) : null,
      p75: showFan ? (anchor ? cost(d.cumMean) : cost(d.cumMean + Z75 * sd)) : null,
      budget: f.budgetAzn,
      budgetPace: (f.budgetAzn * (i + 1)) / n,
      isFuture: !complete,
    };
  });
}

// ---------------------------------------------------------------------------
// Simulator

export type OutcomeMetric = 'costAzn' | 'deltaVsBudgetAzn' | 'kwh' | 'co2T' | 'enpiKwhPerT';

export const OUTCOME_METRICS: OutcomeMetric[] = [
  'costAzn',
  'deltaVsBudgetAzn',
  'kwh',
  'co2T',
  'enpiKwhPerT',
];

export interface MetricDelta {
  metric: OutcomeMetric;
  base: number;
  scenario: number;
  delta: number;
  /** relative change in % of the base (NaN when base is 0) */
  deltaPct: number;
  /** lower is better for every metric of the simulator */
  better: boolean | null;
}

export function outcomeDeltas(base: ScenarioOutcome, scenario: ScenarioOutcome): MetricDelta[] {
  return OUTCOME_METRICS.map((metric) => {
    const b = base[metric];
    const s = scenario[metric];
    const delta = s - b;
    return {
      metric,
      base: b,
      scenario: s,
      delta,
      deltaPct: b !== 0 ? (delta / Math.abs(b)) * 100 : Number.NaN,
      // float noise from re-evaluating the same model is not a change
      better: Math.abs(delta) <= 1e-6 * Math.max(1, Math.abs(b)) ? null : delta < 0,
    };
  });
}

/** Days of the scenario period that the simulator can still change (incl. today). */
export function changeableDays(r: ScenarioResult): number {
  return r.daily.filter((d) => d.isFuture).length;
}

export interface ScenarioChange {
  key: 'production' | 'temperature' | 'shifts' | 'recommendations' | 'tariff' | 'grid' | 'month';
  value: number;
}

/** What a scenario changes relative to the defaults (for chips and saved lists). */
export function scenarioChanges(input: ScenarioInput, rates: EffectiveRates): ScenarioChange[] {
  const out: ScenarioChange[] = [];
  if (input.monthOffset !== 0) out.push({ key: 'month', value: input.monthOffset });
  if (input.productionPct !== 0) out.push({ key: 'production', value: input.productionPct });
  if (input.tempDeltaC !== 0) out.push({ key: 'temperature', value: input.tempDeltaC });
  if (input.shifts !== 2) out.push({ key: 'shifts', value: input.shifts });
  if (input.recommendationIds.length)
    out.push({ key: 'recommendations', value: input.recommendationIds.length });
  if (
    input.tariffAznPerKwh !== undefined &&
    Math.abs(input.tariffAznPerKwh - rates.electricityRateAznPerKwh) > 1e-9
  )
    out.push({ key: 'tariff', value: input.tariffAznPerKwh });
  if (
    input.gridKgCo2PerKwh !== undefined &&
    Math.abs(input.gridKgCo2PerKwh - rates.scope2KgCo2PerKwh) > 1e-9
  )
    out.push({ key: 'grid', value: input.gridKgCo2PerKwh });
  return out;
}

/**
 * Normalised scenario input: drops tariff / grid overrides equal to the
 * current settings, de-duplicates and sorts the recommendation ids and
 * clamps the slider ranges. Used before running and saving a scenario.
 */
export function normalizeScenario(input: ScenarioInput, rates: EffectiveRates): ScenarioInput {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const out: ScenarioInput = {
    productionPct: clamp(Math.round(input.productionPct), -30, 30),
    tempDeltaC: clamp(Math.round(input.tempDeltaC * 2) / 2, -10, 10),
    shifts: input.shifts,
    recommendationIds: [...new Set(input.recommendationIds)].sort(),
    monthOffset: input.monthOffset,
  };
  if (
    input.tariffAznPerKwh !== undefined &&
    Math.abs(input.tariffAznPerKwh - rates.electricityRateAznPerKwh) > 1e-9
  )
    out.tariffAznPerKwh = input.tariffAznPerKwh;
  if (
    input.gridKgCo2PerKwh !== undefined &&
    Math.abs(input.gridKgCo2PerKwh - rates.scope2KgCo2PerKwh) > 1e-9
  )
    out.gridKgCo2PerKwh = input.gridKgCo2PerKwh;
  return out;
}

export interface ChecklistItem {
  id: string;
  /** already accepted (approved … verified): part of the base forecast */
  active: boolean;
  rejected: boolean;
  kwhPerMonth: number;
  m3PerMonth: number;
}

/** Recommendation checklist for the simulator, largest saving first. */
export function recommendationChecklist(
  engine: RecommendationEngineResult,
  states: Record<string, RecommendationState>,
): ChecklistItem[] {
  return engine.recommendations
    .map((r) => {
      const st = states[r.id]?.status ?? 'proposed';
      return {
        id: r.id,
        active: ACTIVE_STATUSES.includes(st),
        rejected: st === 'rejected',
        kwhPerMonth: r.kwhPerMonth,
        m3PerMonth: r.m3PerMonth,
      };
    })
    .sort((a, b) => b.kwhPerMonth + b.m3PerMonth * 10 - (a.kwhPerMonth + a.m3PerMonth * 10));
}

export interface BeforeAfterPoint {
  t: number;
  base: number;
  scenario: number;
  cumBase: number;
  cumScenario: number;
  /** scenario − base */
  diff: number;
  cumDiff: number;
  isFuture: boolean;
}

/** Daily and cumulative base vs scenario electricity (kWh) for the before/after chart. */
export function beforeAfterSeries(r: ScenarioResult): BeforeAfterPoint[] {
  let cb = 0;
  let cs = 0;
  return r.daily.map((d) => {
    cb += d.base;
    cs += d.scenario;
    return {
      t: d.start,
      base: d.base,
      scenario: d.scenario,
      cumBase: cb,
      cumScenario: cs,
      diff: d.scenario - d.base,
      cumDiff: cs - cb,
      isFuture: d.isFuture,
    };
  });
}

export interface ScenarioComparisonRow {
  metric: OutcomeMetric;
  a: number;
  b: number;
  /** b − a */
  diff: number;
  /** which scenario is better (lower), null when equal */
  winner: 'a' | 'b' | null;
}

/** Side-by-side comparison of two scenario outcomes. */
export function compareOutcomes(a: ScenarioOutcome, b: ScenarioOutcome): ScenarioComparisonRow[] {
  return OUTCOME_METRICS.map((metric) => {
    const diff = b[metric] - a[metric];
    return {
      metric,
      a: a[metric],
      b: b[metric],
      diff,
      winner:
        Math.abs(diff) <= 1e-6 * Math.max(1, Math.abs(a[metric])) ? null : diff < 0 ? 'b' : 'a',
    };
  });
}
