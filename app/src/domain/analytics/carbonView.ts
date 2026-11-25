import type { AppConfig, EffectiveRates, SettingsOverrides } from '../../data/config';
import type { EquipmentGroupId, RecommendationState } from '../../data/types';
import {
  annualReductionT,
  cbamAssessment,
  embeddedEmissions,
  emissions,
  scope1Kg,
  scope2Kg,
  type CbamProductGroup,
  type Emissions,
} from '../carbon';
import { DAY_MS, dailyTotals, monthlyTotals, type AnalysisCore } from '../core';
import { forecastPeriod } from '../forecast';
import { combinedMonthlySaving, type RecommendationEngineResult } from '../recommendations';

/**
 * View models for the carbon page (spec 7.9, 5.6, 5.7). Every tonne comes
 * from carbon.ts with the effective factors (config + settings overrides).
 */

// ---------------------------------------------------------------------------
// Year to date and year-end projection

export interface CarbonYear {
  year: number;
  /** day range of the calendar year in the dataset (exclusive end) */
  fromDay: number;
  toDay: number;
  /** actual from 1 January up to now */
  ytd: Emissions & { kwh: number; m3: number; tons: number };
  /** projection of the full calendar year */
  yearEnd: Emissions & { kwh: number; m3: number; tons: number };
  /** share of the projection that is still forecast (0..1) */
  forecastShare: number;
  /** months beyond the forecast horizon filled with the same month of the previous year */
  seasonalMonths: string[];
  daysElapsed: number;
  daysInYear: number;
  targetT: number;
  /** target spread pro rata over the elapsed days */
  ytdTargetT: number;
  /** ytd / target (0..1+) */
  targetUsed: number;
  /** pro-rata target / target (0..1): elapsed share of the year */
  ytdTargetShare: number;
  /** Scope 2 share of the ytd total (0..1) */
  scope2Share: number;
  /** year-end projection vs target, % (positive = above target) */
  yearEndVsTargetPct: number;
  onTrack: boolean;
}

export function carbonYear(
  core: AnalysisCore,
  rates: EffectiveRates,
  engine?: RecommendationEngineResult,
  recStates?: Record<string, RecommendationState>,
): CarbonYear {
  const { ds } = core;
  const today = new Date(ds.days[core.todayDay].start);
  const year = today.getFullYear();
  const yStart = new Date(year, 0, 1).getTime();
  const yEnd = new Date(year + 1, 0, 1).getTime();
  let fromDay = ds.days.findIndex((d) => d.start >= yStart);
  if (fromDay < 0) fromDay = 0;
  let toDay = fromDay;
  while (toDay < ds.days.length && ds.days[toDay].start < yEnd) toDay++;
  const e = dailyTotals(core, core.electricIds);
  const g = dailyTotals(core, core.gasIds);
  let kwh = 0;
  let m3 = 0;
  let tons = 0;
  for (let d = fromDay; d <= core.todayDay && d < toDay; d++) {
    if (!Number.isNaN(e.actual[d])) kwh += e.actual[d];
    if (!Number.isNaN(g.actual[d])) m3 += g.actual[d];
    if (d < core.todayDay) tons += ds.days[d].tons;
  }
  // today: production share up to now
  const td = ds.days[core.todayDay];
  const doneHours = Math.max(0, ds.timeline.nowIndex - td.startIndex);
  tons += td.tons * (doneHours / Math.max(1, td.endIndex - td.startIndex));

  const opts = { fromDay, toDay, engine, recStates };
  const fe = forecastPeriod(core, { ...opts, eqIds: core.electricIds });
  const fg = forecastPeriod(core, { ...opts, eqIds: core.gasIds });
  let yeKwh = fe.total;
  let yeM3 = fg.total;
  let yeTons = ds.days.slice(fromDay, toDay).reduce((s, d) => s + d.tons, 0);
  // months of the year after the data horizon: same month of the previous year
  const seasonalMonths: string[] = [];
  const lastKey = ds.days[ds.days.length - 1].key.slice(0, 7);
  const em = monthlyTotals(core, core.electricIds);
  const gm = monthlyTotals(core, core.gasIds);
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    if (key <= lastKey) continue;
    const prevKey = `${year - 1}-${String(m + 1).padStart(2, '0')}`;
    const pe = em.find((x) => x.key === prevKey && x.complete);
    const pg = gm.find((x) => x.key === prevKey && x.complete);
    if (!pe) continue;
    seasonalMonths.push(key);
    yeKwh += pe.actual;
    yeM3 += pg?.actual ?? 0;
    yeTons += pe.tons;
  }
  const ytd = { ...emissions(kwh, m3, tons, rates), kwh, m3, tons };
  const yearEnd = { ...emissions(yeKwh, yeM3, yeTons, rates), kwh: yeKwh, m3: yeM3, tons: yeTons };
  const daysInYear = Math.round((yEnd - yStart) / DAY_MS);
  const daysElapsed = Math.min(daysInYear, (ds.timeline.nowMs - yStart) / DAY_MS);
  const targetT = rates.annualCo2TargetT;
  return {
    year,
    fromDay,
    toDay,
    ytd,
    yearEnd,
    forecastShare: yearEnd.totalT > 0 ? 1 - ytd.totalT / yearEnd.totalT : 0,
    seasonalMonths,
    daysElapsed,
    daysInYear,
    targetT,
    ytdTargetT: (targetT * daysElapsed) / daysInYear,
    targetUsed: targetT > 0 ? ytd.totalT / targetT : 0,
    ytdTargetShare: daysElapsed / daysInYear,
    scope2Share: ytd.totalT > 0 ? ytd.scope2T / ytd.totalT : 0,
    yearEndVsTargetPct: targetT > 0 ? (yearEnd.totalT / targetT - 1) * 100 : 0,
    onTrack: yearEnd.totalT <= targetT,
  };
}

