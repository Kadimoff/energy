import type {
  Anomaly,
  AnomalyRule,
  AnomalyStatus,
  EnergyDataset,
  Equipment,
  EquipmentGroupId,
  LiveStatus,
  LiveTick,
  Severity,
} from '../data/types';
import { DAY_MS, HOUR_MS, type AnalysisCore } from './core';
import type { HeatCell } from './equipment';
import type { EquipmentRow, ResolvedRange } from './viewmodels';

/**
 * Selectors for the operations pages (live monitoring, equipment,
 * anomalies). Pure functions over the analysis, live ticks and anomaly
 * lists; pages only format and render the results.
 */

// ---------------------------------------------------------------------------
// Live monitoring

export interface LiveReadingVM {
  equipmentId: string;
  /** kW (m³/h for gas); NaN when offline */
  kw: number;
  status: LiveStatus;
  /** optimal model value and upper band edge of the current hour */
  expectedKw: number;
  lowerKw: number;
  upperKw: number;
  /** load above the upper band edge, 0 when within the band */
  excessKw: number;
  lastSeen: number;
}

const hourIndexAt = (ds: EnergyDataset, t: number) =>
  Math.max(0, Math.min(ds.timeline.hours - 1, Math.floor((t - ds.timeline.startMs) / HOUR_MS)));

/** Waste needs a small margin above the band so a 1-2 % wobble does not flicker. */
export const wasteMarginKw = (nominal: number, upper: number) =>
  Math.max(2, 0.05 * nominal, 0.1 * upper);

/** Readings of one tick with the waste status (load above the optimal band of that hour). */
export function liveReadings(core: AnalysisCore, tick: LiveTick | null): LiveReadingVM[] {
  if (!tick) return [];
  const { ds } = core;
  const idx = hourIndexAt(ds, tick.t);
  const nominal = new Map(ds.equipment.map((e) => [e.id, e.nominal]));
  return tick.readings.map((r) => {
    const b = core.bands[r.equipmentId];
    const upper = b?.upper[idx] ?? 0;
    const expected = b?.expected[idx] ?? 0;
    const n = nominal.get(r.equipmentId) ?? 0;
    const over = Number.isNaN(r.kw) ? 0 : r.kw - upper;
    const waste = r.status === 'normal' && over > wasteMarginKw(n, upper);
    return {
      equipmentId: r.equipmentId,
      kw: r.kw,
      status: waste ? 'waste' : r.status,
      expectedKw: expected,
      lowerKw: b?.lower[idx] ?? 0,
      upperKw: upper,
      excessKw: r.status === 'normal' || waste ? Math.max(0, over) : 0,
      lastSeen: r.lastSeen,
    };
  });
}

export interface LiveTotals {
  electricKw: number;
  gasM3h: number;
  expectedKw: number;
  /** electricity above the optimal band right now */
  excessKw: number;
  counts: Record<LiveStatus, number>;
  peakLimitKw: number;
  headroomKw: number;
  /** headroom as share of the limit, % */
  headroomPct: number;
}

export function liveTotals(
  equipment: Equipment[],
  readings: LiveReadingVM[],
  peakLimitKw: number,
): LiveTotals {
  const energy = new Map(equipment.map((e) => [e.id, e.energy]));
  const counts: Record<LiveStatus, number> = { normal: 0, waste: 0, stopped: 0, offline: 0 };
  let electricKw = 0;
  let gasM3h = 0;
  let expectedKw = 0;
  let excessKw = 0;
  for (const r of readings) {
    counts[r.status]++;
    const kw = Number.isNaN(r.kw) ? 0 : r.kw;
    if (energy.get(r.equipmentId) === 'gas') {
      gasM3h += kw;
      continue;
    }
    electricKw += kw;
    expectedKw += r.expectedKw;
    excessKw += r.status === 'waste' ? r.excessKw : 0;
  }
  const headroomKw = peakLimitKw - electricKw;
  return {
    electricKw,
    gasM3h,
    expectedKw,
    excessKw,
    counts,
    peakLimitKw,
    headroomKw,
    headroomPct: peakLimitKw > 0 ? (headroomKw / peakLimitKw) * 100 : 0,
  };
}

