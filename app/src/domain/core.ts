import type { AnalysisConfig, AppConfig } from '../data/config';
import type { DayInfo, EnergyDataset, Equipment } from '../data/types';
import {
  emptyBands,
  fitEquipmentHourly,
  hourlyExpected,
  type EquipmentHourlyModel,
  type HourlyBands,
  type HourlyInputs,
} from './baseline';
import { median } from './stats';

/**
 * Core analysis pipeline: fits the optimal-consumption models per equipment
 * and precomputes hourly bands and waste. Everything downstream (anomalies,
 * recommendations, forecasts, view models) reads from this object.
 */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export interface AnalysisCore {
  ds: EnergyDataset;
  cfg: AnalysisConfig;
  inputs: HourlyInputs;
  /** current model per equipment (last segment) */
  models: Record<string, EquipmentHourlyModel>;
  /** model segments split at static-factor changes (implemented measures) */
  segments: Record<string, ModelSegment[]>;
  bands: Record<string, HourlyBands>;
  electricIds: string[];
  gasIds: string[];
  todayDay: number;
  /** m³ → kWh conversion (severity of gas events) */
  gasKwhPerM3: number;
  /** first hour index of the anomaly detection window */
  windowStart: number;
  timings: Record<string, number>;
}

export interface ModelSegment {
  from: number;
  to: number;
  model: EquipmentHourlyModel;
}

export function indexOfTime(ds: EnergyDataset, t: number): number {
  return Math.max(0, Math.min(ds.timeline.hours, Math.floor((t - ds.timeline.startMs) / HOUR_MS)));
}

/**
 * Model segments for one equipment. A static factor change (implemented
 * measure, spec 5.1) starts a new baseline segment 7 days after the change
 * when both sides have at least `minTrainingDays` of data; each segment is
 * trained on its own (last `trainingDays`) good hours.
 */
export function segmentBounds(ds: EnergyDataset, eq: Equipment, cfg: AnalysisConfig): number[] {
  const now = ds.timeline.nowIndex;
  const min = cfg.minTrainingDays * 24;
  const cuts = ds.measures
    .filter((m) => m.equipmentIds.includes(eq.id))
    .map((m) => indexOfTime(ds, m.implementedAt + 7 * DAY_MS))
    .filter((c) => c > min && now - c >= min)
    .sort((a, b) => a - b);
  const bounds = [0];
  for (const c of cuts) if (c - bounds[bounds.length - 1] >= min) bounds.push(c);
  bounds.push(now);
  return bounds;
}

export function trainingWindow(
  ds: EnergyDataset,
  eq: Equipment,
  cfg: AnalysisConfig,
): { from: number; to: number } {
  const b = segmentBounds(ds, eq, cfg);
  const to = b[b.length - 1];
  return { from: Math.max(b[b.length - 2], to - cfg.trainingDays * 24), to };
}

export function buildCore(
  ds: EnergyDataset,
  config: Pick<AppConfig, 'analysis' | 'emissions'>,
): AnalysisCore {
  const t0 = performance.now();
  const cfg = config.analysis;
  const inputs: HourlyInputs = {
    production: ds.context.production,
    intensity: ds.context.intensity,
    temperature: ds.context.temperature,
    dark: ds.context.dark,
    cddBase: ds.plant.climate.cddBaseC,
    hddBase: ds.plant.climate.hddBaseC,
  };
  const models: Record<string, EquipmentHourlyModel> = {};
  const segments: Record<string, ModelSegment[]> = {};
  const bands: Record<string, HourlyBands> = {};
  const n = ds.timeline.hours;
  for (const eq of ds.equipment) {
    const b = segmentBounds(ds, eq, cfg);
    const actual = ds.readings[eq.id];
    const out = emptyBands(n);
    const segs: ModelSegment[] = [];
    for (let k = 0; k < b.length - 1; k++) {
      const to = b[k + 1];
      const from = Math.max(b[k], to - cfg.trainingDays * 24);
      const m = fitEquipmentHourly(actual, inputs, from, to, cfg.robust);
      const isLast = k === b.length - 2;
      hourlyExpected(m, actual, inputs, cfg.bandSigma, out, b[k], isLast ? n : to);
      segs.push({ from: b[k], to: isLast ? n : to, model: m });
    }
    segments[eq.id] = segs;
    models[eq.id] = segs[segs.length - 1].model;
    bands[eq.id] = out;
  }
  const t1 = performance.now();
  const todayDay = ds.timeline.dayIndex[Math.min(ds.timeline.nowIndex, ds.timeline.hours - 1)];
  const windowStart = Math.max(
    0,
    ds.days[Math.max(0, todayDay - cfg.detectionWindowDays)].startIndex,
  );
  return {
    ds,
    cfg,
    inputs,
    models,
    segments,
    bands,
    electricIds: ds.equipment.filter((e) => e.energy === 'electricity').map((e) => e.id),
    gasIds: ds.equipment.filter((e) => e.energy === 'gas').map((e) => e.id),
    todayDay,
    gasKwhPerM3: config.emissions.gasKwhPerM3.value,
    windowStart,
    timings: { modelsMs: t1 - t0 },
  };
}

