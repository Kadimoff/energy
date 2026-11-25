import type { EffectiveRates } from '../../data/config';
import type { ImplementedMeasure } from '../../data/types';
import { scope2Kg } from '../carbon';
import { energyValue } from '../cost';
import type { AnalysisCore } from '../core';
import { mean } from '../stats';
import {
  defaultMvOptions,
  evaluateMeasure,
  type MeasureResult,
  type MvOptions,
  type MvStatus,
} from '../mv';

/**
 * View models for the M&V page (spec 7.10, 5.8). Built on evaluateMeasure
 * (IPMVP: avoided energy = adjusted baseline − actual).
 */

export interface MvSummary {
  /** measures past the minimum reporting period (verified or below expected) */
  verifiedKwh: number;
  verifiedAzn: number;
  verifiedTCo2: number;
  /** measures still in the minimum reporting period */
  preliminaryKwh: number;
  expectedKwh: number;
  /** verified / expected of the measures past the reporting minimum, % */
  achievedPct: number;
  counts: Record<MvStatus, number>;
  /** all measures / measures past the reporting minimum */
  total: number;
  verifiedCount: number;
  investmentAzn: number;
  /** verified saving per month at the reporting-period rate */
  monthlyAzn: number;
  /** simple payback of all investments, months (Infinity without saving) */
  paybackMonths: number;
}

const isVerifiedStatus = (s: MvStatus) => s !== 'measuring';

export function mvSummary(results: MeasureResult[], rates: EffectiveRates): MvSummary {
  const ver = results.filter((r) => isVerifiedStatus(r.status));
  const pre = results.filter((r) => !isVerifiedStatus(r.status));
  const verifiedKwh = ver.reduce((s, r) => s + r.avoidedKwh, 0);
  const expectedKwh = ver.reduce((s, r) => s + r.expectedKwh, 0);
  const monthlyKwh = ver.reduce((s, r) => s + r.avoidedPerMonthKwh, 0);
  const investmentAzn = results.reduce((s, r) => s + r.investmentAzn, 0);
  const monthlyAzn = energyValue(monthlyKwh, 0, rates);
  const counts: Record<MvStatus, number> = { measuring: 0, verified: 0, below_expected: 0 };
  for (const r of results) counts[r.status]++;
  return {
    verifiedKwh,
    verifiedAzn: energyValue(verifiedKwh, 0, rates),
    verifiedTCo2: scope2Kg(verifiedKwh, rates) / 1000,
    preliminaryKwh: pre.reduce((s, r) => s + r.avoidedKwh, 0),
    expectedKwh,
    achievedPct: expectedKwh > 0 ? (verifiedKwh / expectedKwh) * 100 : 0,
    counts,
    total: results.length,
    verifiedCount: ver.length,
    investmentAzn,
    monthlyAzn,
    paybackMonths:
      investmentAzn <= 0
        ? 0
        : monthlyAzn > 0
          ? investmentAzn / monthlyAzn
          : Number.POSITIVE_INFINITY,
  };
}

export interface CumulativeMeasurePoint {
  key: string;
  start: number;
  /** running total per measure (kWh) */
  byMeasure: Record<string, number>;
  byMeasureAzn: Record<string, number>;
  totalKwh: number;
  totalAzn: number;
  /** running total of measures past the reporting minimum only */
  verifiedKwh: number;
  verifiedAzn: number;
}