export interface WorkshopLive {
  id: string;
  name: string;
  totalKw: number;
  gasM3h: number;
  /** most severe status inside the workshop */
  worst: LiveStatus;
  items: (LiveReadingVM & { equipment: Equipment })[];
}

const STATUS_RANK: Record<LiveStatus, number> = { offline: 3, waste: 2, normal: 1, stopped: 0 };

/** Readings grouped by workshop, in plant order (schematic and its table alternative). */
export function workshopLive(ds: EnergyDataset, readings: LiveReadingVM[]): WorkshopLive[] {
  const byId = new Map(readings.map((r) => [r.equipmentId, r]));
  return ds.plant.workshops
    .map((w) => {
      const items = ds.equipment
        .filter((e) => e.workshop === w.id)
        .map((e) => {
          const r = byId.get(e.id) ?? {
            equipmentId: e.id,
            kw: Number.NaN,
            status: 'offline' as const,
            expectedKw: 0,
            lowerKw: 0,
            upperKw: 0,
            excessKw: 0,
            lastSeen: 0,
          };
          return { ...r, equipment: e };
        });
      let totalKw = 0;
      let gasM3h = 0;
      let worst: LiveStatus = 'stopped';
      for (const it of items) {
        const kw = Number.isNaN(it.kw) ? 0 : it.kw;
        if (it.equipment.energy === 'gas') gasM3h += kw;
        else totalKw += kw;
        if (STATUS_RANK[it.status] > STATUS_RANK[worst]) worst = it.status;
      }
      return { id: w.id, name: w.name, totalKw, gasM3h, worst, items };
    })
    .filter((w) => w.items.length > 0);
}

export interface LivePowerPoint {
  t: number;
  kw: number;
}

export interface LivePowerSeries {
  points: LivePowerPoint[];
  currentKw: number;
  maxKw: number;
  maxT: number;
  avgKw: number;
  peakLimitKw: number;
  /** minutes above the limit within the window */
  overLimitPoints: number;
}

/** Total electric power per tick for the last-60-minute chart. */
export function livePowerSeries(ticks: LiveTick[], peakLimitKw: number): LivePowerSeries {
  const points = ticks.map((t) => ({ t: t.t, kw: t.totalKw }));
  let maxKw = 0;
  let maxT = 0;
  let sum = 0;
  let over = 0;
  for (const p of points) {
    sum += p.kw;
    if (p.kw > maxKw) {
      maxKw = p.kw;
      maxT = p.t;
    }
    if (p.kw > peakLimitKw) over++;
  }
  return {
    points,
    currentKw: points[points.length - 1]?.kw ?? 0,
    maxKw,
    maxT,
    avgKw: points.length ? sum / points.length : 0,
    peakLimitKw,
    overLimitPoints: over,
  };
}

export type LiveEventKind =
  | 'start'
  | 'stop'
  | 'offline'
  | 'online'
  | 'waste_start'
  | 'waste_end'
  | 'load_up'
  | 'load_down'
  | 'peak_near'
  | 'anomaly';

export interface LiveEvent {
  id: string;
  t: number;
  kind: LiveEventKind;
  equipmentId?: string;
  /** relative change in % for load events */
  pct?: number;
  kw?: number;
  rule?: AnomalyRule;
  severity?: Severity;
  anomalyId?: string;
  group?: EquipmentGroupId | 'plant';
  /** number of machines for multi-equipment anomaly events */
  count?: number;
}

