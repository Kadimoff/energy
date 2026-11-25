import { baseConfig, type AppConfig, type EffectiveRates } from '../data/config';
import type {
  AnomalyRule,
  EnergyCarrier,
  EquipmentGroupId,
  RecommendationState,
  RecommendationStatus,
  Effort,
  Severity,
} from '../data/types';
import type { Analysis } from '../domain/analysis';
import { degreeDays, dailyBand } from '../domain/baseline';
import { annualReductionT, emissions, type Emissions } from '../domain/carbon';
import { electricityCost, energyValue, gasCost } from '../domain/cost';
import { dailyTotals, monthlyTotals } from '../domain/core';
import {
  electricityBudgetForecast,
  forecastPeriod,
  gasBudgetForecast,
  monthDayRange,
  type BudgetForecast,
} from '../domain/forecast';
import type { MeasureResult, MvStatus } from '../domain/mv';
import { combinedMonthlySaving } from '../domain/recommendations';
import {
  carbonByMonth,
  type AnomalyVM,
  type CarbonMonth,
  type RecommendationVM,
} from '../domain/viewmodels';
import type { ReportTemplateId } from './ReportService.schedule';

/**
 * ReportService: builds report view models (spec 7.11) from domain results.
 * Pure functions only: every number comes from src/domain with the effective
 * rates (config + Settings overrides). The UI formats and renders.
 */

export type { ReportTemplateId } from './ReportService.schedule';

export interface MeasureVM extends MeasureResult {
  avoidedAzn: number;
  avoidedPerMonthAzn: number;
}

export interface ReportPlant {
  name: string;
  sector: string;
  location: string;
  areaM2: number;
  /** area or schedule differs from the profile the baseline was built with */
  staticFactorsChanged: boolean;
}

export interface ReportInputs {
  analysis: Analysis;
  rates: EffectiveRates;
  recStates: Record<string, RecommendationState>;
  recommendations: RecommendationVM[];
  anomalies: AnomalyVM[];
  measures: MeasureVM[];
  plant: ReportPlant;
  /** yyyy-MM of the reporting month */
  monthKey: string;
  /** "last checked" dates edited in Settings */
  checked?: Partial<Record<string, string>>;
  config?: AppConfig;
}

// ---------------------------------------------------------------------------
// Periods

export interface ReportPeriod {
  key: string;
  start: number;
  /** day indices [fromDay, toDay) */
  fromDay: number;
  toDay: number;
  isCurrent: boolean;
  complete: boolean;
}

/** Reportable months, most recent first (current month included). */
export function reportPeriods(a: Analysis): ReportPeriod[] {
  return monthlyTotals(a, a.electricIds)
    .map((m) => ({
      key: m.key,
      start: m.start,
      fromDay: m.firstDay,
      toDay: m.lastDay + 1,
      isCurrent: m.isCurrent,
      complete: m.complete,
    }))
    .reverse();
}

function periodOf(a: Analysis, key: string): ReportPeriod {
  const ps = reportPeriods(a);
  return ps.find((p) => p.key === key) ?? ps[0];
}

// ---------------------------------------------------------------------------
// Month figures (shared by all templates)

export type BudgetState = 'within' | 'risk' | 'overrun_expected' | 'overrun';

export interface BudgetLine {
  energy: EnergyCarrier;
  budgetAzn: number;
  /** cost of complete days */
  costToDateAzn: number;
  /** month-end forecast (current month) or the actual cost (closed month) */
  projectedAzn: number;
  p10Azn: number;
  p90Azn: number;
  /** projected − budget (positive = overrun) */
  overrunAzn: number;
  usedPct: number;
  /** overrun probability 0..1, null for a closed month */
  probability: number | null;
  state: BudgetState;
}

export interface MonthFigures {
  period: ReportPeriod;
  /** complete days used for "to date" figures */
  days: number;
  daysInMonth: number;
  kwh: number;
  m3: number;
  tons: number;
  optimalKwh: number;
  enpi: number;
  enpiTarget: number;
  /** same number of days of the previous month */
  prev: { kwh: number; tons: number; enpi: number; costAzn: number; co2T: number };
  kwhForecast: number;
  m3Forecast: number;
  electricity: BudgetLine;
  gas: BudgetLine;
  totalCostToDateAzn: number;
  totalProjectedAzn: number;
  totalBudgetAzn: number;
  wasteKwh: number;
  wasteM3: number;
  wasteAzn: number;
  /** electricity waste share of consumption, % */
  wasteSharePct: number;
  co2: Emissions;
  co2ForecastT: number;
  /** monthly share of the annual reduction target (same method as the overview page) */
  co2MonthlyTargetT: number;
}

const nanSafe = (v: number) => (Number.isNaN(v) ? 0 : v);