// ---------------------------------------------------------------------------
// Sources

export interface CarbonSource {
  group: EquipmentGroupId;
  energy: 'electricity' | 'gas';
  scope: 1 | 2;
  /** kWh (electricity) or m³ (gas) */
  amount: number;
  tCo2: number;
  /** share of the total, 0..1 */
  share: number;
}

/** Emissions per equipment group over days [fromDay, toDay), largest first. */
export function carbonBySource(
  core: AnalysisCore,
  rates: EffectiveRates,
  groups: AppConfig['groups'],
  fromDay: number,
  toDay: number,
): CarbonSource[] {
  const rows = groups
    .map((g) => {
      const ids = core.ds.equipment.filter((e) => e.group === g.id).map((e) => e.id);
      const dt = dailyTotals(core, ids);
      let amount = 0;
      for (let d = fromDay; d < toDay; d++) if (!Number.isNaN(dt.actual[d])) amount += dt.actual[d];
      const gas = g.energy === 'gas';
      const kg = gas ? scope1Kg(amount, rates) : scope2Kg(amount, rates);
      return {
        group: g.id,
        energy: g.energy,
        scope: (gas ? 1 : 2) as 1 | 2,
        amount,
        tCo2: kg / 1000,
        share: 0,
      };
    })
    .filter((r) => r.amount > 0);
  const total = rows.reduce((s, r) => s + r.tCo2, 0);
  return rows
    .map((r) => ({ ...r, share: total > 0 ? r.tCo2 / total : 0 }))
    .sort((a, b) => b.tCo2 - a.tCo2);
}

/** Day range of the last `n` complete calendar months. */
export function lastCompleteMonths(core: AnalysisCore, n = 12) {
  const months = monthlyTotals(core, core.electricIds)
    .filter((m) => m.complete)
    .slice(-n);
  if (!months.length) return { fromDay: 0, toDay: 0, months: 0, from: 0, to: 0 };
  const fromDay = months[0].firstDay;
  const toDay = months[months.length - 1].lastDay + 1;
  return {
    fromDay,
    toDay,
    months: months.length,
    from: core.ds.days[fromDay].start,
    to: core.ds.days[toDay - 1].start + DAY_MS,
  };
}

/** Totals over a day range: kWh, m³, tons and emissions. */
export function periodEmissions(
  core: AnalysisCore,
  rates: EffectiveRates,
  fromDay: number,
  toDay: number,
) {
  const e = dailyTotals(core, core.electricIds);
  const g = dailyTotals(core, core.gasIds);
  let kwh = 0;
  let m3 = 0;
  let tons = 0;
  for (let d = fromDay; d < toDay; d++) {
    if (!Number.isNaN(e.actual[d])) kwh += e.actual[d];
    if (!Number.isNaN(g.actual[d])) m3 += g.actual[d];
    tons += core.ds.days[d].tons;
  }
  return { kwh, m3, tons, ...emissions(kwh, m3, tons, rates) };
}

// ---------------------------------------------------------------------------
// Reduction roadmap (waterfall)

export interface RoadmapStep {
  id: string;
  kind: 'start' | 'step' | 'result' | 'target';
  /** bar runs from `from` to `to` (t CO₂e per year) */
  from: number;
  to: number;
  /** signed change for steps, level for start/result/target */
  value: number;
  status?: RecommendationState['status'];
}

/**
 * Waterfall: current annual emissions → incremental reduction of each
 * recommendation (combined without double counting, largest first) →
 * emissions after all of them → annual target. Rejected ones are skipped.
 */
