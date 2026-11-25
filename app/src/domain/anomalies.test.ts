import { SCENARIOS } from '@/data/mock/scenarios';
import type { Anomaly } from '@/data/types';
import { fixture, FIXED_NOW } from '@/test/fixture';
import { detectAnomalies, findRuns, severityOf } from './anomalies';

const DAY = 86_400_000;

function findFor(anomalies: Anomaly[], scenarioId: string) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId)!;
  return anomalies.filter(
    (a) => a.rule === sc.expectedRule && sc.equipmentIds.some((id) => a.equipmentIds.includes(id)),
  );
}

describe('anomaly rules detect every injected scenario (spec 9.4)', () => {
  const a = fixture();
  const hourOf = (t: number) => new Date(t).getHours();
  const wd = (t: number) => (new Date(t).getDay() + 6) % 7;

  it('1. K-2 runs unloaded on workday nights 01:00-06:30 (idle load)', () => {
    const hits = findFor(a.anomalies, 's1-k2-night');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    const occ = hits.flatMap((h) => h.occurrences);
    expect(occ.every((o) => hourOf(o.start) >= 1 && hourOf(o.start) <= 2)).toBe(true);
    expect(occ.every((o) => wd(o.start) <= 4)).toBe(true);
    expect(hits[0].metrics.avgKw).toBeGreaterThan(25);
  });

  it('2. compressed-air leak: night baseload rising ~22 % over the last 9 days', () => {
    const [h] = findFor(a.anomalies, 's2-air-leak');
    expect(h).toBeDefined();
    expect(h.metrics.increasePct).toBeGreaterThan(15);
    expect(h.metrics.increasePct).toBeLessThan(30);
    expect(h.metrics.days).toBeGreaterThanOrEqual(7);
    expect(h.metrics.days).toBeLessThanOrEqual(10);
  });

  it('3. Chiller-1 at full power on Sundays', () => {
    const hits = findFor(a.anomalies, 's3-chiller1-sunday');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(
      hits.flatMap((x) => x.occurrences).every((o) => wd(o.start) === 6 || wd(o.start) === 0),
    ).toBe(true);
    expect(hits[0].metrics.loadPct).toBeGreaterThan(80);
    expect(hits[0].severity).toBe('critical');
  });

  it('4. ventilation keeps running 3 hours after the shift', () => {
    const hits = findFor(a.anomalies, 's4-hvac-after-shift');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    const occ = hits.flatMap((x) => x.occurrences);
    expect(occ.every((o) => (o.end - o.start) / 3_600_000 <= 4)).toBe(true);
    expect(occ.every((o) => hourOf(o.start) === 0 || hourOf(o.start) === 16)).toBe(true);
  });

  it('5. warehouse lights on at night', () => {
    const hits = findFor(a.anomalies, 's5-warehouse-lights');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.flatMap((x) => x.occurrences).every((o) => hourOf(o.start) === 0)).toBe(true);
  });

  it('6. four extrusion lines start together at 08:00 (peak power)', () => {
    const hits = findFor(a.anomalies, 's6-extruder-start');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.every((x) => x.metrics.hour === 8)).toBe(true);
    expect(
      hits.some((x) =>
        ['ext-1', 'ext-2', 'ext-3', 'ext-4'].every((id) => x.equipmentIds.includes(id)),
      ),
    ).toBe(true);
    expect(Math.max(...hits.map((x) => x.metrics.peakKw))).toBeGreaterThan(a.ds.plant.peakLimitKw);
  });

  it('7. Chiller-2 ignores the outdoor temperature on cold days', () => {
    const hits = findFor(a.anomalies, 's7-chiller2-cold');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.every((x) => x.metrics.meanTempC < 12)).toBe(true);
    expect(hits[0].metrics.loadPct).toBeGreaterThan(70);
  });

  it('8. boiler heating at weekends (gas)', () => {
    const hits = findFor(a.anomalies, 's8-boiler-weekend');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.every((x) => x.energy === 'gas' && x.lossM3 > 0 && x.lossKwh === 0)).toBe(true);
    expect(hits.flatMap((x) => x.occurrences).every((o) => [5, 6, 0].includes(wd(o.start)))).toBe(
      true,
    );
  });

  it('extra samples: spike (z > 3) and EnPI degradation', () => {
    const spikes = findFor(a.anomalies, 'x2-e3-spike');
    expect(spikes).toHaveLength(1);
    expect(spikes[0].metrics.zScore).toBeGreaterThan(3);
    expect(a.anomalies.filter((x) => x.rule === 'spike')).toHaveLength(1); // no false spikes
    const enpi = a.anomalies.filter((x) => x.rule === 'enpi_degradation');
    expect(enpi.length).toBeGreaterThanOrEqual(2);
    expect(enpi.every((x) => x.metrics.deviationPct >= 10 && x.group === 'plant')).toBe(true);
    expect(findFor(a.anomalies, 'x1-extruder-standby').length).toBeGreaterThanOrEqual(3);
  });

  it('all six rule types fire and events stay inside the detection window', () => {
    const rules = new Set(a.anomalies.map((x) => x.rule));
    expect([...rules].sort()).toEqual([
      'baseload_trend',
      'enpi_degradation',
      'idle_load',
      'peak_power',
      'spike',
      'weather_mismatch',
    ]);
    const windowStart = FIXED_NOW - 32 * DAY;
    expect(a.anomalies.every((x) => x.start >= windowStart && x.end <= FIXED_NOW + DAY)).toBe(true);
    expect(new Set(a.anomalies.map((x) => x.id)).size).toBe(a.anomalies.length);
  });

  it('every anomaly carries loss, severity and linked recommendations', () => {
    for (const x of a.anomalies) {
      expect(x.lossKwh + x.lossM3).toBeGreaterThanOrEqual(0);
      expect(['critical', 'high', 'medium', 'low']).toContain(x.severity);
    }
    const linked = a.anomalies.filter((x) => x.rule !== 'enpi_degradation' && x.rule !== 'spike');
    expect(linked.every((x) => x.recommendationIds.length > 0)).toBe(true);
  });
});