function sumDays(arr: Float64Array, from: number, to: number) {
  let s = 0;
  for (let d = from; d < to; d++) s += nanSafe(arr[d]);
  return s;
}

function budgetLine(
  energy: EnergyCarrier,
  fc: BudgetForecast,
  costToDate: number,
  complete: boolean,
): BudgetLine {
  const projected = fc.costMean;
  const prob = complete ? null : fc.overrunProbability;
  const state: BudgetState = complete
    ? projected > fc.budgetAzn
      ? 'overrun'
      : 'within'
    : (prob ?? 0) >= 0.5
      ? 'overrun_expected'
      : (prob ?? 0) >= 0.2
        ? 'risk'
        : 'within';
  return {
    energy,
    budgetAzn: fc.budgetAzn,
    costToDateAzn: costToDate,
    projectedAzn: projected,
    p10Azn: fc.costP10,
    p90Azn: fc.costP90,
    overrunAzn: fc.overrunAzn,
    usedPct: fc.budgetAzn > 0 ? (projected / fc.budgetAzn) * 100 : 0,
    probability: prob,
    state,
  };
}

/** CO₂ monthly target: (last 12 complete months) × (1 − reduction %) / 12. */
function monthlyCo2Target(months: CarbonMonth[], rates: EffectiveRates): number {
  const base = months
    .filter((m) => m.complete)
    .slice(-12)
    .reduce((s, m) => s + m.totalT, 0);
  return (base * (1 - rates.annualCo2ReductionPct / 100)) / 12;
}

export function monthFigures(
  a: Analysis,
  rates: EffectiveRates,
  recStates: Record<string, RecommendationState>,
  period: ReportPeriod,
): MonthFigures {
  const { ds } = a;
  const { fromDay, toDay } = period;
  const elecFc = electricityBudgetForecast(
    forecastPeriod(a, { eqIds: a.electricIds, fromDay, toDay, engine: a.engine, recStates }),
    rates,
  );
  const gasFc = gasBudgetForecast(
    forecastPeriod(a, { eqIds: a.gasIds, fromDay, toDay, engine: a.engine, recStates }),
    rates,
  );
  const e = dailyTotals(a, a.electricIds);
  const g = dailyTotals(a, a.gasIds);
  const lastComplete = Math.min(toDay, a.todayDay);
  const n = Math.max(0, lastComplete - fromDay);
  const kwh = sumDays(e.actual, fromDay, lastComplete);
  const m3 = sumDays(g.actual, fromDay, lastComplete);
  const tons = ds.days.slice(fromDay, lastComplete).reduce((s, d) => s + d.tons, 0);
  const optimalKwh = sumDays(e.expected, fromDay, lastComplete);
  const wasteKwh = sumDays(e.waste, fromDay, lastComplete);
  const wasteM3 = sumDays(g.waste, fromDay, lastComplete);
  // previous month, same number of days
  const prevStart = new Date(period.start);
  const prevKey = `${new Date(prevStart.getFullYear(), prevStart.getMonth() - 1, 1).getFullYear()}-${String(
    new Date(prevStart.getFullYear(), prevStart.getMonth() - 1, 1).getMonth() + 1,
  ).padStart(2, '0')}`;
  const prevFrom = ds.days.findIndex((d) => d.key.startsWith(prevKey));
  let prev = { kwh: 0, tons: 0, enpi: 0, costAzn: 0, co2T: 0 };
  if (prevFrom >= 0) {
    const to = Math.min(prevFrom + n, fromDay);
    const pk = sumDays(e.actual, prevFrom, to);
    const pm = sumDays(g.actual, prevFrom, to);
    const pt = ds.days.slice(prevFrom, to).reduce((s, d) => s + d.tons, 0);
    prev = {
      kwh: pk,
      tons: pt,
      enpi: pt > 0 ? pk / pt : 0,
      costAzn: electricityCost(pk, rates) + gasCost(pm, rates),
      co2T: emissions(pk, pm, pt, rates).totalT,
    };
  }
  const elecCost = electricityCost(kwh, rates);
  const gCost = gasCost(m3, rates);
  const electricity = budgetLine('electricity', elecFc, elecCost, period.complete);
  const gas = budgetLine('gas', gasFc, gCost, period.complete);
  const co2 = emissions(kwh, m3, tons, rates);
  return {
    period,
    days: n,
    daysInMonth: toDay - fromDay,
    kwh,
    m3,
    tons,
    optimalKwh,
    enpi: tons > 0 ? kwh / tons : 0,
    enpiTarget: rates.enpiTargetKwhPerT,
    prev,
    kwhForecast: elecFc.total,
    m3Forecast: gasFc.total,
    electricity,
    gas,
    totalCostToDateAzn: elecCost + gCost,
    totalProjectedAzn: electricity.projectedAzn + gas.projectedAzn,
    totalBudgetAzn: rates.electricityBudgetAzn + rates.gasBudgetAzn,
    wasteKwh,
    wasteM3,
    wasteAzn: energyValue(wasteKwh, wasteM3, rates),
    wasteSharePct: kwh > 0 ? (wasteKwh / kwh) * 100 : 0,
    co2,
    co2ForecastT: emissions(elecFc.total, gasFc.total, 0, rates).totalT,
    co2MonthlyTargetT: monthlyCo2Target(carbonByMonth(a, rates), rates),
  };
}

