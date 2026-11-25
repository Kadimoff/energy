import { MockDataSource } from '@/data/sources/MockDataSource';
import { SCENARIOS } from '@/data/mock/scenarios';
import type { Anomaly, LiveTick } from '@/data/types';
import { fixture, FIXED_NOW, rates } from '@/test/fixture';
import { healthScore, loadProfile, weekHeatmap } from './equipment';
import {
  anomalyChartScope,
  anomalyHours,
  anomalySummary,
  anomalyTitle,
  equipmentChartRange,
  filterAnomalies,
  heatmapView,
  liveEvents,
  livePowerSeries,
  liveReadings,
  liveTotals,
  loadClassOf,
  loadHistogram,
  maintenanceSignal,
  queryEquipment,
  runHours,
  shiftStatus,
  sortAnomalies,
  timelineLayout,
  workshopLive,
} from './ops';
import { anomalyVMs, equipmentRows, resolveRange } from './viewmodels';

const a = fixture();
const HOUR = 3_600_000;
const src = new MockDataSource({ now: () => FIXED_NOW });
src.adopt(a.ds);
const history: LiveTick[] = src.liveHistory(60);
const vms = anomalyVMs(a.anomalies, {}, rates, a.ds.equipment);

describe('live monitoring selectors', () => {
  it('readings carry the optimal band and a waste status above it', () => {
    const r = liveReadings(a, history[history.length - 1]);
    expect(r).toHaveLength(a.ds.equipment.length);
    expect(r.every((x) => x.upperKw >= x.expectedKw)).toBe(true);
    for (const x of r.filter((y) => y.status === 'waste')) expect(x.kw).toBeGreaterThan(x.upperKw);
    expect(r.find((x) => x.equipmentId === 'ahu-wh')?.status).toBe('offline');
    expect(liveReadings(a, null)).toEqual([]);
  });

  it('totals split electricity and gas and compute peak headroom', () => {
    const r = liveReadings(a, history[history.length - 1]);
    const tot = liveTotals(a.ds.equipment, r, 1280);
    expect(tot.electricKw).toBeCloseTo(history[history.length - 1].totalKw, 3);
    expect(tot.gasM3h).toBeGreaterThanOrEqual(0);
    expect(tot.headroomKw).toBeCloseTo(1280 - tot.electricKw, 6);
    expect(Object.values(tot.counts).reduce((s, n) => s + n, 0)).toBe(a.ds.equipment.length);
    expect(tot.counts.offline).toBe(1);
  });

  it('groups equipment by workshop in plant order with the worst status', () => {
    const ws = workshopLive(a.ds, liveReadings(a, history[history.length - 1]));
    expect(ws.map((w) => w.id)).toEqual(a.ds.plant.workshops.map((w) => w.id));
    expect(ws.reduce((s, w) => s + w.items.length, 0)).toBe(a.ds.equipment.length);
    expect(ws.find((w) => w.id === 'warehouse')?.worst).toBe('offline');
    expect(ws.find((w) => w.id === 'boiler_house')?.gasM3h).toBeGreaterThanOrEqual(0);
    // missing readings are shown as offline
    expect(workshopLive(a.ds, [])[0].items[0].status).toBe('offline');
  });

  it('power series reports current, max and average', () => {
    const s = livePowerSeries(history, 1280);
    expect(s.points).toHaveLength(60);
    expect(s.currentKw).toBe(history[59].totalKw);
    expect(s.maxKw).toBeGreaterThanOrEqual(s.avgKw);
    expect(livePowerSeries([], 1000).currentKw).toBe(0);
    expect(
      livePowerSeries([{ t: 1, totalKw: 1100, gasM3h: 0, readings: [] }], 1000).overLimitPoints,
    ).toBe(1);
  });

  it('event feed: lost connection, load changes and today’s anomalies, newest first', () => {
    const ev = liveEvents(a, history, a.anomalies);
    expect(ev.length).toBeGreaterThan(0);
    for (let i = 1; i < ev.length; i++) expect(ev[i - 1].t).toBeGreaterThanOrEqual(ev[i].t);
    const off = ev.find((e) => e.kind === 'offline');
    expect(off?.equipmentId).toBe('ahu-wh');
    expect(off?.t).toBe(a.ds.offlineEquipment[0].since);
    // anomaly occurrences of today (e.g. K-2 at night) are part of the feed
    const today = a.ds.days[a.todayDay].start;
    expect(ev.filter((e) => e.kind === 'anomaly').every((e) => e.t >= today)).toBe(true);
    expect(liveEvents(a, history, a.anomalies, { limit: 3 })).toHaveLength(3);
  });

  it('event feed detects start, stop, waste and load steps between ticks', () => {
    const base = history[history.length - 1];
    const k2 = base.readings.findIndex((r) => r.equipmentId === 'comp-2');
    const mk = (t: number, kw: number, status: 'normal' | 'stopped', total = base.totalKw) => ({
      ...base,
      t,
      totalKw: total,
      readings: base.readings.map((r, i) => (i === k2 ? { ...r, kw, status, lastSeen: t } : r)),
    });
    const t0 = base.t;
    const idx = Math.floor((t0 - a.ds.timeline.startMs) / HOUR);
    const up = a.bands['comp-2'].upper[idx];
    const ticks = [
      mk(t0, 0, 'stopped'),
      mk(t0 + 5000, Math.max(10, up * 0.6), 'normal'),
      mk(t0 + 10000, Math.max(10, up * 0.6) * 1.3, 'normal'),
      mk(t0 + 15000, up + 30, 'normal', 1250),
      mk(t0 + 20000, Math.max(10, up * 0.6), 'normal'),
      mk(t0 + 25000, 0, 'stopped'),
    ];
    const kinds = liveEvents(a, ticks, [], { peakLimitKw: 1280 })
      .filter((e) => e.equipmentId === 'comp-2' || e.kind === 'peak_near')
      .map((e) => e.kind)
      .reverse();
    // waste_start and peak_near share a timestamp, so compare as a set plus the ends
    expect(new Set(kinds)).toEqual(
      new Set(['start', 'load_up', 'waste_start', 'peak_near', 'waste_end', 'stop']),
    );
    expect([kinds[0], kinds[1], kinds[kinds.length - 1]]).toEqual(['start', 'load_up', 'stop']);
  });

  it('event feed ignores meters flickering around the stopped threshold', () => {
    const base = history[history.length - 1];
    const i = base.readings.findIndex((r) => r.equipmentId === 'ahu-shop');
    const ticks = [1.7, 1.6, 1.7, 1.6, 1.7].map((kw, k) => ({
      ...base,
      t: base.t + k * 5000,
      readings: base.readings.map((r, j) =>
        j === i
          ? { ...r, kw, status: kw < 0.03 * 55 ? ('stopped' as const) : ('normal' as const) }
          : r,
      ),
    }));
    const ev = liveEvents(a, ticks).filter((e) => e.equipmentId === 'ahu-shop');
    expect(ev.filter((e) => e.kind === 'start' || e.kind === 'stop')).toHaveLength(0);
  });

  it('shift status: plan vs actual for the running shift, next start otherwise', () => {
    // FIXED_NOW = Wednesday 14:30, shift 1 (08:00-16:00)
    const s = shiftStatus(a, FIXED_NOW);
    expect(s.active).toBe(true);
    expect(s.shiftNo).toBe(1);
    expect(new Date(s.start).getHours()).toBe(8);
    expect(new Date(s.end).getHours()).toBe(16);
    expect(s.progress).toBeCloseTo(6.5 / 8, 3);
    expect(s.planToNowTons).toBeCloseTo((s.planTons * 6.5) / 8, 6);
    expect(Math.abs(s.deltaPct)).toBeLessThan(10);
    const night = shiftStatus(a, new Date(2026, 10, 25, 3, 0).getTime());
    expect(night.active).toBe(false);
    expect(new Date(night.nextStart!).getHours()).toBe(8);
    const evening = shiftStatus(a, new Date(2026, 10, 24, 18, 0).getTime());
    expect(evening.shiftNo).toBe(2);
  });
});

