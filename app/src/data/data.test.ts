import { baseConfig, resolveRates } from './config';
import { generateDataset } from './mock/generator';
import { gauss, hash3, mulberry32, stringSeed, uniform } from './mock/random';
import { scenarioById, SCENARIOS } from './mock/scenarios';
import { loadAnalysis, MockDataSource } from './sources';

const NOW = new Date(2026, 10, 25, 14, 30).getTime();

describe('deterministic mock generator (spec 9)', () => {
  const ds = generateDataset({ now: NOW });

  it('13 months of hourly data per equipment, ending now; plan until end of next month', () => {
    expect(ds.equipment.length).toBeGreaterThanOrEqual(14);
    expect(new Set(ds.equipment.map((e) => e.group)).size).toBeGreaterThanOrEqual(6);
    expect(ds.equipment.some((e) => e.energy === 'gas')).toBe(true);
    expect(new Date(ds.timeline.startMs).toISOString().slice(0, 10)).toBe('2025-10-31'); // 1 Nov 2025 00:00 Baku
    expect(ds.days[0].key).toBe('2025-11-01');
    expect(ds.days.at(-1)!.key).toBe('2026-12-31');
    const k2 = ds.readings['comp-2'];
    expect(Number.isNaN(k2[ds.timeline.nowIndex - 1])).toBe(false);
    expect(Number.isNaN(k2[ds.timeline.nowIndex])).toBe(true);
    expect(ds.timeline.hourOfDay[ds.timeline.nowIndex]).toBe(14);
    expect(ds.days.find((d) => d.isToday)!.key).toBe('2026-11-25');
    expect(ds.currentLoad['comp-2']).toBeGreaterThan(0);
    expect(ds.generationMs).toBeGreaterThan(0);
  });

  it('is deterministic and history does not depend on now', () => {
    const again = generateDataset({ now: NOW });
    expect(Array.from(again.readings['ext-1'].slice(0, 500))).toEqual(
      Array.from(ds.readings['ext-1'].slice(0, 500)),
    );
    const later = generateDataset({ now: NOW + 3 * 3_600_000 });
    // same absolute hour, same value (before any scenario window)
    expect(later.readings['im-2'][100]).toBe(ds.readings['im-2'][100]);
  });

  it('plant schedule, production and Sumqayıt climate', () => {
    const mon = ds.days.find((d) => d.key === '2026-11-23')!;
    const sat = ds.days.find((d) => d.key === '2026-11-21')!;
    const sun = ds.days.find((d) => d.key === '2026-11-22')!;
    expect([mon.dayType, mon.productionHours]).toEqual(['workday', 16]);
    expect([sat.dayType, sat.productionHours]).toEqual(['saturday', 8]);
    expect([sun.dayType, sun.tons]).toEqual(['sunday', 0]);
    expect(ds.days.find((d) => d.key === '2026-11-09')!.dayType).toBe('holiday');
    const oct = ds.days.filter((d) => d.key.startsWith('2026-10'));
    const tons = oct.reduce((s, d) => s + d.tons, 0);
    expect(tons).toBeGreaterThan(1150);
    expect(tons).toBeLessThan(1350);
    const jul = ds.days.filter((d) => d.key.startsWith('2026-07'));
    const jan = ds.days.filter((d) => d.key.startsWith('2026-01'));
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(mean(jul.map((d) => d.meanTempC))).toBeGreaterThan(22);
    expect(mean(jan.map((d) => d.meanTempC))).toBeLessThan(9);
  });

  it('random helpers', () => {
    expect(hash3(1, 2, 3)).toBe(hash3(1, 2, 3));
    expect(uniform(1, 2, 3)).toBeGreaterThanOrEqual(0);
    expect(uniform(1, 2, 3)).toBeLessThan(1);
    const g = Array.from({ length: 2000 }, (_, i) => gauss(5, 6, i));
    const m = g.reduce((s, v) => s + v, 0) / g.length;
    expect(Math.abs(m)).toBeLessThan(0.1);
    const r = mulberry32(42);
    expect(r()).not.toBe(r());
    expect(stringSeed('a')).not.toBe(stringSeed('b'));
    expect(SCENARIOS.filter((s) => s.specNo > 0)).toHaveLength(8);
    expect(() => scenarioById('nope')).toThrow();
  });
});