// ---------------------------------------------------------------------------
// Building blocks

export interface WasteItem {
  eqId: string;
  code: string;
  name: string;
  group: EquipmentGroupId;
  energy: EnergyCarrier;
  /** kWh or m³ above the optimal band */
  waste: number;
  wasteAzn: number;
  /** share of the month's total waste value, % */
  sharePct: number;
  /** most costly anomaly rule on this equipment in the period */
  rule: AnomalyRule | null;
}

export function topWaste(i: ReportInputs, period: ReportPeriod, limit = 3): WasteItem[] {
  const a = i.analysis;
  const last = Math.min(period.toDay, a.todayDay);
  const from = a.ds.days[period.fromDay].start;
  const to = a.ds.days[period.toDay - 1].start + 86_400_000;
  const items = a.ds.equipment.map((eq) => {
    const dt = dailyTotals(a, [eq.id]);
    const w = sumDays(dt.waste, period.fromDay, last);
    const azn =
      eq.energy === 'gas' ? w * i.rates.gasRateAznPerM3 : w * i.rates.electricityRateAznPerKwh;
    const related = i.anomalies
      .filter((x) => x.equipmentIds.includes(eq.id) && x.start < to && x.end >= from)
      .sort((x, y) => y.lossAzn - x.lossAzn)[0];
    return {
      eqId: eq.id,
      code: eq.code,
      name: eq.name,
      group: eq.group,
      energy: eq.energy,
      waste: w,
      wasteAzn: azn,
      sharePct: 0,
      rule: related?.rule ?? null,
    };
  });
  const total = items.reduce((s, x) => s + x.wasteAzn, 0);
  return items
    .filter((x) => x.wasteAzn > 0)
    .sort((x, y) => y.wasteAzn - x.wasteAzn)
    .slice(0, limit)
    .map((x) => ({ ...x, sharePct: total > 0 ? (x.wasteAzn / total) * 100 : 0 }));
}

export interface SavingsItem {
  id: string;
  status: MvStatus;
  method: 'B' | 'C';
  expectedPct: number;
  savingPct: number;
  avoidedKwh: number;
  avoidedAzn: number;
  avoidedPerMonthKwh: number;
  avoidedPerMonthAzn: number;
  ciKwh: number;
  reportDays: number;
  implementedAt: number;
}

export interface SavingsBlock {
  items: SavingsItem[];
  verifiedCount: number;
  /** verified (incl. below expected) measures, per month */
  verifiedPerMonthKwh: number;
  verifiedPerMonthAzn: number;
  verifiedPerYearTCo2: number;
  cumulativeKwh: number;
  cumulativeAzn: number;
}

export function savingsBlock(measures: MeasureVM[], rates: EffectiveRates): SavingsBlock {
  const items: SavingsItem[] = measures.map((m) => ({
    id: m.id,
    status: m.status,
    method: m.method,
    expectedPct: m.expectedSavingPct,
    savingPct: m.savingPct,
    avoidedKwh: m.avoidedKwh,
    avoidedAzn: m.avoidedAzn,
    avoidedPerMonthKwh: m.avoidedPerMonthKwh,
    avoidedPerMonthAzn: m.avoidedPerMonthAzn,
    ciKwh: m.ciKwh,
    reportDays: m.reportDays,
    implementedAt: m.implementedAt,
  }));
  const ver = items.filter((m) => m.status !== 'measuring');
  const perMonthKwh = ver.reduce((s, m) => s + m.avoidedPerMonthKwh, 0);
  return {
    items,
    verifiedCount: ver.length,
    verifiedPerMonthKwh: perMonthKwh,
    verifiedPerMonthAzn: ver.reduce((s, m) => s + m.avoidedPerMonthAzn, 0),
    verifiedPerYearTCo2: annualReductionT(perMonthKwh, 0, rates),
    cumulativeKwh: ver.reduce((s, m) => s + m.avoidedKwh, 0),
    cumulativeAzn: ver.reduce((s, m) => s + m.avoidedAzn, 0),
  };
}

export interface RecItem {
  id: string;
  status: RecommendationStatus;
  effort: Effort;
  aznPerMonth: number;
  kwhPerMonth: number;
  m3PerMonth: number;
  tCo2PerYear: number;
  confidence: number;
  paybackMonths: number;
  investmentAzn: number;
}

