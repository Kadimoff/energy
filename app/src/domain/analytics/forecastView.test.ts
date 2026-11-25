import type { RecommendationState } from '@/data/types';
import { fixture, rates } from '@/test/fixture';
import { electricityCost, energyValue } from '../cost';
import { monthDayRange } from '../forecast';
import { defaultScenario, runScenario } from '../scenario';
import {
  beforeAfterSeries,
  changeableDays,
  compareOutcomes,
  fanSeries,
  horizonForecast,
  horizonRange,
  normalizeScenario,
  outcomeDeltas,
  periodBudgetForecast,
  recommendationChecklist,
  scenarioChanges,
} from './forecastView';

const a = fixture();
const states: Record<string, RecommendationState> = {
  'rec-air-leaks': { status: 'approved', updatedAt: 0 },
  'rec-lighting-zones': {
    status: 'scheduled',
    scheduledFor: a.ds.days[a.todayDay + 5].start,
    updatedAt: 0,
  },
  'rec-comp-vsd': { status: 'rejected', rejectReason: 'other', updatedAt: 0 },
};

describe('forecast horizons (spec 5.4 / 7.8)', () => {
  it('month range equals the calendar month, quarter covers three months', () => {
    const m = horizonRange(a, 'month');
    expect(m).toMatchObject({ ...monthDayRange(a, 0), months: 1, complete: true });
    const q = horizonRange(a, 'quarter');
    // FIXED_NOW = 25 Nov 2026 -> Q4: 1 Oct .. 31 Dec (data runs to the end of next month)
    expect(q.toDay - q.fromDay).toBe(92);
    expect(q.months).toBe(3);
    expect(q.complete).toBe(true);
    expect(new Date(q.from).getMonth()).toBe(9);
  });

  it('month-end forecast with P10–P90, budget and overrun probability', () => {
    const f = horizonForecast(a, 'month', rates, a.engine, states);
    expect(f.total).toBeCloseTo(f.actualToDate + f.remaining, 3);
    expect(f.costMean).toBeCloseTo(electricityCost(f.total, rates), 6);
    expect(f.costP10).toBeLessThan(f.costMean);
    expect(f.costP90).toBeGreaterThan(f.costMean);
    expect(f.budgetAzn).toBe(rates.electricityBudgetAzn);
    expect(f.overrunProbability).toBeGreaterThan(0.5);
    expect(f.overrunAzn).toBeCloseTo(f.costMean - f.budgetAzn, 6);
    expect(f.actualToDateAzn).toBeCloseTo(energyValue(f.actualToDate, 0, rates), 6);
    expect(f.remainingAzn).toBeCloseTo(energyValue(f.remaining, 0, rates), 6);
    expect(f.elapsedDays + (f.totalDays - f.elapsedDays)).toBe(30);
  });

  it('quarter budget = 3 × monthly budget and fixed fee per month', () => {
    const q = horizonForecast(a, 'quarter', rates, a.engine, states);
    expect(q.budgetAzn).toBe(3 * rates.electricityBudgetAzn);
    expect(q.costMean).toBeCloseTo(electricityCost(q.total, rates, 3), 6);
    const rich = periodBudgetForecast(q, { ...rates, electricityBudgetAzn: 1e9 }, 3);
    expect(rich.overrunProbability).toBeLessThan(0.001);
    const certain = periodBudgetForecast({ ...q, sd: 0 }, { ...rates, electricityBudgetAzn: 1 }, 3);
    expect(certain.overrunProbability).toBe(1);
  });

  it('fan: actual for complete days, bands ordered and anchored, ends at the forecast', () => {
    const f = horizonForecast(a, 'month', rates, a.engine, states);
    const fan = fanSeries(f, rates);
    expect(fan).toHaveLength(f.days.length);
    const anchor = fan.findIndex((p) => p.mean !== null);
    expect(fan[anchor].actual).not.toBeNull();
    expect(fan[anchor].p10).toBeCloseTo(fan[anchor].actual!, 6);
    expect(fan.slice(0, anchor).every((p) => p.mean === null && p.actual !== null)).toBe(true);
    for (const p of fan.slice(anchor + 1)) {
      expect(p.actual).toBeNull();
      expect(p.p10!).toBeLessThanOrEqual(p.p25!);
      expect(p.p25!).toBeLessThanOrEqual(p.mean!);
      expect(p.mean!).toBeLessThanOrEqual(p.p75!);
      expect(p.p75!).toBeLessThanOrEqual(p.p90!);
    }
    const last = fan.at(-1)!;
    expect(last.mean).toBeCloseTo(f.costMean, 6);
    expect(last.p90).toBeCloseTo(f.costP90, 6);
    expect(last.budgetPace).toBeCloseTo(f.budgetAzn, 6);
  });
});

