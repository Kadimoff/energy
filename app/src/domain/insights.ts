import type { EffectiveRates } from '../data/config';
import type { EnergyCarrier, EquipmentGroupId } from '../data/types';
import { energyValue } from './cost';
import type {
  AnomalyVM,
  CarbonMonth,
  GroupBreakdown,
  MonthOverview,
  RecommendationVM,
} from './viewmodels';

/**
 * Overview insights (spec 7.3): budget hero state, waste bars, top pending
 * decisions, latest anomalies and the carbon snapshot. Pure functions over
 * the view models of src/domain/viewmodels.ts.
 */

// ---------------------------------------------------------------------------
// Budget hero

export type BudgetState = 'over' | 'risk' | 'within';

export interface BudgetHero {
  state: BudgetState;
  /** overrun probability in %, clamped to 1..99 for display */
  probabilityPct: number;
  /** true when the raw probability is above 99 % or below 1 % */
  probabilityCapped: boolean;
  /** forecast cost minus budget (positive = overrun) */
  overrunAzn: number;
  /** budget minus forecast (positive = reserve) */
  reserveAzn: number;
  forecastAzn: number;
  budgetAzn: number;
  p10Azn: number;
  p90Azn: number;
  /** forecast / budget × 100 */
  usedPct: number;
  daysLeft: number;
  /** reduction of the month-end forecast from accepted recommendations (AZN) */
  acceptedEffectAzn: number;
}

export const BUDGET_STATE_THRESHOLDS = { over: 0.5, risk: 0.2 } as const;

export function budgetHero(
  ov: MonthOverview,
  rates: EffectiveRates,
  thresholds: { over: number; risk: number } = BUDGET_STATE_THRESHOLDS,
): BudgetHero {
  const e = ov.electricity;
  const p = e.overrunProbability;
  const state: BudgetState =
    p >= thresholds.over && e.overrunAzn > 0 ? 'over' : p >= thresholds.risk ? 'risk' : 'within';
  const raw = p * 100;
  return {
    state,
    probabilityPct: Math.round(Math.min(99, Math.max(1, raw))),
    probabilityCapped: raw > 99 || raw < 1,
    overrunAzn: e.overrunAzn,
    reserveAzn: -e.overrunAzn,
    forecastAzn: e.costMean,
    budgetAzn: e.budgetAzn,
    p10Azn: e.costP10,
    p90Azn: e.costP90,
    usedPct: e.budgetAzn > 0 ? (e.costMean / e.budgetAzn) * 100 : 0,
    daysLeft: Math.max(0, ov.daysInMonth - ov.daysElapsed),
    acceptedEffectAzn: energyValue(e.recommendationEffect, 0, rates),
  };
}

// ---------------------------------------------------------------------------
// Waste breakdown bars (productive / waste / recoverable)

export interface WasteBar {
  group: EquipmentGroupId;
  energy: EnergyCarrier;
  actual: number;
  productive: number;
  /** waste that recommendations cannot recover */
  unrecoverable: number;
  recoverable: number;
  waste: number;
  productiveShare: number;
  unrecoverableShare: number;
  recoverableShare: number;
  wasteShare: number;
  wasteAzn: number;
  recoverableAzn: number;
}

export function wasteBars(groups: GroupBreakdown[], rates: EffectiveRates): WasteBar[] {
  return groups
    .filter((g) => g.actual > 0)
    .map((g) => {
      const rec = Math.min(g.recoverable, g.waste);
      const unrec = Math.max(0, g.waste - rec);
      const price = g.energy === 'gas' ? rates.gasRateAznPerM3 : rates.electricityRateAznPerKwh;
      return {
        group: g.group,
        energy: g.energy,
        actual: g.actual,
        productive: g.productive,
        unrecoverable: unrec,
        recoverable: rec,
        waste: g.waste,
        productiveShare: g.productive / g.actual,
        unrecoverableShare: unrec / g.actual,
        recoverableShare: rec / g.actual,
        wasteShare: g.waste / g.actual,
        wasteAzn: g.wasteAzn,
        recoverableAzn: rec * price,
      };
    })
    .sort((a, b) => b.wasteAzn - a.wasteAzn);
}

// ---------------------------------------------------------------------------
// Lists

