import { baseConfig } from '@/data/config';
import type { RecommendationState } from '@/data/types';
import { fixture, rates } from '@/test/fixture';
import { dailyTotals, monthlyTotals } from './core';
import { healthScore, loadProfile, openCounts, weekHeatmap } from './equipment';
import { electricityBudgetForecast, forecastPeriod } from './forecast';
import {
  anomalyVMs,
  carbonByMonth,
  chartSeries,
  effectiveRecStates,
  equipmentRows,
  monthBudgetKwh,
  monthOverview,
  recommendationSummary,
  recommendationVMs,
  resolveRange,
  wasteByGroup,
} from './viewmodels';

const a = fixture();
const states: Record<string, RecommendationState> = {
  'rec-air-leaks': { status: 'approved', updatedAt: a.ds.timeline.nowMs },
};

describe('date ranges', () => {
  it('resolves presets against the dataset', () => {
    const today = resolveRange(a, 'today');
    expect(today.resolution).toBe('hour');
    expect(today.toDay - today.fromDay).toBe(1);
    expect(resolveRange(a, '7d').toDay - resolveRange(a, '7d').fromDay).toBe(7);
    const m = resolveRange(a, 'month');
    expect(m.toDay - m.fromDay).toBe(30);
    expect(new Date(m.from).getDate()).toBe(1);
    const q = resolveRange(a, 'quarter');
    expect(new Date(q.from).getMonth()).toBe(9);
    expect(q.toDay - q.fromDay).toBe(92);
    const y = resolveRange(a, 'year');
    expect(new Date(y.from).getMonth()).toBe(11);
    const c = resolveRange(a, 'custom', {
      from: new Date(2026, 9, 1).getTime(),
      to: new Date(2026, 9, 10).getTime(),
    });
    expect(c.toDay - c.fromDay).toBe(10);
    expect(resolveRange(a, 'custom', null).toDay - resolveRange(a, 'custom', null).fromDay).toBe(1);
  });
});

describe('chart series', () => {
  it('daily points with forecast, band, waste and cumulative budget', () => {
    const range = resolveRange(a, 'month');
    const fc = electricityBudgetForecast(
      forecastPeriod(a, { eqIds: a.electricIds, ...range, engine: a.engine, recStates: states }),
      rates,
    );
    const pts = chartSeries(a, {
      eqIds: a.electricIds,
      range,
      forecast: fc,
      monthBudgetKwh: monthBudgetKwh(rates),
    });
    expect(pts).toHaveLength(30);
    const past = pts.filter((p) => p.actual !== null);
    expect(past.length).toBe(a.todayDay - range.fromDay);
    expect(pts.every((p) => p.lower <= p.optimal && p.optimal <= p.upper)).toBe(true);
    expect(pts.at(-1)!.cumBudget).toBeCloseTo(monthBudgetKwh(rates), 0);
    expect(pts.at(-1)!.cumForecast).toBeCloseTo(fc.total, 0);
    // forecast line starts at the last actual point
    const lastActual = past.at(-1)!;
    expect(lastActual.forecast).toBe(lastActual.actual);
    expect(past.some((p) => (p.waste ?? 0) > 0)).toBe(true);
  });
  it('hourly points for today', () => {
    const range = resolveRange(a, 'today');
    const pts = chartSeries(a, { eqIds: ['comp-2'], range });
    expect(pts).toHaveLength(24);
    expect(pts.filter((p) => p.actual !== null)).toHaveLength(14);
    expect(pts[20].forecast).not.toBeNull();
  });
});