const recItem = (r: RecommendationVM): RecItem => ({
  id: r.id,
  status: r.status,
  effort: r.effort,
  aznPerMonth: r.aznPerMonth,
  kwhPerMonth: r.kwhPerMonth,
  m3PerMonth: r.m3PerMonth,
  tCo2PerYear: r.tCo2PerYear,
  confidence: r.confidence,
  paybackMonths: r.paybackMonths,
  investmentAzn: r.investmentAzn,
});

export interface NextMonthBlock {
  /** top proposed recommendations by monthly value */
  items: RecItem[];
  /** combined saving of `items` (no double counting) */
  combinedAznPerMonth: number;
  combinedTCo2PerYear: number;
  /** next calendar month forecast (only when reporting the current month) */
  forecast: {
    start: number;
    costAzn: number;
    budgetAzn: number;
    probability: number;
    /** same, with the listed recommendations approved */
    costWithRecsAzn: number;
    probabilityWithRecs: number;
  } | null;
}

export function nextMonthBlock(i: ReportInputs, period: ReportPeriod, limit = 3): NextMonthBlock {
  const a = i.analysis;
  const items = i.recommendations
    .filter((r) => r.status === 'proposed')
    .sort((x, y) => y.aznPerMonth - x.aznPerMonth)
    .slice(0, limit)
    .map(recItem);
  const comb = combinedMonthlySaving(
    a.ds,
    a.engine,
    items.map((r) => r.id),
  );
  let forecast: NextMonthBlock['forecast'] = null;
  const next = monthDayRange(a, 1);
  if (period.isCurrent && next.toDay > next.fromDay) {
    const base = electricityBudgetForecast(
      forecastPeriod(a, {
        eqIds: a.electricIds,
        ...next,
        engine: a.engine,
        recStates: i.recStates,
      }),
      i.rates,
    );
    const now = a.ds.timeline.nowMs;
    const withRecs: Record<string, RecommendationState> = { ...i.recStates };
    for (const r of items) withRecs[r.id] = { status: 'approved', updatedAt: now };
    const better = electricityBudgetForecast(
      forecastPeriod(a, { eqIds: a.electricIds, ...next, engine: a.engine, recStates: withRecs }),
      i.rates,
    );
    forecast = {
      start: a.ds.days[next.fromDay].start,
      costAzn: base.costMean,
      budgetAzn: base.budgetAzn,
      probability: base.overrunProbability,
      costWithRecsAzn: better.costMean,
      probabilityWithRecs: better.overrunProbability,
    };
  }
  return {
    items,
    combinedAznPerMonth: energyValue(comb.kwh, comb.m3, i.rates),
    combinedTCo2PerYear: annualReductionT(comb.kwh, comb.m3, i.rates),
    forecast,
  };
}

export interface DailyPoint {
  t: number;
  actual: number | null;
  optimal: number;
  lower: number;
  upper: number;
  forecast: number | null;
}

/** Daily electricity points of the month (actual, optimal band, forecast). */
export function dailySeries(
  a: Analysis,
  recStates: Record<string, RecommendationState>,
  period: ReportPeriod,
): DailyPoint[] {
  const fc = forecastPeriod(a, {
    eqIds: a.electricIds,
    fromDay: period.fromDay,
    toDay: period.toDay,
    engine: a.engine,
    recStates,
  });
  return fc.days.map((d) => ({
    t: d.start,
    actual: d.dayIndex < a.todayDay ? (d.actual ?? 0) : null,
    optimal: d.optimal,
    lower: d.optimalLower,
    upper: d.optimalUpper,
    forecast: d.dayIndex >= a.todayDay ? d.total : null,
  }));
}

// ---------------------------------------------------------------------------
// Templates

interface ReportBase {
  template: ReportTemplateId;
  plant: ReportPlant;
  period: ReportPeriod;
  generatedAt: number;
  rates: EffectiveRates;
}

export interface DirectorReport extends ReportBase {
  template: 'director';
  figures: MonthFigures;
  topWaste: WasteItem[];
  savings: SavingsBlock;
  next: NextMonthBlock;
  daily: DailyPoint[];
}

export interface GroupRow {
  group: EquipmentGroupId;
  energy: EnergyCarrier;
  actual: number;
  optimal: number;
  waste: number;
  wastePct: number;
  wasteAzn: number;
}

export interface EnergyManagerReport extends ReportBase {
  template: 'energy_manager';
  figures: MonthFigures;
  groups: GroupRow[];
  peakKw: number;
  peakLimitKw: number;
  anomalies: {
    items: AnomalyVM[];
    total: number;
    open: number;
    bySeverity: Record<Severity, number>;
    lossAzn: number;
  };
  pipeline: {
    counts: Record<RecommendationStatus, number>;
    active: RecItem[];
    proposed: RecItem[];
  };
  savings: SavingsBlock;
  model: { r2: number; cvRmsePct: number; n: number; lowReliability: boolean; cvWarnPct: number };
  topWaste: WasteItem[];
  daily: DailyPoint[];
}

