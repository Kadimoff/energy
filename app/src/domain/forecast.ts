import type { EffectiveRates } from '../data/config';
import type { DayInfo, RecommendationState } from '../data/types';
import { budgetKwh, electricityCost, gasCost } from './cost';
import { dailyTotals, slotOf, type AnalysisCore } from './core';
import {
  combinedReduction,
  effectiveFrom,
  SLOTS,
  type RecommendationEngineResult,
} from './recommendations';
import { normalCdf } from './stats';

/**
 * Month-end (or any period) forecast, spec 5.4:
 *   forecast = actual so far + model forecast of the remaining hours.
 * Remaining hours = optimal model (production plan + temperature forecast)
 * + current waste rate per hour-of-week (last 28 days), minus the effect of
 * accepted recommendations from their effective date. P10–P90 from the
 * daily residual σ and a systematic uncertainty on the waste rate.
 */

export const Z90 = 1.2815515655446004;

export interface ForecastDay {
  dayIndex: number;
  key: string;
  start: number;
  /** measured kWh (m³) so far, null for future days */
  actual: number | null;
  /** forecast for the remaining hours of the day (null for complete days) */
  forecast: number | null;
  /** actual + forecast */
  total: number;
  /** optimal (model) consumption for the full day and its band */
  optimal: number;
  optimalLower: number;
  optimalUpper: number;
  waste: number;
  cumActual: number | null;
  cumMean: number;
  cumP10: number;
  cumP90: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface PeriodForecast {
  days: ForecastDay[];
  actualToDate: number;
  remaining: number;
  total: number;
  sd: number;
  p10: number;
  p90: number;
  optimalTotal: number;
  /** waste included in the remaining forecast */
  remainingWaste: number;
  /** reduction of the remaining forecast from accepted recommendations */
  recommendationEffect: number;
}

export interface ForecastOptions {
  eqIds: string[];
  /** day indices [fromDay, toDay) */
  fromDay: number;
  toDay: number;
  engine?: RecommendationEngineResult;
  recStates?: Record<string, RecommendationState>;
  /** multiply the remaining waste (scenario use) */
  wasteFactor?: number;
}

/** Index range of the current calendar month (days) */
export function monthDayRange(
  core: AnalysisCore,
  offsetMonths = 0,
): { fromDay: number; toDay: number } {
  const { ds } = core;
  const today = new Date(ds.days[core.todayDay].start);
  const target = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  let fromDay = -1;
  let toDay = -1;
  ds.days.forEach((d, i) => {
    if (d.key.startsWith(key)) {
      if (fromDay < 0) fromDay = i;
      toDay = i + 1;
    }
  });
  return { fromDay: Math.max(0, fromDay), toDay: Math.max(0, toDay) };
}

/** Build a function giving the active reduction per equipment and slot at time t. */
export function reductionAt(
  engine: RecommendationEngineResult | undefined,
  recStates: Record<string, RecommendationState> | undefined,
  nowMs: number,
) {
  if (!engine || !recStates) return () => null;
  const dated = Object.entries(recStates)
    .map(([id, st]) => ({ id, from: effectiveFrom(st, nowMs) }))
    .filter((x): x is { id: string; from: number } => x.from !== null)
    .filter((x) => engine.recommendations.some((r) => r.id === x.id));
  const cache = new Map<string, Record<string, Float32Array>>();
  return (t: number) => {
    const ids = dated
      .filter((x) => x.from <= t)
      .map((x) => x.id)
      .sort();
    if (!ids.length) return null;
    const k = ids.join('|');
    let red = cache.get(k);
    if (!red) {
      red = combinedReduction(engine, ids);
      cache.set(k, red);
    }
    return red;
  };
}

export function forecastPeriod(core: AnalysisCore, opts: ForecastOptions): PeriodForecast {
  const { ds } = core;
  const now = ds.timeline.nowIndex;
  const dt = dailyTotals(core, opts.eqIds);
  const redAt = reductionAt(opts.engine, opts.recStates, ds.timeline.nowMs);
  const wasteRate = opts.engine?.wasteRate;
  const wf = opts.wasteFactor ?? 1;
  const zero = new Float32Array(SLOTS);
  const days: ForecastDay[] = [];
  let cumA = 0;
  let cumMean = 0;
  let variance = 0;
  let actualToDate = 0;
  let remaining = 0;
  let remainingWaste = 0;
  let recEffect = 0;
  let optimalTotal = 0;
  const sysPct = core.cfg.forecast.systematicWasteUncertaintyPct / 100;
  for (let d = opts.fromDay; d < opts.toDay; d++) {
    const day: DayInfo = ds.days[d];
    let act = 0;
    let fc = 0;
    let fcWaste = 0;
    let futureHours = 0;
    for (let i = day.startIndex; i < day.endIndex; i++) {
      if (i < now) {
        for (const id of opts.eqIds) act += ds.readings[id][i];
        continue;
      }
      futureHours++;
      const red = redAt(ds.timeline.hourStarts[i]);
      const s = slotOf(core, i);
      for (const id of opts.eqIds) {
        const e = core.bands[id].expected[i];
        const w = (wasteRate?.[id] ?? zero)[s] * wf;
        const r = red?.[id]?.[s] ?? 0;
        fc += e + Math.max(0, w - r);
        fcWaste += Math.max(0, w - r);
        recEffect += Math.min(w, r);
      }
    }
    const frac = futureHours / Math.max(1, day.endIndex - day.startIndex);
    variance += (dt.sigma * frac) ** 2;
    actualToDate += act;
    remaining += fc;
    remainingWaste += fcWaste;
    optimalTotal += dt.expected[d];
    const total = act + fc;
    const hasActual = day.startIndex < now;
    if (hasActual) cumA += act;
    cumMean += total;
    const sd = Math.sqrt(variance + (sysPct * remainingWaste) ** 2);
    days.push({
      dayIndex: d,
      key: day.key,
      start: day.start,
      actual: hasActual ? act : null,
      forecast: futureHours > 0 ? fc : null,
      total,
      optimal: dt.expected[d],
      optimalLower: dt.lower[d],
      optimalUpper: dt.upper[d],
      waste: hasActual ? dt.waste[d] + fcWaste : fcWaste,
      cumActual: hasActual ? cumA : null,
      cumMean,
      cumP10: cumMean - Z90 * sd,
      cumP90: cumMean + Z90 * sd,
      isToday: day.isToday,
      isFuture: day.isFuture,
    });
  }
  const sd = Math.sqrt(variance + (sysPct * remainingWaste) ** 2);
  const total = actualToDate + remaining;
  return {
    days,
    actualToDate,
    remaining,
    total,
    sd,
    p10: total - Z90 * sd,
    p90: total + Z90 * sd,
    optimalTotal,
    remainingWaste,
    recommendationEffect: recEffect,
  };
}

export interface BudgetForecast extends PeriodForecast {
  costMean: number;
  costP10: number;
  costP90: number;
  budgetAzn: number;
  /** cost - budget */
  overrunAzn: number;
  /** probability (0..1) that the period cost exceeds the budget */
  overrunProbability: number;
}

/** Electricity month forecast against the electricity budget. */
export function electricityBudgetForecast(
  fc: PeriodForecast,
  rates: EffectiveRates,
): BudgetForecast {
  const budget = rates.electricityBudgetAzn;
  const bKwh = budgetKwh(rates);
  const prob = fc.sd > 0 ? 1 - normalCdf((bKwh - fc.total) / fc.sd) : fc.total > bKwh ? 1 : 0;
  const costMean = electricityCost(fc.total, rates);
  return {
    ...fc,
    costMean,
    costP10: electricityCost(fc.p10, rates),
    costP90: electricityCost(fc.p90, rates),
    budgetAzn: budget,
    overrunAzn: costMean - budget,
    overrunProbability: prob,
  };
}

/** Gas month forecast against the gas budget. */
export function gasBudgetForecast(fc: PeriodForecast, rates: EffectiveRates): BudgetForecast {
  const budget = rates.gasBudgetAzn;
  const costMean = gasCost(fc.total, rates);
  const sdCost = fc.sd * rates.gasRateAznPerM3;
  const prob = sdCost > 0 ? 1 - normalCdf((budget - costMean) / sdCost) : costMean > budget ? 1 : 0;
  return {
    ...fc,
    costMean,
    costP10: gasCost(fc.p10, rates),
    costP90: gasCost(fc.p90, rates),
    budgetAzn: budget,
    overrunAzn: costMean - budget,
    overrunProbability: prob,
  };
}