/** Month-end running totals of avoided energy per measure (reporting periods only). */
export function cumulativeByMeasure(
  results: MeasureResult[],
  rates: EffectiveRates,
): CumulativeMeasurePoint[] {
  const months = new Map<string, number>();
  for (const r of results)
    for (const d of r.daily)
      if (d.period === 'reporting') {
        const k = d.key.slice(0, 7);
        if (!months.has(k)) {
          const dt = new Date(d.start);
          months.set(k, new Date(dt.getFullYear(), dt.getMonth(), 1).getTime());
        }
      }
  const keys = [...months.keys()].sort();
  return keys.map((k) => {
    const byMeasure: Record<string, number> = {};
    const byMeasureAzn: Record<string, number> = {};
    let total = 0;
    let verified = 0;
    for (const r of results) {
      let last = 0;
      for (const d of r.daily)
        if (d.period === 'reporting' && d.cumAvoided !== null && d.key.slice(0, 7) <= k)
          last = d.cumAvoided;
      byMeasure[r.id] = last;
      byMeasureAzn[r.id] = energyValue(last, 0, rates);
      total += last;
      if (isVerifiedStatus(r.status)) verified += last;
    }
    return {
      key: k,
      start: months.get(k)!,
      byMeasure,
      byMeasureAzn,
      totalKwh: total,
      totalAzn: energyValue(total, 0, rates),
      verifiedKwh: verified,
      verifiedAzn: energyValue(verified, 0, rates),
    };
  });
}

export interface MvExplanation {
  /** baseline period mean daily consumption × reporting days (no adjustment) */
  unadjustedBaselineKwh: number;
  adjustedBaselineKwh: number;
  actualKwh: number;
  /** adjusted − unadjusted: effect of production and weather (routine adjustment) */
  routineAdjustmentKwh: number;
  /** unadjusted − actual: what a naive before/after comparison would claim */
  naiveSavingKwh: number;
  /** adjusted − actual (IPMVP) */
  avoidedKwh: number;
  productionPct: number;
  tempDeltaC: number;
  baselineTonsPerDay: number;
  reportTonsPerDay: number;
  baselineMeanTempC: number;
  reportMeanTempC: number;
  /** avoided saving larger than its confidence interval */
  significant: boolean;
  /** actual above the adjusted baseline: no saving visible within this boundary */
  negative: boolean;
  /** CI half width relative to the avoided energy, % */
  ciRelativePct: number;
}

/** Explanation of the adjustments ("why the saving is not the weather"). */
export function mvExplain(core: AnalysisCore, r: MeasureResult): MvExplanation {
  const base = r.daily.filter((d) => d.period === 'baseline');
  const rep = r.daily.filter((d) => d.period === 'reporting');
  const unadj = mean(base.map((d) => d.actual)) * rep.length;
  const temps = (from: number, to: number) =>
    mean(core.ds.days.filter((d) => d.start >= from && d.start < to).map((d) => d.meanTempC));
  return {
    unadjustedBaselineKwh: rep.length ? unadj : 0,
    adjustedBaselineKwh: r.adjustedBaselineKwh,
    actualKwh: r.actualKwh,
    routineAdjustmentKwh: rep.length ? r.adjustedBaselineKwh - unadj : 0,
    naiveSavingKwh: rep.length ? unadj - r.actualKwh : 0,
    avoidedKwh: r.avoidedKwh,
    productionPct: r.adjustments.productionPct,
    tempDeltaC: r.adjustments.tempDeltaC,
    baselineTonsPerDay: r.adjustments.baselineTons,
    reportTonsPerDay: r.adjustments.reportTons,
    baselineMeanTempC: temps(r.baselineFrom, r.baselineTo),
    reportMeanTempC: temps(r.reportFrom, r.reportTo),
    significant: r.avoidedKwh > r.ciKwh,
    negative: r.avoidedKwh < 0,
    ciRelativePct: r.avoidedKwh !== 0 ? (r.ciKwh / Math.abs(r.avoidedKwh)) * 100 : Number.NaN,
  };
}

/** IPMVP guidance: Option C suits savings above roughly this share of facility use (%). */
export const OPTION_C_MIN_SHARE_PCT = 10;

export interface MeasureOptionResult extends MeasureResult {
  /** expected saving of the measure as a share of the metered boundary, % */
  boundarySharePct: number;
  /** expected saving too small for a whole-facility (Option C) evaluation */
  optionCUnsuitable: boolean;
}

/**
 * Evaluate a measure with Option B (its own meters) or Option C (whole
 * facility). For Option C the expected kWh comes from the equipment-level
 * expectation, so the status compares like with like.
 */