export interface LiveEventOptions {
  /** relative change between consecutive ticks that counts as a load event, % */
  loadChangePct?: number;
  peakLimitKw?: number;
  /** share of the peak limit that triggers the "approaching limit" event */
  peakWarnShare?: number;
  /** minimum minutes between two identical events of the same machine */
  cooldownMinutes?: number;
  limit?: number;
}

/**
 * Event feed: state changes between consecutive ticks (start, stop, lost
 * connection, waste begins/ends, load change ≥ 15 %, approaching the peak
 * limit) plus anomaly occurrences detected since midnight.
 */
export function liveEvents(
  core: AnalysisCore,
  ticks: LiveTick[],
  anomalies: Anomaly[] = [],
  o: LiveEventOptions = {},
): LiveEvent[] {
  const loadPct = o.loadChangePct ?? 15;
  const peakLimit = o.peakLimitKw ?? core.ds.plant.peakLimitKw;
  const warnAt = peakLimit * (o.peakWarnShare ?? 0.9);
  const cooldown = (o.cooldownMinutes ?? 10) * 60_000;
  const nominal = new Map(core.ds.equipment.map((e) => [e.id, e.nominal]));
  const out: LiveEvent[] = [];
  const lastAt = new Map<string, number>();
  /** the same event for the same machine is reported at most once per cooldown */
  const emit = (ev: LiveEvent) => {
    const key = `${ev.equipmentId ?? 'plant'}:${ev.kind}`;
    const prevT = lastAt.get(key);
    if (prevT !== undefined && ev.t - prevT < cooldown) return;
    lastAt.set(key, ev.t);
    out.push(ev);
  };
  // hysteresis: a machine enters waste above band + margin and leaves it only below the band
  const state = new Map<string, { status: LiveStatus; kw: number }>();
  const running = (s: LiveStatus) => s === 'normal' || s === 'waste';
  if (ticks.length) for (const r of liveReadings(core, ticks[0])) state.set(r.equipmentId, r);
  let peakArmed = (ticks[0]?.totalKw ?? 0) < warnAt;
  for (let k = 1; k < ticks.length; k++) {
    const tick = ticks[k];
    for (const r of liveReadings(core, tick)) {
      const p = state.get(r.equipmentId);
      let status = r.status;
      if (status === 'normal' && p?.status === 'waste' && r.kw > r.upperKw) status = 'waste';
      // start/stop hysteresis around the 3 % "stopped" threshold of the meter
      const n = nominal.get(r.equipmentId) ?? 0;
      if (status === 'stopped' && p && running(p.status) && r.kw >= 0.015 * n) status = p.status;
      if (running(status) && p?.status === 'stopped' && r.kw < 0.06 * n) status = 'stopped';
      state.set(r.equipmentId, { status, kw: r.kw });
      if (!p) continue;
      const id = `${tick.t}:${r.equipmentId}`;
      const base = { t: tick.t, equipmentId: r.equipmentId };
      if (status === 'offline' && p.status !== 'offline') {
        emit({ ...base, id: `${id}:offline`, kind: 'offline', t: r.lastSeen || tick.t });
      } else if (p.status === 'offline' && status !== 'offline') {
        emit({ ...base, id: `${id}:online`, kind: 'online', kw: r.kw });
      } else if (p.status === 'stopped' && running(status)) {
        emit({ ...base, id: `${id}:start`, kind: 'start', kw: r.kw });
      } else if (running(p.status) && status === 'stopped') {
        emit({ ...base, id: `${id}:stop`, kind: 'stop', kw: r.kw });
      } else if (p.status === 'normal' && status === 'waste') {
        emit({ ...base, id: `${id}:waste`, kind: 'waste_start', kw: r.excessKw });
      } else if (p.status === 'waste' && status === 'normal') {
        emit({ ...base, id: `${id}:wasteEnd`, kind: 'waste_end', kw: r.kw });
      } else if (running(status) && p.kw > 0) {
        const change = ((r.kw - p.kw) / p.kw) * 100;
        const minAbs = Math.max(3, 0.05 * (nominal.get(r.equipmentId) ?? 0));
        if (Math.abs(change) >= loadPct && Math.abs(r.kw - p.kw) >= minAbs) {
          emit({
            ...base,
            id: `${id}:load`,
            kind: change > 0 ? 'load_up' : 'load_down',
            pct: change,
            kw: r.kw,
          });
        }
      }
    }
    if (peakArmed && tick.totalKw >= warnAt) {
      emit({ id: `${tick.t}:peak`, t: tick.t, kind: 'peak_near', kw: tick.totalKw });
      peakArmed = false;
    } else if (tick.totalKw < warnAt * 0.95) peakArmed = true;
  }
  // anomaly occurrences since midnight (what the AI detected today)
  const last = ticks[ticks.length - 1]?.t ?? core.ds.timeline.nowMs;
  const from = core.ds.days[core.todayDay].start;
  for (const a of anomalies) {
    const byStart = new Map<number, number>();
    for (const occ of a.occurrences) {
      if (occ.start < from || occ.start > last) continue;
      byStart.set(occ.start, (byStart.get(occ.start) ?? 0) + 1);
    }
    for (const [start, n] of byStart) {
      const machines = a.rule === 'peak_power' ? Math.round(a.metrics.starts ?? 0) : n;
      out.push({
        id: `${a.id}:${start}`,
        t: start,
        kind: 'anomaly',
        equipmentId: machines > 1 || a.rule === 'peak_power' ? undefined : a.equipmentIds[0],
        group: a.group,
        rule: a.rule,
        severity: a.severity,
        anomalyId: a.id,
        count: machines,
      });
    }
  }
  return out.sort((x, y) => y.t - x.t || x.id.localeCompare(y.id)).slice(0, o.limit ?? 40);
}