export function reductionRoadmap(
  core: AnalysisCore,
  engine: RecommendationEngineResult,
  states: Record<string, RecommendationState>,
  rates: EffectiveRates,
  currentT: number,
): {
  steps: RoadmapStep[];
  afterT: number;
  targetT: number;
  gapT: number;
  reductionT: number;
  /** "nice" axis bounds that keep the small steps visible */
  axisMin: number;
  axisMax: number;
} {
  const recs = engine.recommendations
    .filter((r) => states[r.id]?.status !== 'rejected')
    .map((r) => ({ r, t: annualReductionT(r.kwhPerMonth, r.m3PerMonth, rates) }))
    .sort((a, b) => b.t - a.t);
  const steps: RoadmapStep[] = [
    { id: 'start', kind: 'start', from: 0, to: currentT, value: currentT },
  ];
  let level = currentT;
  let prev = { kwh: 0, m3: 0 };
  const ids: string[] = [];
  for (const { r } of recs) {
    ids.push(r.id);
    const c = combinedMonthlySaving(core.ds, engine, ids);
    const inc = annualReductionT(c.kwh - prev.kwh, c.m3 - prev.m3, rates);
    prev = c;
    steps.push({
      id: r.id,
      kind: 'step',
      from: level,
      to: level - inc,
      value: -inc,
      status: states[r.id]?.status ?? 'proposed',
    });
    level -= inc;
  }
  steps.push({ id: 'result', kind: 'result', from: 0, to: level, value: level });
  const targetT = rates.annualCo2TargetT;
  steps.push({ id: 'target', kind: 'target', from: 0, to: targetT, value: targetT });
  const lo = Math.min(level, targetT);
  const hi = Math.max(currentT, targetT);
  return {
    steps,
    afterT: level,
    targetT,
    gapT: level - targetT,
    reductionT: currentT - level,
    axisMin: Math.max(0, Math.floor((lo * 0.85) / 100) * 100),
    axisMax: Math.ceil((hi * 1.02) / 100) * 100,
  };
}

// ---------------------------------------------------------------------------
// Factors table

export type FactorId = 'scope1' | 'scope2' | 'gasKwhPerM3' | 'euEtsPrice' | 'eurToAzn';

export interface FactorRow {
  id: FactorId;
  value: number;
  defaultValue: number;
  /** settings override differs from the configured default */
  overridden: boolean;
  source: string;
  sourceUrl: string | null;
  basis: string | null;
  date: string | null;
  lastChecked: string | null;
  verify: boolean;
}

export function factorRows(
  cfg: Pick<AppConfig, 'emissions'>,
  rates: EffectiveRates,
  overrides: SettingsOverrides,
): FactorRow[] {
  const em = cfg.emissions;
  const row = (
    id: FactorId,
    value: number,
    def: number,
    key: keyof SettingsOverrides,
    meta: {
      source: string;
      sourceUrl?: string | null;
      basis?: string;
      date?: string;
      lastChecked: string | null;
      verify: boolean;
    },
  ): FactorRow => ({
    id,
    value,
    defaultValue: def,
    overridden: overrides[key] !== undefined && Math.abs(value - def) > 1e-12,
    source: meta.source,
    sourceUrl: meta.sourceUrl ?? null,
    basis: meta.basis ?? null,
    date: meta.date ?? null,
    lastChecked: meta.lastChecked,
    verify: meta.verify,
  });
  return [
    row('scope1', rates.scope1KgCo2PerKwh, em.scope1.kgCo2PerKwh, 'scope1KgCo2PerKwh', em.scope1),
    row('scope2', rates.scope2KgCo2PerKwh, em.scope2.kgCo2PerKwh, 'scope2KgCo2PerKwh', em.scope2),
    row('gasKwhPerM3', rates.gasKwhPerM3, em.gasKwhPerM3.value, 'gasKwhPerM3', em.gasKwhPerM3),
    row(
      'euEtsPrice',
      rates.euEtsPriceEurPerT,
      em.cbam.euEtsPriceEurPerT,
      'euEtsPriceEurPerT',
      em.cbam,
    ),
    row('eurToAzn', rates.eurToAzn, em.cbam.eurToAzn, 'eurToAzn', em.cbam),
  ];
}

// ---------------------------------------------------------------------------
// CBAM (spec 5.7)

export const CBAM_GROUPS: CbamProductGroup[] = [
  'cement',
  'iron_steel',
  'aluminium',
  'fertilisers',
  'electricity',
  'hydrogen',
  'plastics',
  'other',
];

/** Groups the single mass-based threshold (50 t) does not apply to (Reg. 2025/2083). */
export const CBAM_NO_THRESHOLD: CbamProductGroup[] = ['electricity', 'hydrogen'];

