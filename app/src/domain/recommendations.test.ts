import { baseConfig } from '@/data/config';
import type { RecommendationState } from '@/data/types';
import { fixture, rates } from '@/test/fixture';
import { energyValue } from './cost';
import { dailyTotals } from './core';
import { electricityBudgetForecast, forecastPeriod, monthDayRange } from './forecast';
import {
  ACTIVE_STATUSES,
  combinedMonthlySaving,
  combinedReduction,
  effectiveFrom,
  paybackMonths,
  WEEKS_PER_MONTH,
} from './recommendations';

const a = fixture();
const recs = a.engine.recommendations;
const all = recs.map((r) => r.id);
const accepted = (ids: string[]): Record<string, RecommendationState> =>
  Object.fromEntries(ids.map((id) => [id, { status: 'in_progress', updatedAt: 0 }]));

describe('recommendation engine (spec 9.5)', () => {
  it('produces at least 9 recommendations, one per template, linked to anomalies', () => {
    expect(recs.length).toBeGreaterThanOrEqual(9);
    expect(recs.map((r) => r.id)).toEqual(baseConfig.recommendations.map((r) => r.id));
    for (const r of recs) {
      expect(r.anomalyIds.length, r.id).toBeGreaterThan(0);
      expect(r.confidence).toBeGreaterThanOrEqual(35);
      expect(r.confidence).toBeLessThanOrEqual(97);
    }
  });

  it('a saving never exceeds the waste of the targeted equipment', () => {
    for (const r of recs) {
      const saving = r.kwhPerMonth + r.m3PerMonth;
      expect(saving, r.id).toBeGreaterThan(0);
      expect(saving, r.id).toBeLessThanOrEqual(r.wastePoolPerMonth + 1e-6);
      // pool is measured waste (kWh above the optimal band) of the same equipment
      const ids = r.equipmentIds;
      const dt = dailyTotals(a, ids);
      let w = 0;
      for (let d = a.todayDay - r.windowDays; d < a.todayDay; d++) w += dt.waste[d];
      const perMonth = (w / r.windowDays) * 30.4375;
      expect(saving, r.id).toBeLessThanOrEqual(perMonth * 1.25 + 1);
    }
  });

  it('gas recommendation saves m³, electricity ones kWh; VSD payback 18-30 months', () => {
    const boiler = recs.find((r) => r.id === 'rec-boiler-weekend')!;
    expect(boiler.energy).toBe('gas');
    expect(boiler.kwhPerMonth).toBe(0);
    expect(boiler.m3PerMonth).toBeGreaterThan(1000);
    const vsd = recs.find((r) => r.id === 'rec-comp-vsd')!;
    const months = paybackMonths(
      vsd.investmentAzn,
      energyValue(vsd.kwhPerMonth, vsd.m3PerMonth, rates),
    );
    expect(months).toBeGreaterThanOrEqual(18);
    expect(months).toBeLessThanOrEqual(30);
    const seq = recs.find((r) => r.id === 'rec-ext-sequential')!;
    expect(seq.peakKwReduction).toBeGreaterThan(30);
  });

  it('combined effect has no double counting and stays within the waste pools', () => {
    const comb = combinedMonthlySaving(a.ds, a.engine, all);
    const sum = recs.reduce((s, r) => s + r.kwhPerMonth, 0);
    expect(comb.kwh).toBeLessThanOrEqual(sum + 1e-6);
    expect(comb.kwh).toBeGreaterThan(0.9 * sum);
    // compressors: three overlapping recommendations
    const red = combinedReduction(a.engine, ['rec-comp-schedule', 'rec-air-leaks', 'rec-comp-vsd']);
    for (const id of ['comp-1', 'comp-2', 'comp-3']) {
      const pool = Math.max(
        ...['rec-comp-schedule', 'rec-air-leaks', 'rec-comp-vsd'].flatMap((rid) =>
          a.engine.pools[rid].filter((p) => p.eqId === id).flatMap((p) => [...p.slots]),
        ),
      );
      expect(Math.max(...red[id])).toBeLessThanOrEqual(
        Math.max(pool, Math.max(...a.engine.wasteRate[id])) + 1e-6,
      );
    }
    expect(combinedMonthlySaving(a.ds, a.engine, []).kwh).toBe(0);
  });

  it('all recommendations together cut electricity by 14-18 % and close a month within budget', () => {
    const dt = dailyTotals(a, a.electricIds);
    let last28 = 0;
    for (let d = a.todayDay - 28; d < a.todayDay; d++) last28 += dt.actual[d];
    const runRate = (last28 / 28) * 30.4375;
    const comb = combinedMonthlySaving(a.ds, a.engine, all);
    const share = comb.kwh / runRate;
    expect(share).toBeGreaterThanOrEqual(0.14);
    expect(share).toBeLessThanOrEqual(0.18);
    // full next month: over budget as-is, within budget with all recommendations
    const next = monthDayRange(a, 1);
    const base = electricityBudgetForecast(
      forecastPeriod(a, { eqIds: a.electricIds, ...next, engine: a.engine, recStates: {} }),
      rates,
    );
    const withAll = electricityBudgetForecast(
      forecastPeriod(a, {
        eqIds: a.electricIds,
        ...next,
        engine: a.engine,
        recStates: accepted(all),
      }),
      rates,
    );
    expect(base.costMean).toBeGreaterThan(rates.electricityBudgetAzn);
    expect(withAll.costMean).toBeLessThan(rates.electricityBudgetAzn);
    expect(1 - withAll.total / base.total).toBeGreaterThanOrEqual(0.13);
  });

  it('monthly conversion constant', () => {
    expect(WEEKS_PER_MONTH).toBeCloseTo(4.348, 3);
  });
});

describe('status helpers', () => {
  const now = new Date(2026, 10, 25, 14, 30).getTime();
  it('effective dates per status', () => {
    expect(effectiveFrom(undefined, now)).toBeNull();
    expect(effectiveFrom({ status: 'proposed', updatedAt: 0 }, now)).toBeNull();
    expect(effectiveFrom({ status: 'rejected', updatedAt: 0 }, now)).toBeNull();
    expect(effectiveFrom({ status: 'approved', updatedAt: 0 }, now)).toBe(
      new Date(2026, 10, 26).getTime(),
    );
    expect(effectiveFrom({ status: 'scheduled', scheduledFor: 123, updatedAt: 0 }, now)).toBe(123);
    expect(effectiveFrom({ status: 'in_progress', updatedAt: 0 }, now)).toBe(now);
    expect(ACTIVE_STATUSES).toContain('verified');
  });
  it('payback', () => {
    expect(paybackMonths(0, 100)).toBe(0);
    expect(paybackMonths(1000, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(paybackMonths(1200, 100)).toBe(12);
  });
});