export interface FactorRow {
  id: 'scope1' | 'scope2' | 'gasKwhPerM3';
  value: number;
  defaultValue: number;
  overridden: boolean;
  source: string;
  basis: string | null;
  date: string | null;
  lastChecked: string | null;
  verify: boolean;
}

export interface CarbonReport extends ReportBase {
  template: 'carbon';
  figures: MonthFigures;
  months: CarbonMonth[];
  rolling: {
    months: number;
    scope1T: number;
    scope2T: number;
    totalT: number;
    intensityKgPerT: number;
    tons: number;
  };
  target: {
    baselineT: number;
    reductionPct: number;
    targetT: number;
    absoluteTargetT: number;
    acceptedTPerYear: number;
    potentialTPerYear: number;
    verifiedTPerYear: number;
    gapT: number;
    /** share of the required reduction covered by accepted + proposed recommendations, % */
    coveragePct: number;
  };
  sources: { group: EquipmentGroupId; scope: 1 | 2; t: number; sharePct: number }[];
  factors: FactorRow[];
}

export interface IsoReport extends ReportBase {
  template: 'iso50001';
  figures: MonthFigures;
  baseline: {
    fromKey: string;
    toKey: string;
    fromStart: number;
    toStart: number;
    months: number;
    kwh: number;
    tons: number;
    enpi: number;
  };
  reporting: { days: number; kwh: number; tons: number; enpi: number };
  enpiChangePct: number;
  normalized: { adjustedBaselineKwh: number; actualKwh: number; improvementPct: number };
  variables: {
    tons: number;
    cdd: number;
    hdd: number;
    productionHours: number;
    baseTonsPerDay: number;
    baseCddPerDay: number;
    baseHddPerDay: number;
    baseHoursPerDay: number;
    days: number;
  };
  staticFactors: { areaM2: number; equipmentCount: number; changed: boolean };
  model: {
    coef: { a: number; b: number; c: number; d: number; e: number };
    r2: number;
    cvRmsePct: number;
    n: number;
    lowReliability: boolean;
  };
  seu: { group: EquipmentGroupId; kwh: number; sharePct: number; significant: boolean }[];
  targets: {
    energyReductionPct: number;
    energyTargetKwhPerYear: number;
    baselineKwhPerYear: number;
    enpiTarget: number;
    enpiActual: number;
    co2ReductionPct: number;
  };
  actions: { counts: Record<RecommendationStatus, number>; active: RecItem[] };
  savings: SavingsBlock;
}

export type Report = DirectorReport | EnergyManagerReport | CarbonReport | IsoReport;

function base(i: ReportInputs, template: ReportTemplateId): ReportBase & { figures: MonthFigures } {
  const period = periodOf(i.analysis, i.monthKey);
  return {
    template,
    plant: i.plant,
    period,
    generatedAt: i.analysis.ds.timeline.nowMs,
    rates: i.rates,
    figures: monthFigures(i.analysis, i.rates, i.recStates, period),
  };
}

export function buildDirectorReport(i: ReportInputs): DirectorReport {
  const b = base(i, 'director');
  return {
    ...b,
    template: 'director',
    topWaste: topWaste(i, b.period, 3),
    savings: savingsBlock(i.measures, i.rates),
    next: nextMonthBlock(i, b.period, 3),
    daily: dailySeries(i.analysis, i.recStates, b.period),
  };
}

const STATUSES: RecommendationStatus[] = [
  'proposed',
  'approved',
  'scheduled',
  'in_progress',
  'measuring',
  'verified',
  'rejected',
];

function statusCounts(recs: RecommendationVM[]): Record<RecommendationStatus, number> {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<RecommendationStatus, number>;
  for (const r of recs) c[r.status] += 1;
  return c;
}

function groupRows(i: ReportInputs, period: ReportPeriod): GroupRow[] {
  const a = i.analysis;
  const last = Math.min(period.toDay, a.todayDay);
  return a.ds.groups
    .map((g) => {
      const ids = a.ds.equipment.filter((e) => e.group === g.id).map((e) => e.id);
      const dt = dailyTotals(a, ids);
      const act = sumDays(dt.actual, period.fromDay, last);
      const opt = sumDays(dt.expected, period.fromDay, last);
      const w = sumDays(dt.waste, period.fromDay, last);
      return {
        group: g.id,
        energy: g.energy,
        actual: act,
        optimal: opt,
        waste: w,
        wastePct: act > 0 ? (w / act) * 100 : 0,
        wasteAzn:
          g.energy === 'gas' ? w * i.rates.gasRateAznPerM3 : w * i.rates.electricityRateAznPerKwh,
      };
    })
    .filter((r) => r.actual > 0)
    .sort((x, y) =>
      x.energy === y.energy ? y.actual - x.actual : x.energy === 'electricity' ? -1 : 1,
    );
}

