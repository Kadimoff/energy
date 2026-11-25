import type {
  Anomaly,
  AnomalyOccurrence,
  AnomalyRule,
  EquipmentGroupId,
  Severity,
} from '../data/types';
import { dailyTotals, type AnalysisCore } from './core';
import { linearTrend, mean, median } from './stats';

/**
 * Anomaly detection rules (spec 5.3). Every rule works on hourly actuals
 * vs the optimal model of src/domain/baseline.ts inside the detection window
 * (default: last 30 days). Occurrences are grouped per rule, equipment group
 * and ISO week so a recurring pattern shows up as one readable event.
 *
 * 1. idle_load         – high load in non-production hours
 * 2. baseload_trend    – night baseload rising over the last 7+ days
 * 3. spike             – z-score > 3 short spikes
 * 4. peak_power        – several machines starting in the same hour
 * 5. weather_mismatch  – cooling at high load on a cold day
 * 6. enpi_degradation  – weekly kWh/t 10 %+ above the normalised baseline
 */

interface RawOccurrence {
  rule: AnomalyRule;
  equipmentIds: string[];
  start: number;
  /** exclusive hour index */
  end: number;
  lossKwh: number;
  metrics: Record<string, number>;
}

const HOUR = 3_600_000;

function weekStartOf(core: AnalysisCore, i: number): number {
  const day = core.ds.days[core.ds.timeline.dayIndex[i]];
  return day.start - day.weekday * 86_400_000;
}

/** Contiguous runs of flagged hours, allowing gaps of up to `maxGap` hours. */
export function findRuns(
  flags: Uint8Array,
  from: number,
  to: number,
  maxGap: number,
  minLen: number,
) {
  const runs: { start: number; end: number }[] = [];
  let s = -1;
  let last = -1;
  for (let i = from; i < to; i++) {
    if (!flags[i]) continue;
    if (s < 0) s = i;
    else if (i - last - 1 > maxGap) {
      if (last + 1 - s >= minLen) runs.push({ start: s, end: last + 1 });
      s = i;
    }
    last = i;
  }
  if (s >= 0 && last + 1 - s >= minLen) runs.push({ start: s, end: last + 1 });
  return runs;
}

// ---------------------------------------------------------------------------
// Rule 2: baseload trend (run first: its hours are excluded from rule 1)

export function detectBaseloadTrend(core: AnalysisCore): {
  occ: RawOccurrence[];
  mask: Map<string, Uint8Array>;
} {
  const { ds, cfg } = core;
  const r = cfg.rules.baseloadTrend;
  const occ: RawOccurrence[] = [];
  const mask = new Map<string, Uint8Array>();
  // last day whose night window is complete
  const nowHour = ds.timeline.hourOfDay[Math.min(ds.timeline.nowIndex, ds.timeline.hours - 1)];
  const lastDay = nowHour >= r.nightEndHour ? core.todayDay : core.todayDay - 1;
  const firstRef = lastDay - r.trendDays - r.referenceDays + 1;
  if (firstRef < 0) return { occ, mask };
  for (const eq of ds.equipment) {
    const a = ds.readings[eq.id];
    const night = (d: number) => {
      const day = ds.days[d];
      const xs: number[] = [];
      for (let i = day.startIndex; i < day.endIndex; i++) {
        const h = ds.timeline.hourOfDay[i];
        if (!ds.context.production[i] && h >= r.nightStartHour && h < r.nightEndHour) xs.push(a[i]);
      }
      return xs.length ? median(xs) : Number.NaN;
    };
    const series: number[] = [];
    for (let d = firstRef; d <= lastDay; d++) series.push(night(d));
    const ref = median(series.slice(0, r.referenceDays));
    const recent = series.slice(r.referenceDays);
    if (!(ref > Math.max(1, eq.nominal * 0.05))) continue;
    if (recent.some((v) => Number.isNaN(v))) continue;
    const tr = linearTrend(recent);
    // end point of the fitted trend line: robust "current" night baseload
    const current = tr.intercept + tr.slope * (recent.length - 1);
    const incPct = ((current - ref) / ref) * 100;
    const minAbs = Math.max(2, eq.nominal * 0.03);
    if (!(
      tr.slope > 0 &&
      tr.r2 >= r.minR2 &&
      incPct >= r.minIncreasePct &&
      current - ref >= minAbs
    ))
      continue;
    // walk back to the day the increase started
    const refSorted = series.slice(0, r.referenceDays).filter((v) => !Number.isNaN(v));
    const spread = Math.max(0.5, median(refSorted.map((v) => Math.abs(v - ref))) * 1.4826);
    let startDay = lastDay - r.trendDays + 1;
    while (startDay - 1 > firstRef && series[startDay - 1 - firstRef] > ref + spread) startDay--;
    const startIdx = ds.days[startDay].startIndex;
    const endIdx = ds.timeline.nowIndex;
    let loss = 0;
    for (let d = startDay; d <= lastDay; d++) {
      const v = series[d - firstRef];
      if (!Number.isNaN(v)) loss += Math.max(0, v - ref) * 24;
    }
    const m = new Uint8Array(ds.timeline.hours);
    m.fill(1, startIdx, endIdx);
    mask.set(eq.id, m);
    occ.push({
      rule: 'baseload_trend',
      equipmentIds: [eq.id],
      start: startIdx,
      end: endIdx,
      lossKwh: loss,
      metrics: {
        refKw: ref,
        currentKw: current,
        increasePct: incPct,
        slopeKwPerDay: tr.slope,
        r2: tr.r2,
        days: lastDay - startDay + 1,
      },
    });
  }
  return { occ, mask };
}

