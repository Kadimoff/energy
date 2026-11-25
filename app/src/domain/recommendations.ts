import type {
  Anomaly,
  EnergyDataset,
  HourMask,
  Recommendation,
  RecommendationState,
  RecommendationStatus,
  RecommendationTemplate,
} from '../data/types';
import { DAY_MS, slotOf, type AnalysisCore } from './core';
import { clamp, mean } from './stats';

/**
 * Recommendation engine (spec 7.6 / 9.5).
 *
 * Each template (src/data/config/recommendations.json) names the equipment
 * and the hour mask it acts on. The engine measures the current waste rate
 * (kWh above the optimal band) for that equipment + mask over the template's
 * window, and the saving is `capture × waste`. A saving therefore can never
 * exceed the waste of the equipment it targets. When several accepted
 * recommendations touch the same equipment hours, `combinedReduction`
 * applies them one after another on the remaining waste (no double counting).
 */

export const SLOTS = 168;
/** average number of times a given hour-of-week slot occurs in a month */
export const WEEKS_PER_MONTH = 30.4375 / 7;

export interface WastePool {
  eqId: string;
  /** average waste per hour-of-week slot (kWh or m³ per occurrence) */
  slots: Float32Array;
}

export interface RecommendationEngineResult {
  recommendations: Recommendation[];
  /** per recommendation: pools per equipment */
  pools: Record<string, WastePool[]>;
  /** total current waste rate per equipment and slot (all hours), per occurrence */
  wasteRate: Record<string, Float32Array>;
}

function inMask(core: AnalysisCore, i: number, mask: HourMask): boolean {
  const prod = core.ds.context.production[i] === 1;
  switch (mask) {
    case 'nonprod':
      return !prod;
    case 'prod':
      return prod;
    case 'startup':
      return prod && (i === 0 || core.ds.context.production[i - 1] === 0);
    default:
      return true;
  }
}

/** Waste per hour-of-week slot for one equipment over the last `days` complete days. */
export function wasteSlots(
  core: AnalysisCore,
  eqId: string,
  days: number,
  mask: HourMask,
): Float32Array {
  const out = new Float32Array(SLOTS);
  const to = core.ds.timeline.nowIndex;
  const from = Math.max(0, to - days * 24);
  const w = core.bands[eqId].waste;
  for (let i = from; i < to; i++) {
    if (!inMask(core, i, mask)) continue;
    out[slotOf(core, i)] += w[i];
  }
  const weeks = (to - from) / SLOTS;
  for (let s = 0; s < SLOTS; s++) out[s] /= weeks;
  return out;
}

const sumArr = (a: Float32Array) => a.reduce((s, v) => s + v, 0);

export function confidenceFor(
  core: AnalysisCore,
  tpl: RecommendationTemplate,
  linked: Anomaly[],
): number {
  const cvs = tpl.equipmentIds.map((id) => {
    const m = core.models[id];
    const f = tpl.mask === 'nonprod' ? m.idle : m.prod;
    return f ? Math.min(40, f.cvRmsePct) : 30;
  });
  const occ = linked.reduce((s, a) => s + a.occurrences.length, 0);
  let c = 96 - 0.35 * mean(cvs);
  if (occ < 3) c -= 14;
  else if (occ < 6) c -= 6;
  if (tpl.windowDays < 14) c -= 8;
  if (tpl.effort === 'invest') c -= 8;
  if (tpl.riskLevel === 'medium') c -= 5;
  if (tpl.mask === 'startup') c -= 6;
  return Math.round(clamp(c, 35, 97));
}

