import type { EffectiveRates } from '../data/config';
import type { EnergyCarrier, Equipment } from '../data/types';
import type { Analysis } from './analysis';
import { energyValue } from './cost';
import { dailyTotals, HOUR_MS, indexOfTime } from './core';
import type { CarbonSnapshot } from './insights';
import type { AnomalyVM, EquipmentRow, RecommendationVM } from './viewmodels';

/**
 * Facts for the AI Copilot answers (spec 7.13). Every number an answer shows
 * is computed here from the analysis and the view models; the service only
 * picks a template and formats.
 */

export interface BandPoint {
  t: number;
  actual: number;
  lower: number;
  upper: number;
}

/** Last `days` complete days, daily actual and optimal band for a scope. */
export function dailyBandSeries(a: Analysis, eqIds: string[], days = 14): BandPoint[] {
  const dt = dailyTotals(a, eqIds);
  const out: BandPoint[] = [];
  for (let d = Math.max(0, a.todayDay - days); d < a.todayDay; d++) {
    out.push({
      t: a.ds.days[d].start,
      actual: dt.actual[d],
      lower: dt.lower[d],
      upper: dt.upper[d],
    });
  }
  return out;
}

/** Daily waste of a scope over the last `days` complete days. */
export function dailyWaste(a: Analysis, eqIds: string[], days = 30): number[] {
  const dt = dailyTotals(a, eqIds);
  const out: number[] = [];
  for (let d = Math.max(0, a.todayDay - days); d < a.todayDay; d++) out.push(dt.waste[d]);
  return out;
}

// ---------------------------------------------------------------------------

export interface RankedEquipment {
  equipment: Equipment;
  wasteAmount: number;
  wasteAzn: number;
  wastePct: number;
  monthActual: number;
}

export function equipmentWasteRanking(
  rows: EquipmentRow[],
  rates: EffectiveRates,
): RankedEquipment[] {
  return rows
    .map((r) => ({
      equipment: r.equipment,
      wasteAmount: r.monthWaste,
      wasteAzn:
        r.equipment.energy === 'gas'
          ? energyValue(0, r.monthWaste, rates)
          : energyValue(r.monthWaste, 0, rates),
      wastePct: r.wastePct,
      monthActual: r.monthActual,
    }))
    .filter((r) => r.wasteAmount > 0)
    .sort((a, b) => b.wasteAzn - a.wasteAzn);
}

// ---------------------------------------------------------------------------
// Last night (22:00 to 08:00 before the most recent 08:00)

export interface NightEquipment {
  id: string;
  code: string;
  name: string;
  energy: EnergyCarrier;
  waste: number;
  wasteAzn: number;
}

export interface NightReport {
  from: number;
  to: number;
  points: BandPoint[];
  actualKwh: number;
  expectedUpperKwh: number;
  wasteKwh: number;
  wasteM3: number;
  wasteAzn: number;
  productionHours: number;
  top: NightEquipment[];
  /** anomalies with at least one occurrence inside the night window, clipped to it */
  anomalies: NightAnomaly[];
}

/** An anomaly seen through the night window only (not its weekly total). */
export interface NightAnomaly {
  anomaly: AnomalyVM;
  /** first and last hour of the occurrences inside the window */
  from: number;
  to: number;
  /** wall-clock hours inside the window covered by the occurrences */
  hours: number;
  /** excess energy inside the window, pro rata of the occurrence loss (kWh or m³) */
  loss: number;
  lossAzn: number;
}

/** Clip anomaly occurrences to [from, to): hours, time span and pro-rata loss. */
export function anomaliesInWindow(
  anomalies: AnomalyVM[],
  from: number,
  to: number,
  rates: EffectiveRates,
): NightAnomaly[] {
  const out: NightAnomaly[] = [];
  for (const x of anomalies) {
    let loss = 0;
    const parts: [number, number][] = [];
    for (const o of x.occurrences) {
      const s = Math.max(o.start, from);
      const e = Math.min(o.end, to);
      if (e <= s) continue;
      const len = o.end - o.start;
      loss += len > 0 ? (o.lossKwh * (e - s)) / len : o.lossKwh;
      parts.push([s, e]);
    }
    // wall-clock hours: union of the clipped intervals (several machines can overlap)
    parts.sort((p, q) => p[0] - q[0]);
    let ms = 0;
    let curS = Number.NaN;
    let curE = Number.NaN;
    for (const [s, e] of parts) {
      if (Number.isNaN(curS) || s > curE) {
        if (!Number.isNaN(curS)) ms += curE - curS;
        curS = s;
        curE = e;
      } else curE = Math.max(curE, e);
    }
    if (!Number.isNaN(curS)) ms += curE - curS;
    const first = parts.length ? parts[0][0] : 0;
    const last = parts.reduce((m, p) => Math.max(m, p[1]), 0);
    if (ms <= 0) continue;
    out.push({
      anomaly: x,
      from: first,
      to: last,
      hours: ms / HOUR_MS,
      loss,
      lossAzn: x.energy === 'gas' ? energyValue(0, loss, rates) : energyValue(loss, 0, rates),
    });
  }
  return out.sort((a, b) => b.lossAzn - a.lossAzn || b.hours - a.hours);
}