export function evaluateMeasureOption(
  core: AnalysisCore,
  m: ImplementedMeasure,
  method: 'B' | 'C',
  opts: MvOptions = defaultMvOptions,
): MeasureOptionResult {
  const b = evaluateMeasure(core, m, { ...opts, method: 'B' });
  const c0 = method === 'C' ? evaluateMeasure(core, m, { ...opts, method: 'C' }) : null;
  if (method === 'B' || !c0)
    return {
      ...b,
      boundarySharePct:
        b.adjustedBaselineKwh > 0 ? (b.expectedKwh / b.adjustedBaselineKwh) * 100 : 0,
      optionCUnsuitable: false,
    };
  const c = c0;
  const expectedKwh = b.expectedKwh;
  const share = c.adjustedBaselineKwh > 0 ? (expectedKwh / c.adjustedBaselineKwh) * 100 : 0;
  const status: MvStatus =
    c.reportDays < opts.minReportDays
      ? 'measuring'
      : c.avoidedKwh >= opts.verifiedShare * expectedKwh
        ? 'verified'
        : 'below_expected';
  return {
    ...c,
    expectedKwh,
    expectedSavingPct: share,
    status,
    boundarySharePct: share,
    optionCUnsuitable: share < OPTION_C_MIN_SHARE_PCT,
  };
}

export interface MvChartPoint {
  t: number;
  period: 'baseline' | 'reporting';
  actual: number;
  model: number;
  /** [actual, model] when the model is above the actual (avoided energy) */
  avoided: [number, number] | null;
  /** days aggregated into this point */
  days: number;
}

/** Baseline vs reporting chart points, daily or as weekly means per period. */
export function mvChartSeries(r: MeasureResult, resolution: 'day' | 'week'): MvChartPoint[] {
  const pts: MvChartPoint[] = [];
  if (resolution === 'day') {
    for (const d of r.daily)
      pts.push({
        t: d.start,
        period: d.period,
        actual: d.actual,
        model: d.model,
        avoided: d.period === 'reporting' && d.model > d.actual ? [d.actual, d.model] : null,
        days: 1,
      });
    return pts;
  }
  let cur: { t: number; period: MvChartPoint['period']; a: number; m: number; n: number } | null =
    null;
  const flush = () => {
    if (!cur) return;
    const actual = cur.a / cur.n;
    const model = cur.m / cur.n;
    pts.push({
      t: cur.t,
      period: cur.period,
      actual,
      model,
      avoided: cur.period === 'reporting' && model > actual ? [actual, model] : null,
      days: cur.n,
    });
    cur = null;
  };
  for (const d of r.daily) {
    const dt = new Date(d.start);
    const wd = (dt.getDay() + 6) % 7;
    const weekStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - wd).getTime();
    // weeks start on Monday; the first week of a period starts at the period start
    const t = Math.max(weekStart, d.period === 'reporting' ? r.reportFrom : r.baselineFrom);
    if (!cur || cur.period !== d.period || cur.t !== t) {
      flush();
      cur = { t, period: d.period, a: 0, m: 0, n: 0 };
    }
    cur.a += d.actual;
    cur.m += d.model;
    cur.n += 1;
  }
  flush();
  return pts;
}

/** Money and CO₂ values of one measure result at the effective rates. */
export function measureValues(r: MeasureResult, rates: EffectiveRates) {
  return {
    avoidedAzn: energyValue(r.avoidedKwh, 0, rates),
    expectedAzn: energyValue(r.expectedKwh, 0, rates),
    ciAzn: energyValue(r.ciKwh, 0, rates),
    perMonthAzn: energyValue(r.avoidedPerMonthKwh, 0, rates),
    avoidedTCo2: scope2Kg(r.avoidedKwh, rates) / 1000,
    /** verified / expected, % */
    achievedPct: r.expectedKwh > 0 ? (r.avoidedKwh / r.expectedKwh) * 100 : 0,
    ciLowKwh: r.avoidedKwh - r.ciKwh,
    ciHighKwh: r.avoidedKwh + r.ciKwh,
  };
}