describe('view models', () => {
  it('recommendations with money, CO₂, payback and summary', () => {
    const eff = effectiveRecStates({ x: { status: 'proposed', updatedAt: 0 } }, states);
    expect(eff['rec-air-leaks'].status).toBe('approved');
    const vms = recommendationVMs(a.engine.recommendations, states, rates, a.ds.equipment);
    expect(vms[0].aznPerMonth).toBeGreaterThanOrEqual(vms[1].aznPerMonth);
    const leak = vms.find((v) => v.id === 'rec-air-leaks')!;
    expect(leak.status).toBe('approved');
    expect(leak.equipmentNames).toEqual(['K-1', 'K-3']);
    expect(vms.every((v) => v.tCo2PerYear > 0)).toBe(true);
    const sum = recommendationSummary(a, vms, rates);
    expect(sum.pendingCount).toBe(vms.length - 1);
    expect(sum.potentialAznPerMonth).toBeGreaterThan(0);
    expect(sum.acceptedKwhPerMonth).toBeGreaterThan(0);
    expect(sum.acceptedThisMonth).toBe(1);
    expect(sum.allSharePct).toBeGreaterThanOrEqual(14);
    expect(sum.allSharePct).toBeLessThanOrEqual(18);
  });

  it('anomaly view models apply status overrides and losses', () => {
    const first = a.anomalies[0];
    const vms = anomalyVMs(a.anomalies, { [first.id]: 'false_alarm' }, rates, a.ds.equipment);
    expect(vms[0].status).toBe('false_alarm');
    expect(vms.every((v) => v.lossAzn >= 0 && v.lossKgCo2 >= 0)).toBe(true);
    const gas = vms.find((v) => v.energy === 'gas')!;
    expect(gas.lossAzn).toBeCloseTo(gas.lossM3 * rates.gasRateAznPerM3, 6);
  });

  it('month overview KPIs', () => {
    const ov = monthOverview(a, rates, states);
    expect(ov.daysInMonth).toBe(30);
    expect(ov.daysElapsed).toBe(24);
    expect(ov.consumptionKwh.value).toBeGreaterThan(300_000);
    expect(ov.consumptionKwh.spark).toHaveLength(30);
    expect(ov.costAzn.forecastAzn).toBeCloseTo(ov.electricity.costMean, 6);
    expect(ov.enpi.value).toBeGreaterThan(300);
    expect(ov.enpi.spark).toHaveLength(8);
    expect(ov.co2T.value).toBeGreaterThan(100);
    expect(ov.co2T.monthlyTargetT).toBeGreaterThan(0);
    expect(ov.waste.sharePct).toBeGreaterThan(5);
    expect(ov.waste.value).toBeGreaterThan(0);
  });

  it('waste by group, equipment rows, carbon by month', () => {
    const g = wasteByGroup(a, rates, baseConfig);
    expect(g).toHaveLength(8);
    expect(g.every((x) => x.recoverable <= x.waste + 1e-6 && x.productive <= x.actual)).toBe(true);
    expect(g[0].wasteAzn).toBeGreaterThanOrEqual(g[1].wasteAzn);
    const rows = equipmentRows(a, a.anomalies);
    expect(rows).toHaveLength(20);
    const k2 = rows.find((r) => r.equipment.id === 'comp-2')!;
    expect(k2.wastePct).toBeGreaterThan(5);
    expect(k2.lastAnomaly).not.toBeNull();
    const im = rows.find((r) => r.equipment.id === 'im-2')!;
    expect(im.wastePct).toBeLessThan(2);
    expect(im.health).toBeGreaterThan(k2.health);
    expect(rows.filter((r) => r.status === 'normal').length).toBeGreaterThanOrEqual(5);
    const c = carbonByMonth(a, rates);
    expect(c).toHaveLength(13);
    expect(c.at(-1)!.complete).toBe(false);
    expect(c.every((m) => m.totalT > 0 && m.scope1T > 0 && m.scope2T > m.scope1T)).toBe(true);
    expect(monthlyTotals(a, a.gasIds)).toHaveLength(13);
  });
});

describe('equipment indicators', () => {
  it('health, load profile and weekly heatmap', () => {
    expect(healthScore({ wastePct: 0, openCritical: 0, openHigh: 0, rising: false })).toBe(100);
    expect(healthScore({ wastePct: 30, openCritical: 2, openHigh: 1, rising: true })).toBeLessThan(
      40,
    );
    expect(healthScore({ wastePct: 300, openCritical: 9, openHigh: 9, rising: true })).toBe(5);
    const lp = loadProfile(
      a.ds.readings['ext-1'],
      140,
      a.ds.timeline.nowIndex - 24 * 28,
      a.ds.timeline.nowIndex,
    );
    expect(lp.off + lp.idle + lp.partial + lp.full).toBeCloseTo(1, 6);
    expect(lp.hours).toBe(24 * 28);
    expect(loadProfile([Number.NaN], 1, 0, 1).hours).toBe(0);
    const hm = weekHeatmap(a, 'comp-2');
    expect(hm).toHaveLength(168);
    const night = hm.find((c) => c.weekday === 1 && c.hour === 3)!;
    expect(night.production).toBe(false);
    expect(night.waste).toBeGreaterThan(20);
    expect(hm.find((c) => c.weekday === 1 && c.hour === 10)!.production).toBe(true);
    const oc = openCounts(a.anomalies, 'comp-1');
    expect(oc.rising).toBe(true);
  });
  it('daily totals are memoised', () => {
    expect(dailyTotals(a, ['comp-1'])).toBe(dailyTotals(a, ['comp-1']));
  });
});