export interface ShiftStatus {
  active: boolean;
  /** 1-based shift number of the day */
  shiftNo: number;
  start: number;
  end: number;
  /** elapsed share of the shift, 0..1 */
  progress: number;
  planTons: number;
  planToNowTons: number;
  actualTons: number;
  /** actual vs plan to now, % */
  deltaPct: number;
  /** next production start when no shift is running */
  nextStart: number | null;
}

/** Current shift with production plan vs actual (from the hourly production intensity). */
export function shiftStatus(core: AnalysisCore, nowMs: number): ShiftStatus {
  const { ds } = core;
  const idx = hourIndexAt(ds, nowMs);
  const day = ds.days[ds.timeline.dayIndex[idx]];
  const hour = (nowMs - day.start) / HOUR_MS;
  const sched =
    day.dayType === 'workday'
      ? ds.plant.schedule.weekday
      : day.dayType === 'saturday'
        ? ds.plant.schedule.saturday
        : null;
  const shifts = sched
    ? ds.plant.shifts.filter((s) => s.start >= sched.start && s.end <= sched.end)
    : [];
  const k = shifts.findIndex((s) => hour >= s.start && hour < s.end);
  if (k < 0 || day.productionHours <= 0) {
    let next: number | null = null;
    for (let i = idx + 1; i < ds.timeline.hours; i++) {
      if (ds.context.production[i] && !ds.context.production[i - 1]) {
        next = ds.timeline.hourStarts[i];
        break;
      }
    }
    return {
      active: false,
      shiftNo: 0,
      start: 0,
      end: 0,
      progress: 0,
      planTons: 0,
      planToNowTons: 0,
      actualTons: 0,
      deltaPct: 0,
      nextStart: next,
    };
  }
  const s = shifts[k];
  const perHour = day.plannedTons / day.productionHours;
  const elapsed = hour - s.start;
  const first = day.startIndex + s.start;
  let actual = 0;
  for (let i = first; i < idx; i++) actual += ds.context.intensity[i];
  actual += ds.context.intensity[idx] * (hour - Math.floor(hour));
  const planToNow = perHour * elapsed;
  return {
    active: true,
    shiftNo: k + 1,
    start: day.start + s.start * HOUR_MS,
    end: day.start + s.end * HOUR_MS,
    progress: Math.min(1, elapsed / (s.end - s.start)),
    planTons: perHour * (s.end - s.start),
    planToNowTons: planToNow,
    actualTons: actual,
    deltaPct: planToNow > 0 ? (actual / planToNow - 1) * 100 : 0,
    nextStart: null,
  };
}