/** Highest hourly electric load (kW) inside the period's measured hours. */
export function peakLoadKw(a: Analysis, period: ReportPeriod): number {
  const from = a.ds.days[period.fromDay].startIndex;
  const to = Math.min(a.ds.days[period.toDay - 1].endIndex, a.ds.timeline.nowIndex);
  let peak = 0;
  for (let h = from; h < to; h++) {
    let s = 0;
    for (const id of a.electricIds) s += nanSafe(a.ds.readings[id][h]);
    if (s > peak) peak = s;
  }
  return peak;
}

export function buildEnergyManagerReport(i: ReportInputs): EnergyManagerReport {
  const b = base(i, 'energy_manager');
  const a = i.analysis;
  const from = a.ds.days[b.period.fromDay].start;
  const to = a.ds.days[b.period.toDay - 1].start + 86_400_000;
  const inPeriod = i.anomalies.filter((x) => x.start < to && x.end >= from);
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const x of inPeriod) bySeverity[x.severity] += 1;
  const cfg = i.config ?? baseConfig;
  return {
    ...b,
    template: 'energy_manager',
    groups: groupRows(i, b.period),
    peakKw: peakLoadKw(a, b.period),
    peakLimitKw: a.ds.plant.peakLimitKw,
    anomalies: {
      items: [...inPeriod].sort((x, y) => y.lossAzn - x.lossAzn).slice(0, 6),
      total: inPeriod.length,
      open: inPeriod.filter((x) => x.status === 'open' || x.status === 'investigating').length,
      bySeverity,
      lossAzn: inPeriod.reduce((s, x) => s + x.lossAzn, 0),
    },
    pipeline: {
      counts: statusCounts(i.recommendations),
      active: i.recommendations
        .filter((r) => ['approved', 'scheduled', 'in_progress', 'measuring'].includes(r.status))
        .map(recItem),
      proposed: i.recommendations
        .filter((r) => r.status === 'proposed')
        .slice(0, 5)
        .map(recItem),
    },
    savings: savingsBlock(i.measures, i.rates),
    model: {
      r2: a.plantModel.r2,
      cvRmsePct: a.plantModel.cvRmsePct,
      n: a.plantModel.n,
      lowReliability: a.plantModel.lowReliability,
      cvWarnPct: cfg.analysis.cvrmseWarnPct,
    },
    topWaste: topWaste(i, b.period, 5),
    daily: dailySeries(a, i.recStates, b.period),
  };
}

function factorRows(i: ReportInputs): FactorRow[] {
  const cfg = i.config ?? baseConfig;
  const em = cfg.emissions;
  const checked = i.checked ?? {};
  return [
    {
      id: 'scope2',
      value: i.rates.scope2KgCo2PerKwh,
      defaultValue: em.scope2.kgCo2PerKwh,
      overridden: i.rates.scope2KgCo2PerKwh !== em.scope2.kgCo2PerKwh,
      source: em.scope2.source,
      basis: em.scope2.basis ?? null,
      date: em.scope2.date ?? null,
      lastChecked: checked['emission.scope2'] ?? em.scope2.lastChecked,
      verify: em.scope2.verify,
    },
    {
      id: 'scope1',
      value: i.rates.scope1KgCo2PerKwh,
      defaultValue: em.scope1.kgCo2PerKwh,
      overridden: i.rates.scope1KgCo2PerKwh !== em.scope1.kgCo2PerKwh,
      source: em.scope1.source,
      basis: em.scope1.basis ?? null,
      date: em.scope1.date ?? null,
      lastChecked: checked['emission.scope1'] ?? em.scope1.lastChecked,
      verify: em.scope1.verify,
    },
    {
      id: 'gasKwhPerM3',
      value: i.rates.gasKwhPerM3,
      defaultValue: em.gasKwhPerM3.value,
      overridden: i.rates.gasKwhPerM3 !== em.gasKwhPerM3.value,
      source: em.gasKwhPerM3.source,
      basis: null,
      date: null,
      lastChecked: checked['emission.gasKwhPerM3'] ?? em.gasKwhPerM3.lastChecked,
      verify: em.gasKwhPerM3.verify,
    },
  ];
}