describe('equipment selectors', () => {
  const rows = equipmentRows(a, vms);
  const cur = a.ds.days[a.ds.timeline.currentMonthStartDay].startIndex;

  it('run hours and load histogram agree with the load profile', () => {
    const k2 = a.ds.readings['comp-2'];
    const now = a.ds.timeline.nowIndex;
    const rh = runHours(k2, 90, cur, now);
    expect(rh).toBeGreaterThan(0);
    expect(rh).toBeLessThanOrEqual(now - cur);
    const h = loadHistogram(k2, 90, now - 28 * 24, now);
    expect(h.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 6);
    const lp = loadProfile(k2, 90, now - 28 * 24, now);
    const byCls = (c: string) => h.filter((b) => b.cls === c).reduce((s, b) => s + b.share, 0);
    expect(byCls('idle')).toBeCloseTo(lp.idle, 6);
    expect(byCls('partial')).toBeCloseTo(lp.partial, 6);
    expect(byCls('full')).toBeCloseTo(lp.full, 6);
    expect(byCls('off')).toBeCloseTo(lp.off, 6);
    expect([loadClassOf(0), loadClassOf(0.2), loadClassOf(0.5), loadClassOf(0.9)]).toEqual([
      'off',
      'idle',
      'partial',
      'full',
    ]);
    expect(loadHistogram([Number.NaN], 1, 0, 1).every((b) => b.share === 0)).toBe(true);
  });

  it('heatmap frames idle hours and flags K-2 night excess in workday idle slots', () => {
    const v = heatmapView(weekHeatmap(a, 'comp-2'), 90);
    expect(v.cells).toHaveLength(168);
    expect(v.idleSlots).toBeGreaterThan(24);
    expect(v.excessSlots).toBeGreaterThan(0);
    // scenario 1: workday nights 01:00-06:30
    const tue3 = v.cells.find((c) => c.weekday === 1 && c.hour === 3)!;
    expect(tue3.production).toBe(false);
    expect(tue3.excess).toBe(true);
    expect(v.cells.every((c) => c.level >= 0 && c.level <= 1)).toBe(true);
    expect(v.cells.filter((c) => c.excess).every((c) => !c.production)).toBe(true);
  });

  it('maintenance flag: rising K-1 baseload means a suspected leak', () => {
    const k1 = a.ds.equipment.find((e) => e.id === 'comp-1')!;
    const s = maintenanceSignal(vms, k1);
    expect(s?.kind).toBe('leak');
    expect(s!.days).toBeGreaterThanOrEqual(7);
    expect(s!.increasePct).toBeGreaterThan(15);
    const dismissed = vms.map((x) =>
      x.id === s!.anomalyId ? { ...x, status: 'false_alarm' as const } : x,
    );
    expect(maintenanceSignal(dismissed, k1)).toBeNull();
    const e3 = a.ds.equipment.find((e) => e.id === 'ext-3')!;
    expect(maintenanceSignal(vms, e3)?.kind).toBe('spikes');
    const office = a.ds.equipment.find((e) => e.id === 'office')!;
    expect(maintenanceSignal(vms, office)).toBeNull();
  });

  it('chart ranges: 7 hourly days, daily range from the selection or last 30 days', () => {
    const h = equipmentChartRange(a, 'hour');
    expect([h.resolution, h.toDay - h.fromDay, h.toDay]).toEqual(['hour', 7, a.todayDay + 1]);
    const m = resolveRange(a, 'month');
    expect(equipmentChartRange(a, 'day', m)).toMatchObject({
      fromDay: m.fromDay,
      resolution: 'day',
    });
    const d = equipmentChartRange(a, 'day', resolveRange(a, 'today'));
    expect(d.toDay - d.fromDay).toBe(30);
  });

  it('search, filter and sort the equipment table', () => {
    const names = Object.fromEntries(a.ds.plant.workshops.map((w) => [w.id, w.name]));
    expect(queryEquipment(rows, { query: 'k-2' }).map((r) => r.equipment.id)).toEqual(['comp-2']);
    // diacritics-insensitive search: "ciller" finds Çiller-1/2
    expect(queryEquipment(rows, { query: 'ciller' })).toHaveLength(2);
    expect(
      queryEquipment(rows, { query: 'anbar', workshopNames: names }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(queryEquipment(rows, { group: 'compressed_air' })).toHaveLength(3);
    expect(queryEquipment(rows, { workshop: 'warehouse' })).toHaveLength(2);
    const waste = queryEquipment(rows, { status: 'waste' });
    expect(waste.every((r) => r.status === 'waste')).toBe(true);
    const byWaste = queryEquipment(rows, {});
    for (let i = 1; i < byWaste.length; i++)
      expect(byWaste[i - 1].wastePct).toBeGreaterThanOrEqual(byWaste[i].wastePct);
    const byNom = queryEquipment(rows, { sort: 'nominal', dir: 'asc' });
    expect(byNom[0].equipment.nominal).toBeLessThanOrEqual(
      byNom[byNom.length - 1].equipment.nominal,
    );
    for (const k of [
      'name',
      'group',
      'workshop',
      'monthActual',
      'health',
      'lastAnomaly',
      'status',
    ] as const) {
      expect(queryEquipment(rows, { sort: k, workshopNames: names })).toHaveLength(rows.length);
    }
    expect(healthScore({ wastePct: 0, openCritical: 0, openHigh: 0, rising: false })).toBe(100);
  });
});

describe('anomaly selectors', () => {
  it('every injected scenario (spec 9.4) is in the unfiltered anomaly list', () => {
    const list = filterAnomalies(vms, {});
    for (const sc of SCENARIOS.filter((s) => s.specNo > 0)) {
      const hit = list.some(
        (x) =>
          x.rule === sc.expectedRule && sc.equipmentIds.some((id) => x.equipmentIds.includes(id)),
      );
      expect(hit, sc.id).toBe(true);
    }
  });

  it('filters by severity, rule, equipment and status', () => {
    expect(
      filterAnomalies(vms, { severity: ['critical'] }).every((x) => x.severity === 'critical'),
    ).toBe(true);
    expect(
      filterAnomalies(vms, { rules: ['peak_power'] }).every((x) => x.rule === 'peak_power'),
    ).toBe(true);
    const k2 = filterAnomalies(vms, { equipmentId: 'comp-2' });
    expect(k2.length).toBeGreaterThan(0);
    expect(k2.every((x) => x.equipmentIds.includes('comp-2'))).toBe(true);
    expect(filterAnomalies(vms, { status: ['resolved'] })).toHaveLength(0);
  });

  it('sorts and summarises; false alarms do not count as loss', () => {
    const byLoss = sortAnomalies(vms, 'loss');
    expect(byLoss[0].lossAzn).toBeGreaterThanOrEqual(byLoss[byLoss.length - 1].lossAzn);
    const bySev = sortAnomalies(vms, 'severity');
    expect(bySev[0].severity).toBe('critical');
    expect(sortAnomalies(vms, 'start', 'asc')[0].end).toBeLessThanOrEqual(
      sortAnomalies(vms)[0].end,
    );
    expect(sortAnomalies(vms, 'status')).toHaveLength(vms.length);
    const s = anomalySummary(vms);
    expect(s.total).toBe(vms.length);
    expect(s.byStatus.open).toBe(vms.length);
    expect(s.lossAzn).toBeCloseTo(
      vms.reduce((x, v) => x + v.lossAzn, 0),
      6,
    );
    const fa = vms.map((v, i) => (i === 0 ? { ...v, status: 'false_alarm' as const } : v));
    expect(anomalySummary(fa).lossAzn).toBeCloseTo(s.lossAzn - vms[0].lossAzn, 6);
    expect(anomalySummary(fa).byStatus.false_alarm).toBe(1);
  });

  it('detail chart scope: hourly for a week, daily for long trends, plant for EnPI', () => {
    const idle = vms.find((x) => x.rule === 'idle_load')!;
    const s = anomalyChartScope(a, idle);
    expect(s.range.resolution).toBe('hour');
    expect(s.eqIds).toEqual(idle.equipmentIds);
    expect(s.range.from).toBeLessThanOrEqual(idle.start);
    expect(s.range.to).toBeGreaterThanOrEqual(Math.min(idle.end, a.ds.days[a.todayDay + 1].start));
    const enpi = vms.find((x) => x.rule === 'enpi_degradation')!;
    expect(anomalyChartScope(a, enpi).eqIds).toEqual(a.electricIds);
    const long: Anomaly = { ...idle, start: idle.start - 20 * 86_400_000 };
    expect(anomalyChartScope(a, long).range.resolution).toBe('day');
  });

  it('timeline lanes pack overlapping anomalies into rows', () => {
    const from = a.ds.timeline.nowMs - 30 * 86_400_000;
    const to = a.ds.timeline.nowMs;
    const lanes = timelineLayout(vms, from, to, [...a.ds.groups.map((g) => g.id), 'plant']);
    expect(lanes.length).toBeGreaterThan(3);
    const n = lanes.reduce((s, l) => s + l.items.length, 0);
    expect(n).toBe(vms.filter((x) => x.end > from && x.start < to).length);
    for (const l of lanes) {
      expect(l.rows).toBe(Math.max(...l.items.map((i) => i.row)) + 1);
      for (const r of new Set(l.items.map((i) => i.row))) {
        const items = l.items.filter((i) => i.row === r).sort((x, y) => x.x0 - y.x0);
        for (let i = 1; i < items.length; i++)
          expect(items[i].x0).toBeGreaterThanOrEqual(items[i - 1].x1);
      }
      for (const it of l.items) expect(it.x1).toBeGreaterThan(it.x0);
    }
  });

  it('title parameters and duration', () => {
    const trend = vms.find((x) => x.rule === 'baseload_trend')!;
    const t = anomalyTitle(trend);
    expect(t.key).toBe('anomaly.title.baseload_trend');
    expect(t.equipment).toBe('K-1');
    expect(t.pct).toBeGreaterThan(15);
    const peak = vms.find((x) => x.rule === 'peak_power')!;
    expect(anomalyTitle(peak).count).toBe(Math.round(peak.metrics.starts));
    expect(anomalyTitle(peak).count).toBeGreaterThanOrEqual(3);
    const enpi = vms.find((x) => x.rule === 'enpi_degradation')!;
    expect(anomalyTitle(enpi).pct).toBeGreaterThanOrEqual(10);
    const idle = vms.find((x) => x.rule === 'idle_load')!;
    expect(anomalyTitle(idle).hours).toBe(idle.metrics.totalHours);
    expect(anomalyHours(idle)).toBeCloseTo(idle.metrics.totalHours, 6);
  });
});