// ---------------------------------------------------------------------------
// Equipment

/** Hours with a load of at least 3 % of nominal in [from, to). */
export function runHours(
  actual: ArrayLike<number>,
  nominal: number,
  from: number,
  to: number,
): number {
  let n = 0;
  for (let i = from; i < to; i++) {
    const v = actual[i];
    if (!Number.isNaN(v) && v >= 0.03 * nominal) n++;
  }
  return n;
}

export type LoadClass = 'off' | 'idle' | 'partial' | 'full';

export interface HistogramBin {
  /** share of nominal, lower edge */
  from: number;
  /** upper edge (Infinity for the last bin) */
  to: number;
  hours: number;
  /** share of all hours, 0..1 */
  share: number;
  cls: LoadClass;
}

const BIN_EDGES = [0, 0.03, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 1, Infinity];

export const loadClassOf = (share: number): LoadClass =>
  share < 0.03 ? 'off' : share < 0.3 ? 'idle' : share < 0.75 ? 'partial' : 'full';

/** Load distribution in bins of % nominal; classes follow loadProfile (3 / 30 / 75 %). */
export function loadHistogram(
  actual: ArrayLike<number>,
  nominal: number,
  from: number,
  to: number,
): HistogramBin[] {
  const counts = new Array<number>(BIN_EDGES.length - 1).fill(0);
  let n = 0;
  for (let i = from; i < to; i++) {
    const v = actual[i];
    if (Number.isNaN(v)) continue;
    n++;
    const p = v / nominal;
    let b = 0;
    while (b < counts.length - 1 && p >= BIN_EDGES[b + 1]) b++;
    counts[b]++;
  }
  return counts.map((c, b) => ({
    from: BIN_EDGES[b],
    to: BIN_EDGES[b + 1],
    hours: c,
    share: n ? c / n : 0,
    cls: loadClassOf(BIN_EDGES[b]),
  }));
}

export interface HeatmapCellVM extends HeatCell {
  /** actual relative to the busiest cell, 0..1 */
  level: number;
  /** waste in a non-production hour (drawn in the warning colour) */
  excess: boolean;
}

export interface HeatmapView {
  cells: HeatmapCellVM[];
  maxKw: number;
  /** number of idle (non-production) slots */
  idleSlots: number;
  /** idle slots with excess load */
  excessSlots: number;
  /** average weekly excess kWh in idle slots */
  excessKwhPerWeek: number;
}

/** 7×24 heatmap view: intensity per cell, idle slots and idle-hour excess. */
export function heatmapView(cells: HeatCell[], nominal: number): HeatmapView {
  const maxKw = Math.max(1e-6, ...cells.map((c) => c.actual));
  const thr = Math.max(0.5, 0.02 * nominal);
  let idleSlots = 0;
  let excessSlots = 0;
  let excessKwh = 0;
  const out = cells.map((c) => {
    const excess = !c.production && c.n > 0 && c.waste > thr;
    if (!c.production) idleSlots++;
    if (excess) {
      excessSlots++;
      excessKwh += c.waste;
    }
    return { ...c, level: c.actual / maxKw, excess };
  });
  return { cells: out, maxKw, idleSlots, excessSlots, excessKwhPerWeek: excessKwh };
}

export interface MaintenanceSignal {
  kind: 'leak' | 'wear' | 'spikes';
  anomalyId: string;
  days: number;
  increasePct: number;
  refKw: number;
  currentKw: number;
  slopeKwPerDay: number;
  /** spike events for kind = spikes */
  count: number;
}