// ---------------------------------------------------------------------------
// Aggregation helpers (memoised per core)

export interface DailyTotals {
  days: DayInfo[];
  actual: Float64Array;
  expected: Float64Array;
  lower: Float64Array;
  upper: Float64Array;
  waste: Float64Array;
  /** σ of daily residuals used for the band */
  sigma: number;
}

const dailyCache = new WeakMap<AnalysisCore, Map<string, DailyTotals>>();

export function dailyTotals(core: AnalysisCore, eqIds: string[]): DailyTotals {
  const key = eqIds.join('|');
  let m = dailyCache.get(core);
  if (!m) {
    m = new Map();
    dailyCache.set(core, m);
  }
  const hit = m.get(key);
  if (hit) return hit;
  const { ds } = core;
  const nd = ds.days.length;
  const actual = new Float64Array(nd);
  const expected = new Float64Array(nd);
  const waste = new Float64Array(nd);
  const now = ds.timeline.nowIndex;
  for (let d = 0; d < nd; d++) {
    const day = ds.days[d];
    let a = 0;
    let e = 0;
    let w = 0;
    for (const id of eqIds) {
      const r = ds.readings[id];
      const b = core.bands[id];
      for (let i = day.startIndex; i < day.endIndex; i++) {
        e += b.expected[i];
        if (i < now) {
          a += r[i];
          w += b.waste[i];
        }
      }
    }
    actual[d] = day.startIndex >= now ? Number.NaN : a;
    expected[d] = e;
    waste[d] = w;
  }
  // band from residuals of complete past days (last trainingDays)
  const res: number[] = [];
  const lastComplete = core.todayDay - 1;
  for (let d = Math.max(0, lastComplete - core.cfg.trainingDays); d <= lastComplete; d++) {
    res.push(actual[d] - expected[d] - waste[d]);
  }
  const med = median(res);
  const mad = median(res.map((r) => Math.abs(r - med)));
  const sigma = 1.4826 * mad;
  const k = core.cfg.bandSigma;
  const lower = expected.map((e) => Math.max(0, e - k * sigma));
  const upper = expected.map((e) => e + k * sigma);
  const out: DailyTotals = { days: ds.days, actual, expected, lower, upper, waste, sigma };
  m.set(key, out);
  return out;
}

export interface MonthTotal {
  /** yyyy-MM */
  key: string;
  start: number;
  firstDay: number;
  lastDay: number;
  actual: number;
  expected: number;
  waste: number;
  tons: number;
  complete: boolean;
  isCurrent: boolean;
}

export function monthlyTotals(core: AnalysisCore, eqIds: string[]): MonthTotal[] {
  const dt = dailyTotals(core, eqIds);
  const out: MonthTotal[] = [];
  const todayKey = core.ds.days[core.todayDay].key.slice(0, 7);
  core.ds.days.forEach((d, i) => {
    const key = d.key.slice(0, 7);
    let mt = out[out.length - 1];
    if (!mt || mt.key !== key) {
      mt = {
        key,
        start: d.start,
        firstDay: i,
        lastDay: i,
        actual: 0,
        expected: 0,
        waste: 0,
        tons: 0,
        complete: true,
        isCurrent: key === todayKey,
      };
      out.push(mt);
    }
    mt.lastDay = i;
    if (!Number.isNaN(dt.actual[i])) {
      mt.actual += dt.actual[i];
      mt.waste += dt.waste[i];
      mt.tons += d.tons;
      mt.expected += dt.expected[i];
    }
    if (d.isToday || d.isFuture) mt.complete = false;
  });
  return out.filter((m) => m.actual > 0 || m.isCurrent);
}

/** Sum of an hourly array over [from, to) ignoring NaN. */
export function sumRange(arr: ArrayLike<number>, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) {
    const v = arr[i];
    if (!Number.isNaN(v)) s += v;
  }
  return s;
}

/** hour-of-week slot, Monday 00:00 = 0 */
export const slotOf = (core: AnalysisCore, i: number) =>
  core.ds.timeline.weekday[i] * 24 + core.ds.timeline.hourOfDay[i];