describe('config', () => {
  it('tariffs, factors and budgets come from JSON', () => {
    const r = resolveRates(baseConfig);
    expect(r.electricityRateAznPerKwh).toBe(0.11);
    expect(r.scope1KgCo2PerKwh).toBe(0.202);
    expect(r.scope2KgCo2PerKwh).toBe(0.41);
    expect(r.gasKwhPerM3).toBe(10);
    expect(r.electricityBudgetAzn).toBe(50_000);
    expect(baseConfig.tariffs.gas.placeholder).toBe(true);
    expect(baseConfig.tariffs.electricity.consumerGroups.map((g) => g.rateAznPerKwh)).toEqual([
      0.11, 0.1,
    ]);
  });
});

describe('MockDataSource', () => {
  const src = new MockDataSource({ now: () => NOW });

  it('implements the EnergyDataSource contract', async () => {
    expect(src.kind).toBe('mock');
    expect(src.hasDataset()).toBe(false);
    expect((await src.getPlant()).name).toBe('Nümunə Polimer Zavodu');
    expect(await src.getEquipment()).toHaveLength(20);
    const from = new Date(2026, 10, 20).getTime();
    const to = new Date(2026, 10, 22).getTime();
    const hourly = await src.getReadings({
      equipmentIds: ['comp-2'],
      range: { from, to },
      resolution: 'hour',
    });
    expect(hourly[0].points).toHaveLength(48);
    const daily = await src.getReadings({
      equipmentIds: ['comp-2', 'boiler'],
      range: { from, to },
      resolution: 'day',
    });
    expect(daily[0].points).toHaveLength(2);
    expect(daily[1].unit).toBe('m3');
    expect((await src.getReadings({ range: { from, to }, resolution: 'day' })).length).toBe(20);
    const prod = await src.getProduction({ from, to: new Date(2026, 10, 28).getTime() });
    expect(prod.some((p) => p.isPlan)).toBe(true);
    const w = await src.getWeather({ from: NOW - 3_600_000 * 2, to: NOW + 3_600_000 * 2 });
    expect(w.some((p) => p.isForecast) && w.some((p) => !p.isForecast)).toBe(true);
    expect(src.nowMs()).toBe(NOW);
  });

  it('anomalies, recommendations and status updates', async () => {
    const an = await src.getAnomalies();
    expect(an.length).toBeGreaterThan(10);
    await src.updateAnomalyStatus(an[0].id, 'resolved');
    expect((await src.getAnomalies())[0].status).toBe('resolved');
    expect((await src.getRecommendations()).length).toBeGreaterThanOrEqual(9);
    const st = await src.getRecommendationStates();
    expect(Object.values(st).filter((s) => s.status === 'proposed').length).toBe(8);
    await src.updateRecommendationStatus('rec-comp-vsd', {
      status: 'rejected',
      rejectReason: 'other',
      updatedAt: 1,
    });
    expect((await src.getRecommendationStates())['rec-comp-vsd'].status).toBe('rejected');
  });

  it('live history and stream', async () => {
    const h = await src.getLiveHistory(60);
    expect(h).toHaveLength(60);
    expect(h[0].totalKw).toBeGreaterThan(0);
    expect(h[0].readings.find((r) => r.equipmentId === 'ahu-wh')!.status).not.toBe('offline');
    expect(h.at(-1)!.readings.find((r) => r.equipmentId === 'ahu-wh')!.status).toBe('offline');
    vi.useFakeTimers();
    const ticks: number[] = [];
    const stop = src.getLiveStream((t) => ticks.push(t.totalKw), 5000);
    vi.advanceTimersByTime(10_000);
    stop();
    vi.advanceTimersByTime(10_000);
    vi.useRealTimers();
    expect(ticks).toHaveLength(3);
  });

  it('loadAnalysis falls back to the main thread without Worker', async () => {
    const s2 = new MockDataSource({ now: () => NOW });
    const a = await loadAnalysis(s2);
    expect(a.anomalies.length).toBeGreaterThan(0);
    expect(await loadAnalysis(s2)).toBe(a);
    s2.adopt(a.ds);
    expect(s2.hasDataset()).toBe(true);
  });
});
