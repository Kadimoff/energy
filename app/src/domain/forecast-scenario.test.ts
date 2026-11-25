import type { RecommendationState } from '@/data/types';
import { fixture, rates } from '@/test/fixture';
import { budgetKwh } from './cost';
import { dailyTotals } from './core';
import {
  electricityBudgetForecast,
  forecastPeriod,
  gasBudgetForecast,
  monthDayRange,
  reductionAt,
} from './forecast';
import { defaultScenario, runScenario } from './scenario';

const a = fixture();
const cur = monthDayRange(a, 0);
const base = forecastPeriod(a, { eqIds: a.electricIds, ...cur, engine: a.engine, recStates: {} });

describe('month-end forecast (spec 5.4)', () => {
  it('= actual so far + model forecast for the remaining hours', () => {
    expect(cur.toDay - cur.fromDay).toBe(30);
    expect(base.days).toHaveLength(30);
    expect(base.total).toBeCloseTo(base.actualToDate + base.remaining, 3);
    const dt = dailyTotals(a, a.electricIds);
    let past = 0;
    for (let d = cur.fromDay; d < a.todayDay; d++) past += dt.actual[d];
    expect(base.actualToDate).toBeGreaterThan(past);
    expect(base.remaining).toBeGreaterThan(0);
    expect(base.p10).toBeLessThan(base.total);
    expect(base.p90).toBeGreaterThan(base.total);
    expect(base.days.at(-1)!.cumMean).toBeCloseTo(base.total, 3);
    // monthly electricity in the spec range (460-520 MWh)
    expect(base.total / 1000).toBeGreaterThan(460);
    expect(base.total / 1000).toBeLessThan(530);
  });

  it('gives a budget overrun probability and cost', () => {
    const b = electricityBudgetForecast(base, rates);
    expect(b.overrunProbability).toBeGreaterThan(0.5);
    expect(b.overrunProbability).toBeLessThanOrEqual(1);
    expect(b.costP10).toBeLessThan(b.costP90);
    const rich = electricityBudgetForecast(base, { ...rates, electricityBudgetAzn: 200_000 });
    expect(rich.overrunProbability).toBeLessThan(0.01);
    expect(rich.overrunAzn).toBeLessThan(0);
    const exact = electricityBudgetForecast(base, {
      ...rates,
      electricityBudgetAzn: base.total * rates.electricityRateAznPerKwh + 3,
    });
    expect(exact.overrunProbability).toBeCloseTo(0.5, 1);
    expect(budgetKwh(rates)).toBeGreaterThan(0);
    const zeroSd = electricityBudgetForecast({ ...base, sd: 0 }, rates);
    expect([0, 1]).toContain(zeroSd.overrunProbability);
  });

  it('accepted recommendations lower the forecast from their effective date', () => {
    const states: Record<string, RecommendationState> = {
      'rec-chiller-weekend': { status: 'in_progress', updatedAt: 0 },
      'rec-ext-standby': {
        status: 'scheduled',
        scheduledFor: a.ds.days[a.todayDay + 2].start,
        updatedAt: 0,
      },
      'rec-hvac-shifts': { status: 'rejected', updatedAt: 0 },
    };
    const f = forecastPeriod(a, {
      eqIds: a.electricIds,
      ...cur,
      engine: a.engine,
      recStates: states,
    });
    expect(f.total).toBeLessThan(base.total);
    expect(f.recommendationEffect).toBeGreaterThan(0);
    expect(f.actualToDate).toBeCloseTo(base.actualToDate, 6);
    const at = reductionAt(a.engine, states, a.ds.timeline.nowMs);
    expect(at(a.ds.timeline.nowMs)?.['chiller-1']).toBeDefined();
    expect(at(a.ds.timeline.nowMs)?.['ext-1']).toBeUndefined();
    expect(at(a.ds.days[a.todayDay + 3].start)?.['ext-1']).toBeDefined();
    expect(reductionAt(undefined, undefined, 0)(0)).toBeNull();
  });

  it('gas forecast against the gas budget', () => {
    const g = gasBudgetForecast(
      forecastPeriod(a, { eqIds: a.gasIds, ...cur, engine: a.engine, recStates: {} }),
      rates,
    );
    expect(g.total).toBeGreaterThan(38_000);
    expect(g.total).toBeLessThan(55_000);
    expect(g.budgetAzn).toBe(rates.gasBudgetAzn);
    expect(g.overrunProbability).toBeGreaterThanOrEqual(0);
  });
});

describe('what-if simulator (spec 7.8)', () => {
  const run = (over: Partial<typeof defaultScenario>) =>
    runScenario(a, a.engine, {}, rates, { ...defaultScenario, monthOffset: 1, ...over });
  const b = run({});

  it('unchanged inputs reproduce the base case', () => {
    expect(b.scenario.kwh).toBeCloseTo(b.base.kwh, -1);
    expect(b.scenario.costAzn).toBeCloseTo(b.base.costAzn, 0);
    expect(b.daily.length).toBe(monthDayRange(a, 1).toDay - monthDayRange(a, 1).fromDay);
  });

  it('reacts to production, temperature, shifts and recommendations', () => {
    const more = run({ productionPct: 10 });
    expect(more.scenario.tons).toBeGreaterThan(b.base.tons * 1.09);
    expect(more.scenario.kwh).toBeGreaterThan(b.base.kwh);
    expect(more.scenario.enpiKwhPerT).toBeLessThan(b.base.enpiKwhPerT);
    const oneShift = run({ shifts: 1 });
    expect(oneShift.scenario.kwh).toBeLessThan(b.base.kwh);
    expect(oneShift.scenario.tons).toBeLessThan(b.base.tons);
    const threeShifts = run({ shifts: 3 });
    expect(threeShifts.scenario.kwh).toBeGreaterThan(b.base.kwh);
    const colder = run({ tempDeltaC: -5 });
    expect(colder.scenario.m3).toBeGreaterThan(b.base.m3);
    const recs = run({ recommendationIds: a.engine.recommendations.map((r) => r.id) });
    expect(recs.scenario.kwh).toBeLessThan(b.base.kwh * 0.88);
    expect(recs.scenario.deltaVsBudgetAzn).toBeLessThan(0);
    expect(recs.scenario.co2T).toBeLessThan(b.base.co2T);
  });

  it('tariff and grid factor overrides only change money and CO₂', () => {
    const t = run({ tariffAznPerKwh: 0.2, gridKgCo2PerKwh: 0.5 });
    expect(t.scenario.kwh).toBeCloseTo(b.base.kwh, -1);
    expect(t.scenario.costAzn).toBeGreaterThan(b.base.costAzn * 1.7);
    expect(t.scenario.co2T).toBeGreaterThan(b.base.co2T);
  });

  it('current month keeps the measured days', () => {
    const c = runScenario(a, a.engine, {}, rates, { ...defaultScenario, productionPct: 20 });
    const past = c.daily.filter((d) => !d.isFuture);
    expect(past.length).toBeGreaterThan(20);
    expect(past.every((d) => Math.abs(d.base - d.scenario) < 1e-6)).toBe(true);
  });
});