/**
 * Predictive maintenance flag: a rising night baseload (leak for compressed
 * air, wear otherwise) or repeated spikes. Dismissed anomalies are ignored.
 */
export function maintenanceSignal(anomalies: Anomaly[], eq: Equipment): MaintenanceSignal | null {
  const active = anomalies.filter(
    (a) => a.equipmentIds.includes(eq.id) && a.status !== 'false_alarm' && a.status !== 'resolved',
  );
  const trend = active.find((a) => a.rule === 'baseload_trend');
  if (trend) {
    return {
      kind: eq.group === 'compressed_air' ? 'leak' : 'wear',
      anomalyId: trend.id,
      days: Math.round(trend.metrics.days ?? 0),
      increasePct: trend.metrics.increasePct ?? 0,
      refKw: trend.metrics.refKw ?? 0,
      currentKw: trend.metrics.currentKw ?? 0,
      slopeKwPerDay: trend.metrics.slopeKwPerDay ?? 0,
      count: 1,
    };
  }
  const spikes = active.filter((a) => a.rule === 'spike');
  if (spikes.length) {
    return {
      kind: 'spikes',
      anomalyId: spikes[0].id,
      days: 0,
      increasePct: 0,
      refKw: 0,
      currentKw: 0,
      slopeKwPerDay: 0,
      count: spikes.reduce((s, a) => s + a.occurrences.length, 0),
    };
  }
  return null;
}

/** Chart ranges of the equipment detail: hourly = last 7 days, daily = selected range (≥ 7 days). */
export function equipmentChartRange(
  core: AnalysisCore,
  mode: 'hour' | 'day',
  selected?: ResolvedRange,
): ResolvedRange {
  const { ds } = core;
  const today = core.todayDay;
  let fromDay: number;
  let toDay: number;
  if (mode === 'hour') {
    fromDay = Math.max(0, today - 6);
    toDay = today + 1;
  } else if (selected && selected.toDay - selected.fromDay >= 7) {
    fromDay = selected.fromDay;
    toDay = selected.toDay;
  } else {
    fromDay = Math.max(0, today - 29);
    toDay = today + 1;
  }
  return {
    preset: selected?.preset ?? 'custom',
    fromDay,
    toDay,
    from: ds.days[fromDay].start,
    to: ds.days[toDay - 1].start + DAY_MS,
    resolution: mode,
  };
}

export type EquipmentSortKey =
  | 'name'
  | 'group'
  | 'workshop'
  | 'nominal'
  | 'monthActual'
  | 'wastePct'
  | 'health'
  | 'lastAnomaly'
  | 'status';

export interface EquipmentQuery {
  query?: string;
  group?: EquipmentGroupId | null;
  workshop?: string | null;
  status?: EquipmentRow['status'] | null;
  sort?: EquipmentSortKey;
  dir?: 'asc' | 'desc';
  /** workshop id → name, used for text search and sorting */
  workshopNames?: Record<string, string>;
}

const ROW_STATUS_RANK: Record<EquipmentRow['status'], number> = {
  waste: 2,
  attention: 1,
  normal: 0,
};

const fold = (s: string) => s.toLocaleLowerCase('az').normalize('NFKD').replace(/\p{M}/gu, '');

