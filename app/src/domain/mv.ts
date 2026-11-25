import type { ImplementedMeasure } from '../data/types';
import {
  degreeDays,
  dailyBand,
  fitDailyBaseline,
  type DailyBaselineModel,
  type DailyVars,
} from './baseline';
import { DAY_MS, dailyTotals, type AnalysisCore } from './core';
import { mean, tCritical } from './stats';

/**
 * Measurement & Verification (spec 5.8, IPMVP):
 *   avoided energy = adjusted baseline − actual consumption,
 * where the adjusted baseline is the baseline-period model evaluated with the
 * reporting period's production and weather. Option B = metered equipment of
 * the measure, Option C = whole facility (all electricity meters).
 * Uncertainty: ASHRAE Guideline 14 simplified fractional savings uncertainty.
 */

export type MvStatus = 'measuring' | 'verified' | 'below_expected';

export interface MvOptions {
  baselineDays: number;
  settleDays: number;
  minReportDays: number;
  /** verified when achieved ≥ this share of the expected saving */
  verifiedShare: number;
  confidence: number;
  method?: 'B' | 'C';
}

export const defaultMvOptions: MvOptions = {
  baselineDays: 120,
  settleDays: 7,
  minReportDays: 30,
  verifiedShare: 0.8,
  confidence: 0.9,
};

export interface MvDay {
  key: string;
  start: number;
  period: 'baseline' | 'reporting';
  actual: number;
  /** model value: fitted baseline (baseline period) or adjusted baseline (reporting) */
  model: number;
  cumAvoided: number | null;
}

export interface MeasureResult {
  id: string;
  equipmentIds: string[];
  method: 'B' | 'C';
  implementedAt: number;
  baselineFrom: number;
  baselineTo: number;
  reportFrom: number;
  reportTo: number;
  baselineDays: number;
  reportDays: number;
  model: DailyBaselineModel;
  adjustedBaselineKwh: number;
  actualKwh: number;
  avoidedKwh: number;
  /** ± half width of the confidence interval (kWh) */
  ciKwh: number;
  savingPct: number;
  expectedSavingPct: number;
  expectedKwh: number;
  /** avoided per month at the reporting-period rate */
  avoidedPerMonthKwh: number;
  status: MvStatus;
  adjustments: {
    productionPct: number;
    tempDeltaC: number;
    baselineTons: number;
    reportTons: number;
  };
  daily: MvDay[];
  investmentAzn: number;
}

function dayVars(core: AnalysisCore, d: number): DailyVars {
  const day = core.ds.days[d];
  const dd = degreeDays(
    day.meanTempC,
    core.ds.plant.climate.cddBaseC,
    core.ds.plant.climate.hddBaseC,
  );
  return { tons: day.tons, cdd: dd.cdd, hdd: dd.hdd, hours: day.productionHours };
}