describe('what-if simulator wiring (spec 7.8)', () => {
  const run = (patch: Partial<typeof defaultScenario>) =>
    runScenario(
      a,
      a.engine,
      states,
      rates,
      normalizeScenario({ ...defaultScenario, ...patch }, rates),
    );
  const base = run({});

  it('the unchanged scenario equals the base forecast (no float or tons drift)', () => {
    const d = outcomeDeltas(base.base, base.scenario);
    expect(d.every((x) => x.better === null)).toBe(true);
    expect(base.scenario.tons).toBeCloseTo(base.base.tons, 6);
    expect(base.scenario.enpiKwhPerT).toBeCloseTo(base.base.enpiKwhPerT, 3);
    expect(changeableDays(base)).toBe(6);
  });

  it('each control moves the right outputs', () => {
    const prod = run({ productionPct: 10 });
    expect(prod.scenario.tons).toBeGreaterThan(base.scenario.tons);
    expect(prod.scenario.kwh).toBeGreaterThan(base.scenario.kwh);
    expect(prod.scenario.enpiKwhPerT).toBeLessThan(base.scenario.enpiKwhPerT);

    const shifts = run({ shifts: 3 });
    expect(shifts.scenario.kwh).toBeGreaterThan(base.scenario.kwh);

    const rec = run({ recommendationIds: ['rec-ext-standby', 'rec-chiller-weekend'] });
    expect(rec.scenario.kwh).toBeLessThan(base.scenario.kwh);
    expect(rec.scenario.costAzn).toBeLessThan(base.scenario.costAzn);

    const tariff = run({ tariffAznPerKwh: rates.electricityRateAznPerKwh * 1.2 });
    expect(tariff.scenario.kwh).toBeCloseTo(base.scenario.kwh, 3);
    expect(tariff.scenario.costAzn).toBeGreaterThan(base.scenario.costAzn);
    expect(tariff.scenario.co2T).toBeCloseTo(base.scenario.co2T, 6);

    const grid = run({ gridKgCo2PerKwh: 0.3 });
    expect(grid.scenario.co2T).toBeLessThan(base.scenario.co2T);
    expect(grid.scenario.costAzn).toBeCloseTo(base.scenario.costAzn, 6);

    const next = run({ monthOffset: 1, productionPct: 10 });
    expect(changeableDays(next)).toBe(next.daily.length);
    const deltas = outcomeDeltas(next.base, next.scenario);
    expect(deltas.find((d) => d.metric === 'enpiKwhPerT')!.better).toBe(true);
    expect(deltas.find((d) => d.metric === 'kwh')!.better).toBe(false);
  });

  it('normalises inputs and names the changes', () => {
    const n = normalizeScenario(
      {
        ...defaultScenario,
        productionPct: 44.4,
        tempDeltaC: -3.3,
        recommendationIds: ['b', 'a', 'b'],
        tariffAznPerKwh: rates.electricityRateAznPerKwh,
        gridKgCo2PerKwh: 0.3,
      },
      rates,
    );
    expect(n.productionPct).toBe(30);
    expect(n.tempDeltaC).toBe(-3.5);
    expect(n.recommendationIds).toEqual(['a', 'b']);
    expect(n.tariffAznPerKwh).toBeUndefined();
    expect(n.gridKgCo2PerKwh).toBe(0.3);
    expect(scenarioChanges(defaultScenario, rates)).toEqual([]);
    expect(scenarioChanges({ ...n, shifts: 3, monthOffset: 1 }, rates).map((c) => c.key)).toEqual([
      'month',
      'production',
      'temperature',
      'shifts',
      'recommendations',
      'grid',
    ]);
  });

  it('before/after series and side-by-side comparison', () => {
    const r = run({ shifts: 1 });
    const s = beforeAfterSeries(r);
    expect(s.at(-1)!.cumBase).toBeCloseTo(r.base.kwh, 3);
    expect(s.at(-1)!.cumScenario).toBeCloseTo(r.scenario.kwh, 3);
    expect(s.at(-1)!.cumDiff).toBeCloseTo(r.scenario.kwh - r.base.kwh, 3);
    expect(s.filter((p) => !p.isFuture).every((p) => Math.abs(p.diff) < 1e-6)).toBe(true);
    const cmp = compareOutcomes(base.scenario, r.scenario);
    expect(cmp.find((c) => c.metric === 'kwh')!.winner).toBe('b');
    expect(compareOutcomes(base.scenario, base.scenario).every((c) => c.winner === null)).toBe(
      true,
    );
  });

  it('checklist marks accepted and rejected recommendations', () => {
    const list = recommendationChecklist(a.engine, states);
    expect(list).toHaveLength(a.engine.recommendations.length);
    expect(list.find((c) => c.id === 'rec-air-leaks')!.active).toBe(true);
    expect(list.find((c) => c.id === 'rec-lighting-zones')!.active).toBe(true);
    expect(list.find((c) => c.id === 'rec-comp-vsd')!.rejected).toBe(true);
    expect(list.find((c) => c.id === 'rec-ext-standby')!.active).toBe(false);
  });
});