/** Search, filter and sort the equipment table. */
export function queryEquipment(rows: EquipmentRow[], q: EquipmentQuery): EquipmentRow[] {
  const needle = q.query?.trim() ? fold(q.query.trim()) : '';
  const ws = q.workshopNames ?? {};
  const list = rows.filter((r) => {
    const e = r.equipment;
    if (q.group && e.group !== q.group) return false;
    if (q.workshop && e.workshop !== q.workshop) return false;
    if (q.status && r.status !== q.status) return false;
    if (needle) {
      const hay = fold(`${e.code} ${e.name} ${e.type} ${ws[e.workshop] ?? ''}`);
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const key = q.sort ?? 'wastePct';
  const sign = (q.dir ?? 'desc') === 'asc' ? 1 : -1;
  const val = (r: EquipmentRow): number | string => {
    switch (key) {
      case 'name':
        return r.equipment.code;
      case 'group':
        return r.equipment.group;
      case 'workshop':
        return ws[r.equipment.workshop] ?? r.equipment.workshop;
      case 'nominal':
        return r.equipment.nominal;
      case 'monthActual':
        return r.monthActual;
      case 'wastePct':
        return r.wastePct;
      case 'health':
        return r.health;
      case 'lastAnomaly':
        return r.lastAnomaly?.end ?? 0;
      case 'status':
        return ROW_STATUS_RANK[r.status];
    }
  };
  return [...list].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c =
      typeof x === 'string' && typeof y === 'string'
        ? x.localeCompare(y, 'az')
        : (x as number) - (y as number);
    return c * sign || a.equipment.code.localeCompare(b.equipment.code, 'az');
  });
}

// ---------------------------------------------------------------------------
// Anomalies

export interface AnomalyFilters {
  severity?: Severity[];
  rules?: AnomalyRule[];
  equipmentId?: string | null;
  status?: AnomalyStatus[];
}

export function filterAnomalies<T extends Anomaly>(list: T[], f: AnomalyFilters): T[] {
  return list.filter(
    (a) =>
      (!f.severity?.length || f.severity.includes(a.severity)) &&
      (!f.rules?.length || f.rules.includes(a.rule)) &&
      (!f.equipmentId || a.equipmentIds.includes(f.equipmentId)) &&
      (!f.status?.length || f.status.includes(a.status)),
  );
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
export const STATUS_ORDER: AnomalyStatus[] = ['open', 'investigating', 'resolved', 'false_alarm'];

export type AnomalySortKey = 'start' | 'severity' | 'loss' | 'status';

export function sortAnomalies<T extends Anomaly & { lossAzn?: number }>(
  list: T[],
  key: AnomalySortKey = 'start',
  dir: 'asc' | 'desc' = 'desc',
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  const val = (a: T) =>
    key === 'start'
      ? a.end
      : key === 'severity'
        ? 3 - SEVERITY_ORDER.indexOf(a.severity)
        : key === 'status'
          ? 3 - STATUS_ORDER.indexOf(a.status)
          : (a.lossAzn ?? a.lossKwh + a.lossM3);
  return [...list].sort((a, b) => (val(a) - val(b)) * sign || b.end - a.end);
}

export interface AnomalySummary {
  total: number;
  byStatus: Record<AnomalyStatus, number>;
  bySeverity: Record<Severity, number>;
  lossKwh: number;
  lossM3: number;
  lossAzn: number;
  lossKgCo2: number;
}

export function anomalySummary(
  list: (Anomaly & { lossAzn: number; lossKgCo2: number })[],
): AnomalySummary {
  const byStatus: Record<AnomalyStatus, number> = {
    open: 0,
    investigating: 0,
    resolved: 0,
    false_alarm: 0,
  };
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let lossKwh = 0;
  let lossM3 = 0;
  let lossAzn = 0;
  let lossKgCo2 = 0;
  for (const a of list) {
    byStatus[a.status]++;
    bySeverity[a.severity]++;
    // dismissed alarms are not counted as losses
    if (a.status === 'false_alarm') continue;
    lossKwh += a.lossKwh;
    lossM3 += a.lossM3;
    lossAzn += a.lossAzn;
    lossKgCo2 += a.lossKgCo2;
  }
  return { total: list.length, byStatus, bySeverity, lossKwh, lossM3, lossAzn, lossKgCo2 };
}

/** Scope and range of the anomaly detail chart (hourly up to 8 days, else daily). */
export function anomalyChartScope(
  core: AnalysisCore,
  a: Anomaly,
): { eqIds: string[]; range: ResolvedRange } {
  const { ds } = core;
  const dayOf = (t: number) => ds.timeline.dayIndex[hourIndexAt(ds, t)];
  let fromDay = dayOf(a.start);
  let toDay = dayOf(Math.max(a.start, a.end - 1)) + 1;
  const span = toDay - fromDay;
  const hourly = span <= 8;
  if (!hourly) {
    fromDay = Math.max(0, fromDay - 3);
    toDay = Math.min(ds.days.length, toDay + 3);
  }
  toDay = Math.min(toDay, core.todayDay + 1);
  fromDay = Math.min(fromDay, toDay - 1);
  const eqIds = a.equipmentIds.length ? a.equipmentIds : core.electricIds;
  return {
    eqIds,
    range: {
      preset: 'custom',
      fromDay,
      toDay,
      from: ds.days[fromDay].start,
      to: ds.days[toDay - 1].start + DAY_MS,
      resolution: hourly ? 'hour' : 'day',
    },
  };
}

export interface TimelineItem {
  id: string;
  severity: Severity;
  status: AnomalyStatus;
  /** 0..1 position of the anomaly span in the window */
  x0: number;
  x1: number;
  /** occurrence marks, 0..1 */
  marks: { x0: number; x1: number }[];
  /** sub-row inside the lane (overlapping items are stacked) */
  row: number;
}

export interface TimelineLane {
  key: EquipmentGroupId | 'plant';
  rows: number;
  items: TimelineItem[];
}

/** Lanes per equipment group with interval packing; items outside the window are dropped. */
export function timelineLayout(
  anomalies: Anomaly[],
  from: number,
  to: number,
  order: (EquipmentGroupId | 'plant')[],
): TimelineLane[] {
  const span = Math.max(1, to - from);
  const pos = (t: number) => Math.max(0, Math.min(1, (t - from) / span));
  const lanes: TimelineLane[] = [];
  for (const key of order) {
    const mine = anomalies
      .filter((a) => a.group === key && a.end > from && a.start < to)
      .sort((a, b) => a.start - b.start);
    if (!mine.length) continue;
    const rowEnds: number[] = [];
    const items = mine.map((a) => {
      const x0 = pos(a.start);
      const x1 = Math.max(x0 + 0.004, pos(a.end));
      let row = rowEnds.findIndex((e) => e <= x0 + 1e-9);
      if (row < 0) {
        row = rowEnds.length;
        rowEnds.push(x1);
      } else rowEnds[row] = x1;
      return {
        id: a.id,
        severity: a.severity,
        status: a.status,
        x0,
        x1,
        marks: a.occurrences.map((o) => ({ x0: pos(o.start), x1: pos(o.end) })),
        row,
      };
    });
    lanes.push({ key, rows: rowEnds.length, items });
  }
  return lanes;
}

export interface AnomalyTitle {
  /** i18n key in common.json */
  key: string;
  equipment: string;
  hours: number;
  pct: number;
  count: number;
}

/** Title template and its raw parameters (formatted by the page). */
export function anomalyTitle(a: Anomaly & { equipmentNames: string[] }): AnomalyTitle {
  const m = a.metrics;
  return {
    key: `anomaly.title.${a.rule}`,
    equipment: a.equipmentNames.join(', '),
    hours: m.totalHours ?? 0,
    pct:
      a.rule === 'enpi_degradation'
        ? (m.deviationPct ?? 0)
        : a.rule === 'baseload_trend'
          ? (m.increasePct ?? 0)
          : 0,
    count: a.rule === 'peak_power' && m.starts ? Math.round(m.starts) : a.equipmentIds.length,
  };
}

/** Duration of an anomaly in hours (sum of its occurrences). */
export const anomalyHours = (a: Anomaly) =>
  a.occurrences.reduce((s, o) => s + (o.end - o.start), 0) / HOUR_MS;