export function evaluateMeasure(
  core: AnalysisCore,
  m: ImplementedMeasure,
  opts: MvOptions = defaultMvOptions,
): MeasureResult {
  const { ds } = core;
  const method = opts.method ?? m.method;
  const eqIds = method === 'C' ? core.electricIds : m.equipmentIds;
  const dt = dailyTotals(core, eqIds);
  const implDay = ds.days.findIndex((d) => d.start >= m.implementedAt);
  const bFrom = Math.max(0, implDay - opts.baselineDays);
  const bTo = implDay; // exclusive
  const rFrom = Math.min(core.todayDay, implDay + opts.settleDays);
  const rTo = core.todayDay; // complete days only
  const samples = [];
  for (let d = bFrom; d < bTo; d++) samples.push({ vars: dayVars(core, d), energy: dt.actual[d] });
  const model = fitDailyBaseline(samples, {
    ...core.cfg.robust,
    bandSigma: core.cfg.bandSigma,
    cvrmseWarnPct: core.cfg.cvrmseWarnPct,
  });
  const daily: MvDay[] = [];
  for (let d = bFrom; d < bTo; d++) {
    daily.push({
      key: ds.days[d].key,
      start: ds.days[d].start,
      period: 'baseline',
      actual: dt.actual[d],
      model: dailyBand(model, dayVars(core, d)).expected,
      cumAvoided: null,
    });
  }
  let adj = 0;
  let act = 0;
  let cum = 0;
  for (let d = rFrom; d < rTo; d++) {
    const e = dailyBand(model, dayVars(core, d)).expected;
    adj += e;
    act += dt.actual[d];
    cum += e - dt.actual[d];
    daily.push({
      key: ds.days[d].key,
      start: ds.days[d].start,
      period: 'reporting',
      actual: dt.actual[d],
      model: e,
      cumAvoided: cum,
    });
  }
  const nR = Math.max(0, rTo - rFrom);
  const nB = Math.max(1, model.n);
  const t = tCritical(nB - 5, opts.confidence);
  const ci = nR > 0 ? t * model.sigma * Math.sqrt(nR * (1 + 2 / nB)) : 0;
  const avoided = adj - act;
  const savingPct = adj > 0 ? (avoided / adj) * 100 : 0;
  const status: MvStatus =
    nR < opts.minReportDays
      ? 'measuring'
      : savingPct >= opts.verifiedShare * m.expectedSavingPct
        ? 'verified'
        : 'below_expected';
  const bTons = mean(ds.days.slice(bFrom, bTo).map((d) => d.tons));
  const rTons = mean(ds.days.slice(rFrom, rTo).map((d) => d.tons));
  const bTemp = mean(ds.days.slice(bFrom, bTo).map((d) => d.meanTempC));
  const rTemp = mean(ds.days.slice(rFrom, rTo).map((d) => d.meanTempC));
  return {
    id: m.id,
    equipmentIds: eqIds,
    method,
    implementedAt: m.implementedAt,
    baselineFrom: ds.days[bFrom].start,
    baselineTo: ds.days[Math.max(bFrom, bTo - 1)].start + DAY_MS,
    reportFrom: ds.days[rFrom].start,
    reportTo: ds.days[Math.max(rFrom, rTo - 1)].start + DAY_MS,
    baselineDays: bTo - bFrom,
    reportDays: nR,
    model,
    adjustedBaselineKwh: adj,
    actualKwh: act,
    avoidedKwh: avoided,
    ciKwh: ci,
    savingPct,
    expectedSavingPct: m.expectedSavingPct,
    expectedKwh: (adj * m.expectedSavingPct) / 100,
    avoidedPerMonthKwh: nR > 0 ? (avoided / nR) * 30.4375 : 0,
    status,
    adjustments: {
      productionPct: bTons > 0 ? (rTons / bTons - 1) * 100 : 0,
      tempDeltaC: rTemp - bTemp,
      baselineTons: bTons,
      reportTons: rTons,
    },
    daily,
    investmentAzn: m.investmentAzn,
  };
}

export interface CumulativePoint {
  key: string;
  start: number;
  avoidedKwh: number;
  cumulativeKwh: number;
}

/** Monthly avoided energy summed over measures (reporting periods only), with running total. */
export function cumulativeSavings(results: MeasureResult[]): CumulativePoint[] {
  const byMonth = new Map<string, { start: number; v: number }>();
  for (const r of results) {
    let prev = 0;
    for (const d of r.daily) {
      if (d.period !== 'reporting' || d.cumAvoided === null) continue;
      const k = d.key.slice(0, 7);
      const inc = d.cumAvoided - prev;
      prev = d.cumAvoided;
      const cur = byMonth.get(k) ?? {
        start: new Date(new Date(d.start).getFullYear(), new Date(d.start).getMonth(), 1).getTime(),
        v: 0,
      };
      cur.v += inc;
      byMonth.set(k, cur);
    }
  }
  const keys = [...byMonth.keys()].sort();
  let cum = 0;
  return keys.map((k) => {
    const x = byMonth.get(k)!;
    cum += x.v;
    return { key: k, start: x.start, avoidedKwh: x.v, cumulativeKwh: cum };
  });
}