export function runRecommendationEngine(
  core: AnalysisCore,
  templates: RecommendationTemplate[],
  anomalies: Anomaly[],
): RecommendationEngineResult {
  const { ds } = core;
  const eqById = new Map(ds.equipment.map((e) => [e.id, e]));
  const pools: Record<string, WastePool[]> = {};
  const recommendations: Recommendation[] = [];
  for (const tpl of templates) {
    const ps = tpl.equipmentIds.map((eqId) => ({
      eqId,
      slots: wasteSlots(core, eqId, tpl.windowDays, tpl.mask),
    }));
    pools[tpl.id] = ps;
    const poolMonth = ps.reduce((s, p) => s + sumArr(p.slots), 0) * WEEKS_PER_MONTH;
    const energy = eqById.get(tpl.equipmentIds[0])?.energy ?? 'electricity';
    const linked = anomalies.filter(
      (a) =>
        tpl.rules.includes(a.rule) && a.equipmentIds.some((id) => tpl.equipmentIds.includes(id)),
    );
    let peakKw = 0;
    if (tpl.category === 'peak') {
      const peaks = linked.filter((a) => a.rule === 'peak_power');
      // staggering N simultaneous starts leaves about 1/N of the inrush surge
      const surge = mean(peaks.map((a) => a.metrics.surgeKw));
      const starts = mean(peaks.map((a) => a.metrics.starts));
      peakKw = peaks.length && starts > 1 ? surge * (1 - 1 / starts) : 0;
    }
    const saving = tpl.capture * poolMonth;
    recommendations.push({
      ...tpl,
      energy,
      kwhPerMonth: energy === 'electricity' ? saving : 0,
      m3PerMonth: energy === 'gas' ? saving : 0,
      peakKwReduction: peakKw,
      wastePoolPerMonth: poolMonth,
      confidence: confidenceFor(core, tpl, linked),
      anomalyIds: linked.map((a) => a.id),
    });
    for (const a of linked)
      if (!a.recommendationIds.includes(tpl.id)) a.recommendationIds.push(tpl.id);
  }
  const wasteRate: Record<string, Float32Array> = {};
  for (const eq of ds.equipment)
    wasteRate[eq.id] = wasteSlots(core, eq.id, core.cfg.forecast.wasteWindowDays, 'all');
  return { recommendations, pools, wasteRate };
}

/** Statuses whose recommendation counts as accepted for forecasts. */
export const ACTIVE_STATUSES: RecommendationStatus[] = [
  'approved',
  'scheduled',
  'in_progress',
  'measuring',
  'verified',
];

/** Date (ms) from which an accepted recommendation takes effect. */
export function effectiveFrom(
  state: RecommendationState | undefined,
  nowMs: number,
): number | null {
  if (!state || !ACTIVE_STATUSES.includes(state.status)) return null;
  if (state.status === 'scheduled' && state.scheduledFor) return state.scheduledFor;
  if (state.status === 'approved') {
    const d = new Date(nowMs + DAY_MS);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  return nowMs;
}

/**
 * Combined reduction per equipment and slot for a set of recommendations,
 * applied in order of capture on the remaining waste. Result is in the same
 * unit as the pools (per slot occurrence).
 */
export function combinedReduction(
  engine: RecommendationEngineResult,
  recIds: string[],
): Record<string, Float32Array> {
  const recs = engine.recommendations
    .filter((r) => recIds.includes(r.id))
    .sort((a, b) => b.capture - a.capture);
  const pool: Record<string, Float32Array> = {};
  for (const r of recs) {
    for (const p of engine.pools[r.id]) {
      const pl = (pool[p.eqId] ??= Float32Array.from(
        engine.wasteRate[p.eqId] ?? new Float32Array(SLOTS),
      ));
      for (let s = 0; s < SLOTS; s++) pl[s] = Math.max(pl[s], p.slots[s]);
    }
  }
  const out: Record<string, Float32Array> = {};
  const remaining: Record<string, Float32Array> = {};
  for (const r of recs) {
    for (const p of engine.pools[r.id]) {
      const rem = (remaining[p.eqId] ??= Float32Array.from(pool[p.eqId]));
      const red = (out[p.eqId] ??= new Float32Array(SLOTS));
      for (let s = 0; s < SLOTS; s++) {
        const take = r.capture * Math.min(p.slots[s], rem[s]);
        red[s] += take;
        rem[s] -= take;
      }
    }
  }
  return out;
}

/** Monthly saving (kWh / m³) of a set of recommendations, combined without double counting. */
export function combinedMonthlySaving(
  ds: EnergyDataset,
  engine: RecommendationEngineResult,
  recIds: string[],
): { kwh: number; m3: number } {
  const red = combinedReduction(engine, recIds);
  let kwh = 0;
  let m3 = 0;
  for (const [eqId, slots] of Object.entries(red)) {
    const v = sumArr(slots) * WEEKS_PER_MONTH;
    if (ds.equipment.find((e) => e.id === eqId)?.energy === 'gas') m3 += v;
    else kwh += v;
  }
  return { kwh, m3 };
}

/** Payback in months; Infinity when there is no saving, 0 when no investment. */
export function paybackMonths(investmentAzn: number, savingAznPerMonth: number): number {
  if (investmentAzn <= 0) return 0;
  if (savingAznPerMonth <= 0) return Number.POSITIVE_INFINITY;
  return investmentAzn / savingAznPerMonth;
}
