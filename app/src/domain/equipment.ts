import type { Anomaly } from '../data/types';
import type { AnalysisCore } from './core';
import { clamp } from './stats';

/** Equipment level indicators: health score, load profile, weekly heatmap. */

export interface HealthInput {
  wastePct: number;
  openCritical: number;
  openHigh: number;
  rising: boolean;
}

/** 0..100, higher is better. */
export function healthScore(h: HealthInput): number {
  return Math.round(
    clamp(
      100 - 1.6 * h.wastePct - 10 * h.openCritical - 5 * h.openHigh - (h.rising ? 12 : 0),
      5,
      100,
    ),
  );
}

export interface LoadProfile {
  /** share of running hours (0..1) */
  idle: number;
  partial: number;
  full: number;
  off: number;
  hours: number;
}

/** Load distribution over [from, to): off < 3 %, idle < 30 %, partial < 75 %, full ≥ 75 % of nominal. */
export function loadProfile(
  actual: ArrayLike<number>,
  nominal: number,
  from: number,
  to: number,
): LoadProfile {
  let off = 0;
  let idle = 0;
  let partial = 0;
  let full = 0;
  let n = 0;
  for (let i = from; i < to; i++) {
    const v = actual[i];
    if (Number.isNaN(v)) continue;
    n++;
    const p = v / nominal;
    if (p < 0.03) off++;
    else if (p < 0.3) idle++;
    else if (p < 0.75) partial++;
    else full++;
  }
  const d = Math.max(1, n);
  return { off: off / d, idle: idle / d, partial: partial / d, full: full / d, hours: n };
}

export interface HeatCell {
  /** 0 = Monday */
  weekday: number;
  hour: number;
  actual: number;
  expected: number;
  waste: number;
  production: boolean;
  /** number of samples averaged */
  n: number;
}

/** 7×24 average heatmap over the last `days` complete days. */
export function weekHeatmap(core: AnalysisCore, eqId: string, days = 28): HeatCell[] {
  const { ds } = core;
  const cells: HeatCell[] = [];
  for (let w = 0; w < 7; w++)
    for (let h = 0; h < 24; h++)
      cells.push({
        weekday: w,
        hour: h,
        actual: 0,
        expected: 0,
        waste: 0,
        production: false,
        n: 0,
      });
  const to = ds.days[core.todayDay].startIndex;
  const from = Math.max(0, to - days * 24);
  const a = ds.readings[eqId];
  const b = core.bands[eqId];
  const prodCount = new Uint16Array(168);
  for (let i = from; i < to; i++) {
    const s = ds.timeline.weekday[i] * 24 + ds.timeline.hourOfDay[i];
    const c = cells[s];
    c.actual += a[i];
    c.expected += b.expected[i];
    c.waste += b.waste[i];
    c.n++;
    if (ds.context.production[i]) prodCount[s]++;
  }
  for (let s = 0; s < 168; s++) {
    const c = cells[s];
    if (c.n) {
      c.production = prodCount[s] / c.n >= 0.5;
      c.actual /= c.n;
      c.expected /= c.n;
      c.waste /= c.n;
    }
  }
  return cells;
}

export function openCounts(anomalies: Anomaly[], eqId: string) {
  const mine = anomalies.filter(
    (a) => a.equipmentIds.includes(eqId) && a.status !== 'resolved' && a.status !== 'false_alarm',
  );
  return {
    critical: mine.filter((a) => a.severity === 'critical').length,
    high: mine.filter((a) => a.severity === 'high').length,
    rising: mine.some((a) => a.rule === 'baseload_trend'),
    last: mine.sort((x, y) => y.end - x.end)[0] ?? null,
  };
}