export function buildCarbonReport(i: ReportInputs): CarbonReport {
  const b = base(i, 'carbon');
  const a = i.analysis;
  const all = carbonByMonth(a, i.rates);
  const idx = all.findIndex((m) => m.key === b.period.key);
  const months = all.slice(Math.max(0, idx - 11), idx + 1);
  const rollingMonths = months.filter((m) => m.complete || m.key === b.period.key);
  const s1 = rollingMonths.reduce((s, m) => s + m.scope1T, 0);
  const s2 = rollingMonths.reduce((s, m) => s + m.scope2T, 0);
  const tons = rollingMonths.reduce((s, m) => s + m.tons, 0);
  const baselineT = all
    .filter((m) => m.complete)
    .slice(-12)
    .reduce((s, m) => s + m.totalT, 0);
  const targetT = baselineT * (1 - i.rates.annualCo2ReductionPct / 100);
  const active = i.recommendations.filter((r) =>
    ['approved', 'scheduled', 'in_progress', 'measuring', 'verified'].includes(r.status),
  );
  const proposed = i.recommendations.filter((r) => r.status === 'proposed');
  const acc = combinedMonthlySaving(
    a.ds,
    a.engine,
    active.map((r) => r.id),
  );
  const pot = combinedMonthlySaving(
    a.ds,
    a.engine,
    proposed.map((r) => r.id),
  );
  const acceptedTPerYear = annualReductionT(acc.kwh, acc.m3, i.rates);
  const potentialTPerYear = annualReductionT(pot.kwh, pot.m3, i.rates);
  const savings = savingsBlock(i.measures, i.rates);
  const gapT = Math.max(0, baselineT - targetT);
  // sources in the selected month (complete days)
  const last = Math.min(b.period.toDay, a.todayDay);
  const src = a.ds.groups
    .map((g) => {
      const ids = a.ds.equipment.filter((e) => e.group === g.id).map((e) => e.id);
      const v = sumDays(dailyTotals(a, ids).actual, b.period.fromDay, last);
      const t =
        g.energy === 'gas'
          ? emissions(0, v, 0, i.rates).scope1T
          : emissions(v, 0, 0, i.rates).scope2T;
      return { group: g.id, scope: (g.energy === 'gas' ? 1 : 2) as 1 | 2, t };
    })
    .filter((x) => x.t > 0);
  const srcTotal = src.reduce((s, x) => s + x.t, 0);
  return {
    ...b,
    template: 'carbon',
    months,
    rolling: {
      months: rollingMonths.length,
      scope1T: s1,
      scope2T: s2,
      totalT: s1 + s2,
      tons,
      intensityKgPerT: tons > 0 ? ((s1 + s2) * 1000) / tons : 0,
    },
    target: {
      baselineT,
      reductionPct: i.rates.annualCo2ReductionPct,
      targetT,
      absoluteTargetT: i.rates.annualCo2TargetT,
      acceptedTPerYear,
      potentialTPerYear,
      verifiedTPerYear: savings.verifiedPerYearTCo2,
      gapT,
      coveragePct: gapT > 0 ? ((acceptedTPerYear + potentialTPerYear) / gapT) * 100 : 100,
    },
    sources: src
      .map((x) => ({ ...x, sharePct: srcTotal > 0 ? (x.t / srcTotal) * 100 : 0 }))
      .sort((x, y) => y.t - x.t),
    factors: factorRows(i),
  };
}