describe('detection is robust across dates', () => {
  it.each([
    ['winter', new Date(2026, 0, 21, 10, 0).getTime()],
    ['summer', new Date(2026, 6, 15, 18, 0).getTime()],
  ])('%s: scenarios 1-6 and 8 are found', (_, now) => {
    const a = fixture(now);
    for (const id of [
      's1-k2-night',
      's2-air-leak',
      's3-chiller1-sunday',
      's4-hvac-after-shift',
      's5-warehouse-lights',
      's6-extruder-start',
      's8-boiler-weekend',
    ]) {
      expect(findFor(a.anomalies, id).length, id).toBeGreaterThan(0);
    }
    expect(a.anomalies.filter((x) => x.rule === 'spike')).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('findRuns merges small gaps and drops short runs', () => {
    const f = new Uint8Array([0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1]);
    expect(findRuns(f, 0, f.length, 1, 2)).toEqual([
      { start: 1, end: 5 },
      { start: 8, end: 13 },
    ]);
    expect(findRuns(f, 0, f.length, 0, 1)).toHaveLength(4);
  });
  it('severity bumps by rule', () => {
    const a = fixture();
    expect(severityOf(a, 'idle_load', 5000, {})).toBe('critical');
    expect(severityOf(a, 'idle_load', 50, {})).toBe('low');
    expect(severityOf(a, 'baseload_trend', 50, { increasePct: 22 })).toBe('high');
    expect(severityOf(a, 'peak_power', 50, { peakKw: 2000, peakLimitKw: 1280 })).toBe('high');
    expect(severityOf(a, 'enpi_degradation', 0, { deviationPct: 30 })).toBe('critical');
    expect(severityOf(a, 'enpi_degradation', 0, { deviationPct: 12 })).toBe('medium');
    expect(severityOf(a, 'spike', 0, {})).toBe('medium');
  });
  it('re-running detection is deterministic', () => {
    const a = fixture();
    expect(detectAnomalies(a).map((x) => x.id)).toEqual(a.anomalies.map((x) => x.id));
  });
});
