import { fixture } from '@/test/fixture';
import {
  minuteLabel,
  moveInOrder,
  peakReduction,
  simulatePlan,
  SLOTS_PER_DAY,
  startMinutes,
  suggestPlan,
  workdayProfile,
} from './peak';

const a = fixture();
const lines = a.ds.equipment.filter((e) => e.group === 'extrusion').map((e) => e.id);
const p = workdayProfile(a, lines);
const together = (surgeMin: number) => simulatePlan(p, { order: lines, intervalMin: 0, surgeMin });

describe('peak load planner (spec 7.8, scenario 9.4/6)', () => {
  it('builds a typical workday profile with a start-up surge per line', () => {
    expect(p.days).toBe(20);
    expect(p.base).toHaveLength(24);
    expect(p.lines).toHaveLength(4);
    expect(p.startHour).toBe(8);
    for (const l of p.lines) {
      expect(l.surgeKwh).toBeGreaterThan(10);
      expect(l.profile[8]).toBeGreaterThan(l.profile[9]);
      expect(l.preKw).toBeLessThan(l.profile[9]);
    }
  });

  it('all lines together reproduces the hourly data', () => {
    const r = together(60);
    expect(r.slots).toHaveLength(SLOTS_PER_DAY);
    let maxHour = 0;
    for (let h = 0; h < 24; h++)
      maxHour = Math.max(maxHour, p.base[h] + p.lines.reduce((s, l) => s + l.profile[h], 0));
    expect(r.peakHourlyKw).toBeCloseTo(maxHour, 3);
    expect(r.peakKw).toBeCloseTo(maxHour, 3);
    expect(r.lastDelayMin).toBe(0);
    // shorter surge: same energy, higher instantaneous peak
    const short = together(15);
    expect(short.peakKw).toBeGreaterThan(r.peakKw);
    expect(short.energyKwh).toBeCloseTo(r.energyKwh, 3);
  });

  it('staggered starts lower the peak; the suggestion is the best plan', () => {
    const ref = together(15);
    const plan = simulatePlan(p, { order: lines, intervalMin: 15, surgeMin: 15 });
    const red = peakReduction(plan, ref);
    expect(red.kw).toBeGreaterThan(200);
    expect(red.pct).toBeGreaterThan(10);
    expect(plan.lastDelayMin).toBe(45);
    expect(startMinutes(p, { order: lines, intervalMin: 15, surgeMin: 15 })[lines[3]]).toBe(525);
    const best = suggestPlan(p, 15);
    expect(best.result.peakKw).toBeLessThanOrEqual(plan.peakKw + 1e-6);
    expect(best.result.peakKw).toBeLessThan(ref.peakKw);
    // with a 60 minute surge a 15 minute gap still overlaps; the planner needs longer gaps
    const long = suggestPlan(p, 60);
    expect(long.intervalMin).toBeGreaterThanOrEqual(45);
  });

  it('helpers', () => {
    expect(minuteLabel(495)).toBe('08:15');
    expect(minuteLabel(0)).toBe('00:00');
    expect(minuteLabel(1440 + 60)).toBe('01:00');
    expect(moveInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(['a'], 'x', 1)).toEqual(['a']);
  });
});