/** Goods for which only direct emissions count (Annex II of Reg. 2023/956 as amended). */
export const CBAM_DIRECT_ONLY: CbamProductGroup[] = [
  'iron_steel',
  'aluminium',
  'hydrogen',
  'electricity',
];

export type CbamBasis = 'direct' | 'total';

export function cbamDefaultBasis(group: CbamProductGroup): CbamBasis {
  return CBAM_DIRECT_ONLY.includes(group) ? 'direct' : 'total';
}

export interface CbamCheckInput {
  group: CbamProductGroup;
  exportsToEu: boolean;
  exportTonnesPerYear: number;
  coveredGroups: string[];
  thresholdT: number;
}

export type CbamVerdict = 'not_covered' | 'no_eu_export' | 'below_threshold' | 'liable';

export interface CbamCheck {
  inScope: boolean;
  thresholdApplies: boolean;
  belowThreshold: boolean;
  liable: boolean;
  verdict: CbamVerdict;
}

/** "Does your product fall under CBAM?" checklist result. */
export function cbamCheck(i: CbamCheckInput): CbamCheck {
  const inScope = i.coveredGroups.includes(i.group);
  const thresholdApplies = !CBAM_NO_THRESHOLD.includes(i.group);
  const belowThreshold = thresholdApplies && i.exportTonnesPerYear < i.thresholdT;
  const liable = inScope && i.exportsToEu && !belowThreshold;
  const verdict: CbamVerdict = !inScope
    ? 'not_covered'
    : !i.exportsToEu
      ? 'no_eu_export'
      : belowThreshold
        ? 'below_threshold'
        : 'liable';
  return { inScope, thresholdApplies, belowThreshold, liable, verdict };
}

export interface EmbeddedPerUnit {
  directTPerT: number;
  indirectTPerT: number;
  totalTPerT: number;
  /** same per ton in kg CO₂e */
  directKgPerT: number;
  indirectKgPerT: number;
  totalKgPerT: number;
  /** per product unit of `unitMassKg` (kg CO₂e) */
  directKgPerUnit: number;
  indirectKgPerUnit: number;
  totalKgPerUnit: number;
}

/** Embedded emissions per ton and per product unit from plant totals. */
export function embeddedPerUnit(
  kwh: number,
  m3: number,
  tons: number,
  rates: EffectiveRates,
  unitMassKg: number,
): EmbeddedPerUnit {
  const e = embeddedEmissions(kwh, m3, tons, rates);
  const indirect = e.totalTPerT - e.directTPerT;
  const perUnit = (tPerT: number) => tPerT * Math.max(0, unitMassKg);
  return {
    directTPerT: e.directTPerT,
    indirectTPerT: indirect,
    totalTPerT: e.totalTPerT,
    directKgPerT: e.directTPerT * 1000,
    indirectKgPerT: indirect * 1000,
    totalKgPerT: e.totalTPerT * 1000,
    // t/t × kg = kg
    directKgPerUnit: perUnit(e.directTPerT),
    indirectKgPerUnit: perUnit(indirect),
    totalKgPerUnit: perUnit(e.totalTPerT),
  };
}

export interface CbamCostInput {
  group: CbamProductGroup;
  exportsToEu: boolean;
  exportTonnesPerYear: number;
  basis: CbamBasis;
  embedded: EmbeddedPerUnit;
  euEtsPriceEurPerT: number;
  domesticCarbonPriceEur: number;
  coveredGroups: string[];
  thresholdT: number;
  rates: EffectiveRates;
}

/**
 * Estimated annual CBAM cost of an export volume. Upper estimate: the free
 * allocation adjustment (phased out 2026–2034) is not deducted.
 */
export function cbamCost(i: CbamCostInput) {
  const check = cbamCheck(i);
  const perT = i.basis === 'direct' ? i.embedded.directTPerT : i.embedded.totalTPerT;
  const res = cbamAssessment({
    productGroup: i.group,
    coveredGroups: i.coveredGroups,
    exportTonnesPerYear: i.exportTonnesPerYear,
    exportsToEu: i.exportsToEu,
    embeddedTPerT: perT,
    domesticCarbonPriceEur: i.domesticCarbonPriceEur,
    freeThresholdTonnesPerYear: check.thresholdApplies ? i.thresholdT : 0,
    rates: { ...i.rates, euEtsPriceEurPerT: i.euEtsPriceEurPerT },
  });
  return { ...res, check, embeddedTPerT: perT, embeddedKgPerT: perT * 1000 };
}

/** Example export volume for the CBAM scenario: a share of the last 12 months' production, rounded. */
export function exampleExportTonnes(annualTons: number, share = 0.1): number {
  return Math.max(0, Math.round((annualTons * share) / 10) * 10);
}