export function nightWindow(a: Analysis): { from: number; to: number } {
  const today = a.ds.days[a.todayDay].start;
  const eight = today + 8 * HOUR_MS;
  const to = a.ds.timeline.nowMs >= eight ? eight : eight - 24 * HOUR_MS;
  return { from: to - 10 * HOUR_MS, to };
}

export function lastNightReport(
  a: Analysis,
  rates: EffectiveRates,
  anomalies: AnomalyVM[],
): NightReport {
  const { from, to } = nightWindow(a);
  const { ds } = a;
  const i0 = indexOfTime(ds, from);
  const i1 = Math.min(indexOfTime(ds, to), ds.timeline.nowIndex);
  const points: BandPoint[] = [];
  let actual = 0;
  let upperSum = 0;
  let wK = 0;
  let prodHours = 0;
  for (let i = i0; i < i1; i++) {
    let ac = 0;
    let lo = 0;
    let up = 0;
    for (const id of a.electricIds) {
      ac += ds.readings[id][i];
      lo += a.bands[id].lower[i];
      up += a.bands[id].upper[i];
      wK += a.bands[id].waste[i];
    }
    if (ds.context.production[i]) prodHours++;
    actual += ac;
    upperSum += up;
    points.push({ t: ds.timeline.hourStarts[i], actual: ac, lower: lo, upper: up });
  }
  let wM = 0;
  const per: NightEquipment[] = ds.equipment.map((e) => {
    let w = 0;
    for (let i = i0; i < i1; i++) w += a.bands[e.id].waste[i];
    if (e.energy === 'gas') wM += w;
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      energy: e.energy,
      waste: w,
      wasteAzn: e.energy === 'gas' ? energyValue(0, w, rates) : energyValue(w, 0, rates),
    };
  });
  const overlapping = anomaliesInWindow(
    anomalies.filter((x) => x.status !== 'false_alarm'),
    from,
    to,
    rates,
  );
  return {
    from,
    to,
    points,
    actualKwh: actual,
    expectedUpperKwh: upperSum,
    wasteKwh: wK,
    wasteM3: wM,
    wasteAzn: energyValue(wK, wM, rates),
    productionHours: prodHours,
    top: per.filter((p) => p.wasteAzn > 0.5).sort((x, y) => y.wasteAzn - x.wasteAzn),
    anomalies: overlapping,
  };
}

// ---------------------------------------------------------------------------
// CO₂ plan: gap to the annual target and recommendations that close it

export interface Co2Plan {
  rolling12T: number;
  targetT: number;
  /** rolling 12 months minus target, ≥ 0 */
  gapT: number;
  pending: RecommendationVM[];
  pendingT: number;
  /** pending reduction / gap (Infinity when there is no gap) */
  coverage: number;
  enough: boolean;
}

export function co2Plan(snap: CarbonSnapshot, vms: RecommendationVM[]): Co2Plan {
  const pending = vms
    .filter((v) => v.status === 'proposed')
    .sort((a, b) => b.tCo2PerYear - a.tCo2PerYear);
  const pendingT = pending.reduce((s, v) => s + v.tCo2PerYear, 0);
  const gapT = Math.max(0, snap.rolling12T - snap.annualTargetT);
  return {
    rolling12T: snap.rolling12T,
    targetT: snap.annualTargetT,
    gapT,
    pending,
    pendingT,
    coverage: gapT > 0 ? pendingT / gapT : Number.POSITIVE_INFINITY,
    enough: pendingT >= gapT,
  };
}

/** Recommendations linked to an equipment, largest saving first. */
export function recommendationsFor(vms: RecommendationVM[], eqId: string): RecommendationVM[] {
  return vms
    .filter((v) => v.equipmentIds.includes(eqId))
    .sort((a, b) => b.aznPerMonth - a.aznPerMonth);
}

/** Open anomalies of an equipment, latest first. */
export function anomaliesFor(vms: AnomalyVM[], eqId: string): AnomalyVM[] {
  return vms
    .filter(
      (x) => x.equipmentIds.includes(eqId) && (x.status === 'open' || x.status === 'investigating'),
    )
    .sort((a, b) => b.end - a.end);
}