export function buildIsoReport(i: ReportInputs): IsoReport {
  const b = base(i, 'iso50001');
  const a = i.analysis;
  const { ds } = a;
  const e = dailyTotals(a, a.electricIds);
  const months = monthlyTotals(a, a.electricIds);
  const idx = months.findIndex((m) => m.key === b.period.key);
  // EnB: the 12 complete months before the reporting month (fewer when history is short)
  const before = months.slice(0, Math.max(0, idx)).filter((m) => m.complete);
  const baseMonths = (before.length ? before : months.filter((m) => m.complete)).slice(-12);
  const baseFrom = baseMonths[0]?.firstDay ?? 0;
  const baseTo = (baseMonths[baseMonths.length - 1]?.lastDay ?? 0) + 1;
  const baseKwh = baseMonths.reduce((s, m) => s + m.actual, 0);
  const baseTons = baseMonths.reduce((s, m) => s + m.tons, 0);
  const baseDays = Math.max(1, baseTo - baseFrom);
  const climate = ds.plant.climate;
  let bc = 0;
  let bh = 0;
  let bHours = 0;
  for (let d = baseFrom; d < baseTo; d++) {
    const dd = degreeDays(ds.days[d].meanTempC, climate.cddBaseC, climate.hddBaseC);
    bc += dd.cdd;
    bh += dd.hdd;
    bHours += ds.days[d].productionHours;
  }
  // reporting period: complete days of the month
  const last = Math.min(b.period.toDay, a.todayDay);
  let adjusted = 0;
  let actual = 0;
  let cdd = 0;
  let hdd = 0;
  let hours = 0;
  let tons = 0;
  for (let d = b.period.fromDay; d < last; d++) {
    const day = ds.days[d];
    const dd = degreeDays(day.meanTempC, climate.cddBaseC, climate.hddBaseC);
    adjusted += dailyBand(a.plantModel, {
      tons: day.tons,
      cdd: dd.cdd,
      hdd: dd.hdd,
      hours: day.productionHours,
    }).expected;
    actual += nanSafe(e.actual[d]);
    cdd += dd.cdd;
    hdd += dd.hdd;
    hours += day.productionHours;
    tons += day.tons;
  }
  const days = Math.max(0, last - b.period.fromDay);
  const baseEnpi = baseTons > 0 ? baseKwh / baseTons : 0;
  const repEnpi = tons > 0 ? actual / tons : 0;
  // significant energy uses over the baseline period
  const seuRaw = ds.groups
    .filter((g) => g.energy === 'electricity')
    .map((g) => {
      const ids = ds.equipment.filter((x) => x.group === g.id).map((x) => x.id);
      return { group: g.id, kwh: sumDays(dailyTotals(a, ids).actual, baseFrom, baseTo) };
    });
  const seuTotal = seuRaw.reduce((s, x) => s + x.kwh, 0);
  const baselineKwhPerYear = (baseKwh / baseDays) * 365;
  return {
    ...b,
    template: 'iso50001',
    baseline: {
      fromKey: baseMonths[0]?.key ?? b.period.key,
      toKey: baseMonths[baseMonths.length - 1]?.key ?? b.period.key,
      fromStart: baseMonths[0]?.start ?? b.period.start,
      toStart: baseMonths[baseMonths.length - 1]?.start ?? b.period.start,
      months: baseMonths.length,
      kwh: baseKwh,
      tons: baseTons,
      enpi: baseEnpi,
    },
    reporting: { days, kwh: actual, tons, enpi: repEnpi },
    enpiChangePct: baseEnpi > 0 ? (repEnpi / baseEnpi - 1) * 100 : 0,
    normalized: {
      adjustedBaselineKwh: adjusted,
      actualKwh: actual,
      improvementPct: adjusted > 0 ? (1 - actual / adjusted) * 100 : 0,
    },
    variables: {
      tons,
      cdd,
      hdd,
      productionHours: hours,
      days,
      baseTonsPerDay: baseTons / baseDays,
      baseCddPerDay: bc / baseDays,
      baseHddPerDay: bh / baseDays,
      baseHoursPerDay: bHours / baseDays,
    },
    staticFactors: {
      areaM2: i.plant.areaM2,
      equipmentCount: ds.equipment.length,
      changed: i.plant.staticFactorsChanged,
    },
    model: {
      coef: a.plantModel.coef,
      r2: a.plantModel.r2,
      cvRmsePct: a.plantModel.cvRmsePct,
      n: a.plantModel.n,
      lowReliability: a.plantModel.lowReliability,
    },
    seu: seuRaw
      .map((x) => {
        const sharePct = seuTotal > 0 ? (x.kwh / seuTotal) * 100 : 0;
        return { ...x, sharePct, significant: sharePct >= 10 };
      })
      .sort((x, y) => y.kwh - x.kwh),
    targets: {
      energyReductionPct: i.rates.annualEnergyReductionPct,
      baselineKwhPerYear,
      energyTargetKwhPerYear: baselineKwhPerYear * (1 - i.rates.annualEnergyReductionPct / 100),
      enpiTarget: i.rates.enpiTargetKwhPerT,
      enpiActual: repEnpi,
      co2ReductionPct: i.rates.annualCo2ReductionPct,
    },
    actions: {
      counts: statusCounts(i.recommendations),
      active: i.recommendations
        .filter((r) =>
          ['approved', 'scheduled', 'in_progress', 'measuring', 'verified'].includes(r.status),
        )
        .map(recItem),
    },
    savings: savingsBlock(i.measures, i.rates),
  };
}

export function buildReport(template: ReportTemplateId, i: ReportInputs): Report {
  switch (template) {
    case 'director':
      return buildDirectorReport(i);
    case 'energy_manager':
      return buildEnergyManagerReport(i);
    case 'carbon':
      return buildCarbonReport(i);
    case 'iso50001':
      return buildIsoReport(i);
  }
}

// ---------------------------------------------------------------------------
// Inputs for alert rules (Settings > Alert rules)

/** Highest hourly electric load (kW) over the last `days` measured days. */
export function recentPeakKw(a: Analysis, days = 7): number {
  const to = a.ds.timeline.nowIndex;
  const from = Math.max(0, to - days * 24);
  let peak = 0;
  for (let h = from; h < to; h++) {
    let s = 0;
    for (const id of a.electricIds) s += nanSafe(a.ds.readings[id][h]);
    if (s > peak) peak = s;
  }
  return peak;
}

/** Minutes since the longest-disconnected meter went offline (0 when all are connected). */
export function offlineMinutes(a: Analysis): number {
  const now = a.ds.timeline.nowMs;
  return a.ds.offlineEquipment.reduce(
    (m, o) => Math.max(m, Math.round((now - o.since) / 60_000)),
    0,
  );
}