// ---------------------------------------------------------------------------
// Rule 1: idle load

export function detectIdleLoad(
  core: AnalysisCore,
  exclude: Map<string, Uint8Array>,
): RawOccurrence[] {
  const { ds, cfg } = core;
  const r = cfg.rules.idleLoad;
  const out: RawOccurrence[] = [];
  const n = ds.timeline.hours;
  const from = core.windowStart;
  const to = ds.timeline.nowIndex;
  for (const eq of ds.equipment) {
    const a = ds.readings[eq.id];
    const b = core.bands[eq.id];
    const ex = exclude.get(eq.id);
    const thr = Math.max(r.minExcessKw, r.minExcessPctNominal * eq.nominal);
    const flags = new Uint8Array(n);
    for (let i = from; i < to; i++) {
      if (ds.context.production[i] || (ex && ex[i])) continue;
      if (a[i] - b.upper[i] > thr) flags[i] = 1;
    }
    for (const run of findRuns(flags, from, to, r.maxGapHours, r.minHours)) {
      let loss = 0;
      let act = 0;
      let exp = 0;
      let hours = 0;
      for (let i = run.start; i < run.end; i++) {
        if (ds.context.production[i]) continue;
        loss += b.waste[i];
        act += a[i];
        exp += b.expected[i];
        hours++;
      }
      out.push({
        rule: 'idle_load',
        equipmentIds: [eq.id],
        start: run.start,
        end: run.end,
        lossKwh: loss,
        metrics: {
          hours,
          avgKw: act / Math.max(1, hours),
          expectedKw: exp / Math.max(1, hours),
          startHour: ds.timeline.hourOfDay[run.start],
          loadPct: (act / Math.max(1, hours) / eq.nominal) * 100,
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule 4: peak power (simultaneous starts)

export function detectPeaks(
  core: AnalysisCore,
  exclude: Map<string, Uint8Array> = new Map(),
): { occ: RawOccurrence[]; mask: Map<string, Uint8Array> } {
  const { ds, cfg } = core;
  const r = cfg.rules.peak;
  const occ: RawOccurrence[] = [];
  const mask = new Map<string, Uint8Array>();
  const elec = ds.equipment.filter((e) => e.energy === 'electricity');
  const to = ds.timeline.nowIndex;
  for (let i = Math.max(1, core.windowStart); i < to; i++) {
    const starters = elec.filter((e) => {
      const a = ds.readings[e.id];
      // a start with inrush/heating surge above the normal running band
      return (
        a[i - 1] <= r.startFromPct * e.nominal &&
        a[i] >= r.startToPct * e.nominal &&
        !exclude.get(e.id)?.[i] &&
        (a[i] - core.bands[e.id].expected[i]) / Math.max(1e-6, core.models[e.id].sigmaProd) >=
          r.surgeZ
      );
    });
    if (starters.length < r.minSimultaneousStarts) continue;
    let total = 0;
    for (const e of elec) total += ds.readings[e.id][i];
    let surge = 0;
    for (const e of starters)
      surge += Math.max(0, ds.readings[e.id][i] - core.bands[e.id].expected[i]);
    // typical production-hour demand of the same day
    const day = ds.days[ds.timeline.dayIndex[i]];
    const others: number[] = [];
    for (let k = day.startIndex; k < Math.min(day.endIndex, to); k++) {
      if (k === i || !ds.context.production[k]) continue;
      let s = 0;
      for (const e of elec) s += ds.readings[e.id][k];
      others.push(s);
    }
    const typical = others.length ? median(others) : total;
    for (const e of starters) {
      let m = mask.get(e.id);
      if (!m) {
        m = new Uint8Array(ds.timeline.hours);
        mask.set(e.id, m);
      }
      m[i] = 1;
    }
    let loss = 0;
    for (const e of starters) loss += core.bands[e.id].waste[i];
    occ.push({
      rule: 'peak_power',
      equipmentIds: starters.map((s) => s.id),
      start: i,
      end: i + 1,
      lossKwh: loss,
      metrics: {
        peakKw: total,
        typicalKw: typical,
        excessKw: total - typical,
        surgeKw: surge,
        starts: starters.length,
        peakLimitKw: ds.plant.peakLimitKw,
        hour: ds.timeline.hourOfDay[i],
      },
    });
  }
  return { occ, mask };
}

// ---------------------------------------------------------------------------
// Rule 5: weather mismatch (cooling on cold days)

export function detectWeatherMismatch(core: AnalysisCore): {
  occ: RawOccurrence[];
  mask: Map<string, Uint8Array>;
} {
  const { ds, cfg } = core;
  const r = cfg.rules.weatherMismatch;
  const occ: RawOccurrence[] = [];
  const mask = new Map<string, Uint8Array>();
  const coolers = ds.equipment.filter((e) => e.group === 'cooling' && e.nominal >= 100);
  for (let d = Math.max(0, ds.timeline.dayIndex[core.windowStart]); d < core.todayDay + 1; d++) {
    const day = ds.days[d];
    if (day.meanTempC >= r.coldDayMeanC) continue;
    for (const e of coolers) {
      const a = ds.readings[e.id];
      const b = core.bands[e.id];
      let hours = 0;
      let loss = 0;
      let act = 0;
      let exp = 0;
      let first = -1;
      let last = -1;
      const to = Math.min(day.endIndex, ds.timeline.nowIndex);
      for (let i = day.startIndex; i < to; i++) {
        if (!ds.context.production[i]) continue;
        if (a[i] >= r.minLoadPct * e.nominal && a[i] > b.upper[i]) {
          hours++;
          loss += b.waste[i];
          act += a[i];
          exp += b.expected[i];
          if (first < 0) first = i;
          last = i;
        }
      }
      // partial day (today): require all elapsed production hours, at most 4
      let prodHours = 0;
      for (let i = day.startIndex; i < to; i++) if (ds.context.production[i]) prodHours++;
      if (hours < Math.min(4, Math.max(1, prodHours))) continue;
      let m = mask.get(e.id);
      if (!m) {
        m = new Uint8Array(ds.timeline.hours);
        mask.set(e.id, m);
      }
      m.fill(1, day.startIndex, day.endIndex);
      occ.push({
        rule: 'weather_mismatch',
        equipmentIds: [e.id],
        start: first,
        end: last + 1,
        lossKwh: loss,
        metrics: {
          meanTempC: day.meanTempC,
          hours,
          avgKw: act / hours,
          expectedKw: exp / hours,
          loadPct: (act / hours / e.nominal) * 100,
        },
      });
    }
  }
  return { occ, mask };
}

// ---------------------------------------------------------------------------
// Rule 3: spikes

export function detectSpikes(
  core: AnalysisCore,
  exclude: Map<string, Uint8Array>[],
): RawOccurrence[] {
  const { ds, cfg } = core;
  const z = cfg.rules.spike.zScore;
  const minPct = cfg.rules.spike.minExcessPctNominal;
  const minKw = cfg.rules.spike.minExcessKw;
  const out: RawOccurrence[] = [];
  const to = ds.timeline.nowIndex;
  for (const e of ds.equipment) {
    const a = ds.readings[e.id];
    const b = core.bands[e.id];
    const sig = core.models[e.id].sigmaProd;
    if (!sig) continue;
    const flags = new Uint8Array(ds.timeline.hours);
    for (let i = core.windowStart; i < to; i++) {
      if (!ds.context.production[i]) continue;
      // first production hour belongs to the peak power rule
      if (!ds.context.production[i - 1]) continue;
      if (exclude.some((m) => m.get(e.id)?.[i])) continue;
      const ex = a[i] - b.expected[i];
      if (ex / sig > z && ex > Math.max(minKw, minPct * e.nominal)) flags[i] = 1;
    }
    for (const run of findRuns(flags, core.windowStart, to, 0, 1)) {
      if (run.end - run.start > 3) continue; // long deviations are not spikes
      let loss = 0;
      let zmax = 0;
      let peak = 0;
      for (let i = run.start; i < run.end; i++) {
        loss += b.waste[i];
        zmax = Math.max(zmax, (a[i] - b.expected[i]) / sig);
        peak = Math.max(peak, a[i]);
      }
      out.push({
        rule: 'spike',
        equipmentIds: [e.id],
        start: run.start,
        end: run.end,
        lossKwh: loss,
        metrics: {
          zScore: zmax,
          peakKw: peak,
          expectedKw: b.expected[run.start],
          hours: run.end - run.start,
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule 6: EnPI degradation (weekly, plant level)

export function detectEnpi(core: AnalysisCore): RawOccurrence[] {
  const { ds, cfg } = core;
  const thr = cfg.rules.enpi.thresholdPct;
  const dt = dailyTotals(core, core.electricIds);
  const out: RawOccurrence[] = [];
  const firstDay = ds.timeline.dayIndex[core.windowStart];
  let d = firstDay;
  while (d > 0 && ds.days[d].weekday !== 0) d++;
  for (; d < core.todayDay; d += 7) {
    let act = 0;
    let exp = 0;
    let tons = 0;
    let waste = 0;
    let prodDays = 0;
    const end = Math.min(core.todayDay, d + 7);
    for (let k = d; k < end; k++) {
      act += dt.actual[k];
      exp += dt.expected[k];
      waste += dt.waste[k];
      tons += ds.days[k].tons;
      if (ds.days[k].tons > 0) prodDays++;
    }
    if (prodDays < 3 || tons <= 0) continue;
    const enpi = act / tons;
    const expected = exp / tons;
    const dev = (enpi / expected - 1) * 100;
    if (dev < thr) continue;
    out.push({
      rule: 'enpi_degradation',
      equipmentIds: [],
      start: ds.days[d].startIndex,
      end: ds.days[end - 1].endIndex,
      lossKwh: waste,
      metrics: { enpi, expectedEnpi: expected, deviationPct: dev, tons, days: end - d },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

export function severityOf(
  core: AnalysisCore,
  rule: AnomalyRule,
  lossKwh: number,
  metrics: Record<string, number>,
): Severity {
  const s = core.cfg.severity;
  if (rule === 'enpi_degradation') {
    return metrics.deviationPct >= 25 ? 'critical' : metrics.deviationPct >= 15 ? 'high' : 'medium';
  }
  let sev: Severity =
    lossKwh >= s.criticalKwh
      ? 'critical'
      : lossKwh >= s.highKwh
        ? 'high'
        : lossKwh >= s.mediumKwh
          ? 'medium'
          : 'low';
  const bump = (to: Severity) => {
    const order: Severity[] = ['low', 'medium', 'high', 'critical'];
    if (order.indexOf(to) > order.indexOf(sev)) sev = to;
  };
  if (rule === 'baseload_trend') bump(metrics.increasePct >= 20 ? 'high' : 'medium');
  if (rule === 'peak_power') bump(metrics.peakKw > metrics.peakLimitKw ? 'high' : 'medium');
  if (rule === 'spike') bump('medium');
  return sev;
}

const weekKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

/** Group raw occurrences per rule + equipment group + ISO week into anomalies. */
export function groupOccurrences(core: AnalysisCore, raw: RawOccurrence[]): Anomaly[] {
  const { ds } = core;
  const eqById = new Map(ds.equipment.map((e) => [e.id, e]));
  const groupOfIds = (rule: AnomalyRule, ids: string[]): EquipmentGroupId | 'plant' => {
    if (rule === 'enpi_degradation' || !ids.length) return 'plant';
    const counts = new Map<EquipmentGroupId, number>();
    for (const id of ids) {
      const g = eqById.get(id)?.group;
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'plant';
  };
  const buckets = new Map<string, RawOccurrence[]>();
  for (const o of raw) {
    const group = groupOfIds(o.rule, o.equipmentIds);
    // trends are one continuous event; others group by ISO week
    const wk = o.rule === 'baseload_trend' ? 'trend' : weekKey(weekStartOf(core, o.start));
    const key = `${o.rule}:${group}:${wk}${o.rule === 'baseload_trend' ? `:${o.equipmentIds[0]}` : ''}`;
    const list = buckets.get(key) ?? [];
    list.push(o);
    buckets.set(key, list);
  }
  const out: Anomaly[] = [];
  for (const [key, list] of buckets) {
    list.sort((a, b) => a.start - b.start);
    const rule = list[0].rule;
    const eqIds = [...new Set(list.flatMap((o) => o.equipmentIds))].sort();
    const first = eqById.get(eqIds[0]);
    const occurrences: AnomalyOccurrence[] = list.map((o) => ({
      start: ds.timeline.hourStarts[o.start],
      end: ds.timeline.hourStarts[o.start] + (o.end - o.start) * HOUR,
      lossKwh: o.lossKwh,
    }));
    const lossTotal = list.reduce((s, o) => s + o.lossKwh, 0);
    // metrics: average numeric metrics across occurrences, plus counts
    const metrics: Record<string, number> = {};
    const keys = new Set(list.flatMap((o) => Object.keys(o.metrics)));
    for (const k of keys) metrics[k] = mean(list.map((o) => o.metrics[k] ?? Number.NaN));
    if (rule === 'peak_power') metrics.peakKw = Math.max(...list.map((o) => o.metrics.peakKw));
    metrics.occurrences = list.length;
    metrics.totalHours = list.reduce((s, o) => s + (o.end - o.start), 0);
    const isGas = first?.energy === 'gas';
    const start = occurrences[0].start;
    const end = Math.max(...occurrences.map((o) => o.end));
    out.push({
      id: key,
      rule,
      severity: severityOf(core, rule, isGas ? lossTotal * core.gasKwhPerM3 : lossTotal, metrics),
      equipmentIds: eqIds,
      group: groupOfIds(rule, eqIds),
      energy: isGas ? 'gas' : 'electricity',
      start,
      end,
      occurrences,
      lossKwh: isGas ? 0 : lossTotal,
      lossM3: isGas ? lossTotal : 0,
      status: 'open',
      metrics,
      recommendationIds: [],
    });
  }
  const sevOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.sort((a, b) => b.end - a.end || sevOrder[a.severity] - sevOrder[b.severity]);
}

export function detectAnomalies(core: AnalysisCore): Anomaly[] {
  const trend = detectBaseloadTrend(core);
  const weather = detectWeatherMismatch(core);
  const peaks = detectPeaks(core, weather.mask);
  const idle = detectIdleLoad(core, trend.mask);
  const spikes = detectSpikes(core, [peaks.mask, weather.mask, trend.mask]);
  const enpi = detectEnpi(core);
  return groupOccurrences(core, [
    ...trend.occ,
    ...idle,
    ...peaks.occ,
    ...weather.occ,
    ...spikes,
    ...enpi,
  ]);
}