/** Proposed recommendations with the largest monthly saving first. */
export function topPending(vms: RecommendationVM[], n = 3): RecommendationVM[] {
  return vms
    .filter((v) => v.status === 'proposed')
    .sort((a, b) => b.aznPerMonth - a.aznPerMonth)
    .slice(0, n);
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** Open / investigated anomalies, latest first (severity breaks ties). */
export function recentAnomalies(vms: AnomalyVM[], n = 5): AnomalyVM[] {
  return vms
    .filter((a) => a.status === 'open' || a.status === 'investigating')
    .sort((a, b) => b.end - a.end || SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    .slice(0, n);
}

export function openAnomalyCounts(vms: AnomalyVM[]) {
  const open = vms.filter((a) => a.status === 'open' || a.status === 'investigating');
  return {
    total: open.length,
    critical: open.filter((a) => a.severity === 'critical').length,
    high: open.filter((a) => a.severity === 'high').length,
    lossAzn: open.reduce((s, a) => s + a.lossAzn, 0),
  };
}

/** Parameters for the common:anomaly.title.<rule> templates. */
export function anomalyTitleParams(a: AnomalyVM, maxNames = 3): Record<string, string | number> {
  const names = a.equipmentNames;
  const equipment =
    names.length > maxNames
      ? `${names.slice(0, maxNames).join(', ')} +${names.length - maxNames}`
      : names.join(', ');
  const m = a.metrics;
  return {
    equipment,
    hours: Math.round(m.totalHours ?? m.hours ?? 0),
    pct: Math.round(m.increasePct ?? m.deviationPct ?? 0),
    count: Math.round(m.starts ?? names.length),
  };
}

// ---------------------------------------------------------------------------
// Carbon snapshot (Scope 1/2 year to date + annual target progress)

export interface CarbonSnapshot {
  year: number;
  ytdScope1T: number;
  ytdScope2T: number;
  ytdTotalT: number;
  annualTargetT: number;
  /** ytd / annual target */
  usedShare: number;
  /** share of the calendar year elapsed */
  elapsedShare: number;
  /** complete months + current month forecast + rest of the year from last year */
  projectedYearT: number;
  onTrack: boolean;
  /** projected minus target, ≥ 0 */
  overTargetT: number;
  /** last 12 complete months */
  rolling12T: number;
  monthForecastT: number;
  monthlyTargetT: number;
}

export function carbonSnapshot(
  months: CarbonMonth[],
  ov: MonthOverview,
  rates: EffectiveRates,
  nowMs: number,
): CarbonSnapshot {
  const now = new Date(nowMs);
  const year = now.getFullYear();
  const prefix = `${year}-`;
  const ytd = months.filter((m) => m.key.startsWith(prefix));
  const s1 = ytd.reduce((s, m) => s + m.scope1T, 0);
  const s2 = ytd.reduce((s, m) => s + m.scope2T, 0);
  const complete = ytd.filter((m) => m.complete).reduce((s, m) => s + m.totalT, 0);
  const curMonth = now.getMonth();
  let rest = 0;
  const avg =
    months.filter((m) => m.complete).reduce((s, m) => s + m.totalT, 0) /
    Math.max(1, months.filter((m) => m.complete).length);
  for (let mo = curMonth + 1; mo < 12; mo++) {
    const key = `${year - 1}-${String(mo + 1).padStart(2, '0')}`;
    rest += months.find((m) => m.key === key)?.totalT ?? avg;
  }
  const projected = complete + ov.co2T.forecastT + rest;
  const ys = new Date(year, 0, 1).getTime();
  const ye = new Date(year + 1, 0, 1).getTime();
  const target = rates.annualCo2TargetT;
  return {
    year,
    ytdScope1T: s1,
    ytdScope2T: s2,
    ytdTotalT: s1 + s2,
    annualTargetT: target,
    usedShare: target > 0 ? (s1 + s2) / target : 0,
    elapsedShare: (nowMs - ys) / (ye - ys),
    projectedYearT: projected,
    onTrack: projected <= target,
    overTargetT: Math.max(0, projected - target),
    rolling12T: months
      .filter((m) => m.complete)
      .slice(-12)
      .reduce((s, m) => s + m.totalT, 0),
    monthForecastT: ov.co2T.forecastT,
    monthlyTargetT: ov.co2T.monthlyTargetT,
  };
}
