import { fixture, rates } from '@/test/fixture';
import { energyValue } from '../cost';
import { defaultMvOptions, evaluateMeasure } from '../mv';
import {
  cumulativeByMeasure,
  evaluateMeasureOption,
  measureValues,
  mvChartSeries,
  mvExplain,
  mvSummary,
} from './mvView';

const a = fixture();
const byId = Object.fromEntries(a.measures.map((m) => [m.id, m]));

describe('M&V view models (spec 5.8 / 7.10)', () => {
  it('summary: verified savings exclude measures still being measured', () => {
    const s = mvSummary(a.measures, rates);
    const ver = a.measures.filter((m) => m.status !== 'measuring');
    expect(s.verifiedKwh).toBeCloseTo(
      ver.reduce((x, m) => x + m.avoidedKwh, 0),
      6,
    );
    expect(s.preliminaryKwh).toBeCloseTo(byId['m-office-hvac'].avoidedKwh, 6);
    expect(s.verifiedAzn).toBeCloseTo(energyValue(s.verifiedKwh, 0, rates), 6);
    expect(s.counts).toEqual({ measuring: 1, verified: 2, below_expected: 1 });
    expect(s.total).toBe(4);
    expect(s.verifiedCount).toBe(3);
    expect(s.paybackMonths).toBeCloseTo(s.investmentAzn / s.monthlyAzn, 6);
    expect(s.achievedPct).toBeGreaterThan(50);
    expect(mvSummary([], rates).paybackMonths).toBe(0);
  });

  it('cumulative per measure ends at the total avoided energy', () => {
    const c = cumulativeByMeasure(a.measures, rates);
    const last = c.at(-1)!;
    expect(last.totalKwh).toBeCloseTo(
      a.measures.reduce((s, m) => s + m.avoidedKwh, 0),
      3,
    );
    expect(last.byMeasure['m-led-shop']).toBeCloseTo(byId['m-led-shop'].avoidedKwh, 3);
    expect(last.byMeasureAzn['m-led-shop']).toBeCloseTo(
      energyValue(byId['m-led-shop'].avoidedKwh, 0, rates),
      6,
    );
    expect(last.verifiedKwh).toBeLessThan(last.totalKwh);
    for (let i = 1; i < c.length; i++) expect(c[i].key > c[i - 1].key).toBe(true);
  });

  it('explanation: naive + routine adjustment = avoided energy', () => {
    for (const r of a.measures) {
      const x = mvExplain(a, r);
      expect(x.naiveSavingKwh + x.routineAdjustmentKwh).toBeCloseTo(x.avoidedKwh, 3);
      expect(x.avoidedKwh).toBeCloseTo(r.adjustedBaselineKwh - r.actualKwh, 3);
      expect(x.tempDeltaC).toBeCloseTo(x.reportMeanTempC - x.baselineMeanTempC, 6);
      expect(x.significant).toBe(r.avoidedKwh > r.ciKwh);
      expect(x.negative).toBe(false);
    }
  });

  it('Option B reproduces evaluateMeasure, Option C compares with the equipment expectation', () => {
    const m = a.ds.measures.find((x) => x.id === 'm-led-shop')!;
    const b = evaluateMeasureOption(a, m, 'B');
    const ref = evaluateMeasure(a, m, { ...defaultMvOptions, method: 'B' });
    expect(b.avoidedKwh).toBeCloseTo(ref.avoidedKwh, 6);
    expect(b.status).toBe(ref.status);
    expect(b.optionCUnsuitable).toBe(false);
    const c = evaluateMeasureOption(a, m, 'C');
    expect(c.method).toBe('C');
    expect(c.equipmentIds).toEqual(a.electricIds);
    expect(c.expectedKwh).toBeCloseTo(b.expectedKwh, 6);
    expect(c.boundarySharePct).toBeLessThan(10);
    expect(c.optionCUnsuitable).toBe(true);
    expect(['verified', 'below_expected']).toContain(c.status);
    // whole facility: other changes dominate a 1 % measure in this boundary
    expect(mvExplain(a, c).negative).toBe(c.avoidedKwh < 0);
    const office = evaluateMeasureOption(
      a,
      a.ds.measures.find((x) => x.id === 'm-office-hvac')!,
      'C',
    );
    expect(office.status).toBe('measuring');
  });

  it('chart series: weekly means keep every day, avoided area only in reporting', () => {
    const r = byId['m-im-servo'];
    const day = mvChartSeries(r, 'day');
    expect(day).toHaveLength(r.daily.length);
    const week = mvChartSeries(r, 'week');
    expect(week.reduce((s, p) => s + p.days, 0)).toBe(r.daily.length);
    expect(week.length).toBeLessThan(day.length / 5);
    expect(week.filter((p) => p.period === 'baseline').every((p) => p.avoided === null)).toBe(true);
    expect(week.some((p) => p.avoided !== null)).toBe(true);
    expect(new Date(week[0].t).getTime()).toBe(r.baselineFrom);
  });

  it('values: money, CO₂ and the confidence range', () => {
    const r = byId['m-ct-vsd'];
    const v = measureValues(r, rates);
    expect(v.avoidedAzn).toBeCloseTo(r.avoidedKwh * rates.electricityRateAznPerKwh, 6);
    expect(v.avoidedTCo2).toBeCloseTo((r.avoidedKwh * rates.scope2KgCo2PerKwh) / 1000, 9);
    expect(v.ciHighKwh - v.ciLowKwh).toBeCloseTo(2 * r.ciKwh, 9);
    expect(v.achievedPct).toBeLessThan(80);
  });
});
