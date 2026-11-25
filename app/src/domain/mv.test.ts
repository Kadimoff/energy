import { fixture } from '@/test/fixture';
import { MEASURE_TRUTH } from '@/data/mock/scenarios';
import { cumulativeSavings, defaultMvOptions, evaluateMeasure } from './mv';

const a = fixture();
const byId = Object.fromEntries(a.measures.map((m) => [m.id, m]));

describe('M&V (IPMVP, spec 5.8 / 9.6)', () => {
  it('has 4 measures from the last 6 months, one under-performing', () => {
    expect(a.measures).toHaveLength(4);
    expect(a.measures.every((m) => a.ds.timeline.nowMs - m.implementedAt < 190 * 86_400_000)).toBe(
      true,
    );
    expect(byId['m-im-servo'].status).toBe('verified');
    expect(byId['m-led-shop'].status).toBe('verified');
    expect(byId['m-ct-vsd'].status).toBe('below_expected');
    expect(byId['m-office-hvac'].status).toBe('measuring');
  });

  it('avoided energy = adjusted baseline - actual, close to the true effect', () => {
    for (const m of a.measures) {
      expect(m.avoidedKwh).toBeCloseTo(m.adjustedBaselineKwh - m.actualKwh, 3);
      expect(m.ciKwh).toBeGreaterThan(0);
      expect(m.model.r2).toBeGreaterThan(0.8);
      expect(m.daily.some((d) => d.period === 'baseline')).toBe(true);
    }
    const servo = byId['m-im-servo'];
    expect(servo.savingPct / 100).toBeCloseTo(1 - MEASURE_TRUTH['m-im-servo'], 1);
    expect(byId['m-led-shop'].savingPct).toBeGreaterThan(30);
    expect(servo.expectedKwh).toBeGreaterThan(servo.avoidedKwh * 0.9);
    expect(servo.avoidedPerMonthKwh).toBeGreaterThan(0);
    expect(Math.abs(servo.adjustments.productionPct)).toBeLessThan(15);
  });

  it('Option C uses the whole facility', () => {
    const m = a.ds.measures.find((x) => x.id === 'm-led-shop')!;
    const c = evaluateMeasure(a, m, { ...defaultMvOptions, method: 'C' });
    expect(c.method).toBe('C');
    expect(c.equipmentIds).toEqual(a.electricIds);
    expect(c.adjustedBaselineKwh).toBeGreaterThan(byId['m-led-shop'].adjustedBaselineKwh * 10);
  });

  it('cumulative savings per month are a running total', () => {
    const cum = cumulativeSavings(a.measures);
    expect(cum.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < cum.length; i++) {
      expect(cum[i].key > cum[i - 1].key).toBe(true);
      expect(cum[i].cumulativeKwh).toBeCloseTo(cum[i - 1].cumulativeKwh + cum[i].avoidedKwh, 3);
    }
    const total = a.measures.reduce((s, m) => s + m.avoidedKwh, 0);
    expect(cum.at(-1)!.cumulativeKwh).toBeCloseTo(total, 0);
  });
});
