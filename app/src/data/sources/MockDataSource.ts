import { baseConfig, type AppConfig } from '../config';
import { generateDataset } from '../mock/generator';
import { gauss, mulberry32 } from '../mock/random';
import type {
  Anomaly,
  AnomalyStatus,
  DateRange,
  EnergyDataset,
  LiveReading,
  LiveTick,
  Recommendation,
  RecommendationState,
} from '../types';
import { analysisFor, type Analysis } from '../../domain/analysis';
import type {
  EnergyDataSource,
  ProductionPoint,
  ReadingSeries,
  ReadingsQuery,
  Unsubscribe,
  WeatherPoint,
} from './EnergyDataSource';

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Deterministic in-browser data source (no network). */
export class MockDataSource implements EnergyDataSource {
  readonly kind = 'mock' as const;
  private ds: EnergyDataset | null = null;
  private anomalyStatus = new Map<string, AnomalyStatus>();
  private recStates: Record<string, RecommendationState> | null = null;
  private readonly now: () => number;
  private readonly config: AppConfig;

  constructor(opts: { now?: () => number; config?: AppConfig } = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.config = opts.config ?? baseConfig;
  }

  /** "now" used for generation (system time by default) */
  nowMs(): number {
    return this.ds?.timeline.nowMs ?? this.now();
  }

  hasDataset(): boolean {
    return this.ds !== null;
  }

  /** use a dataset generated elsewhere (web worker) */
  adopt(ds: EnergyDataset) {
    this.ds = ds;
  }

  /** synchronous access for the analytics layer (generated once per instance) */
  dataset(): EnergyDataset {
    if (!this.ds) this.ds = generateDataset({ now: this.now(), config: this.config });
    return this.ds;
  }

  analyzed(): Analysis {
    return analysisFor(this.dataset(), this.config);
  }

  async getPlant() {
    return this.dataset().plant;
  }

  async getEquipment() {
    return this.dataset().equipment;
  }

  async getDataset() {
    return this.dataset();
  }

  async getReadings(q: ReadingsQuery): Promise<ReadingSeries[]> {
    const ds = this.dataset();
    const ids = q.equipmentIds ?? ds.equipment.map((e) => e.id);
    const from = Math.max(0, Math.floor((q.range.from - ds.timeline.startMs) / HOUR));
    const to = Math.min(ds.timeline.nowIndex, Math.ceil((q.range.to - ds.timeline.startMs) / HOUR));
    return ids.map((id) => {
      const eq = ds.equipment.find((e) => e.id === id);
      const arr = ds.readings[id];
      const points: { t: number; value: number }[] = [];
      if (q.resolution === 'hour') {
        for (let i = from; i < to; i++)
          points.push({ t: ds.timeline.hourStarts[i], value: arr[i] });
      } else {
        for (const d of ds.days) {
          if (d.endIndex <= from || d.startIndex >= to) continue;
          let s = 0;
          for (let i = Math.max(from, d.startIndex); i < Math.min(to, d.endIndex); i++) s += arr[i];
          points.push({ t: d.start, value: s });
        }
      }
      return { equipmentId: id, unit: eq?.energy === 'gas' ? 'm3' : 'kWh', points };
    });
  }

  async getProduction(range: DateRange): Promise<ProductionPoint[]> {
    return this.dataset()
      .days.filter((d) => d.start >= range.from - DAY + 1 && d.start < range.to)
      .map((d) => ({
        t: d.start,
        tons: d.tons,
        plannedTons: d.plannedTons,
        productionHours: d.productionHours,
        isPlan: d.isFuture || d.isToday,
      }));
  }

  async getWeather(range: DateRange): Promise<WeatherPoint[]> {
    const ds = this.dataset();
    const out: WeatherPoint[] = [];
    for (let i = 0; i < ds.timeline.hours; i++) {
      const t = ds.timeline.hourStarts[i];
      if (t < range.from || t >= range.to) continue;
      out.push({
        t,
        temperatureC: ds.context.temperature[i],
        isForecast: i >= ds.timeline.nowIndex,
      });
    }
    return out;
  }

  async getAnomalies(): Promise<Anomaly[]> {
    const a = this.analyzed();
    const now = a.ds.timeline.nowMs;
    return a.anomalies.map((x) => ({
      ...x,
      status: this.anomalyStatus.get(x.id) ?? (x.end < now - 10 * DAY ? 'investigating' : 'open'),
    }));
  }

  async updateAnomalyStatus(id: string, status: AnomalyStatus) {
    this.anomalyStatus.set(id, status);
  }

  async getRecommendations(): Promise<Recommendation[]> {
    return this.analyzed().engine.recommendations;
  }

  async getRecommendationStates(): Promise<Record<string, RecommendationState>> {
    if (!this.recStates) {
      const ds = this.dataset();
      const now = ds.timeline.nowMs;
      const today = ds.days.find((d) => d.isToday)?.start ?? now;
      this.recStates = Object.fromEntries(
        this.config.recommendations.map((r) => [
          r.id,
          { status: 'proposed', updatedAt: now - 3 * DAY } as RecommendationState,
        ]),
      );
      this.recStates['rec-air-leaks'] = { status: 'approved', updatedAt: now - 2 * DAY };
      this.recStates['rec-lighting-zones'] = {
        status: 'scheduled',
        scheduledFor: today + 5 * DAY,
        updatedAt: now - DAY,
      };
    }
    return { ...this.recStates };
  }

  async updateRecommendationStatus(id: string, state: RecommendationState) {
    await this.getRecommendationStates();
    if (this.recStates) this.recStates[id] = state;
  }

  async getLiveHistory(minutes: number): Promise<LiveTick[]> {
    return this.liveHistory(minutes);
  }

  /** Synthetic minute-level history for the live chart (last `minutes`). */
  liveHistory(minutes: number): LiveTick[] {
    const ds = this.dataset();
    const now = this.now();
    const out: LiveTick[] = [];
    for (let m = minutes; m >= 1; m--) out.push(this.tickAt(now - m * 60_000, ds));
    return out;
  }

  getLiveStream(onTick: (tick: LiveTick) => void, intervalMs = 5000): Unsubscribe {
    const ds = this.dataset();
    const emit = () => {
      onTick(this.tickAt(this.now(), ds));
    };
    emit();
    const h = setInterval(emit, intervalMs);
    return () => clearInterval(h);
  }

  private tickAt(t: number, ds: EnergyDataset): LiveTick {
    const idx = Math.min(ds.timeline.hours - 1, Math.floor((t - ds.timeline.startMs) / HOUR));
    const rand = mulberry32((Math.floor(t / 5000) ^ 0x51ed) >>> 0);
    const readings: LiveReading[] = ds.equipment.map((eq, eqNo) => {
      const off = ds.offlineEquipment.find((o) => o.id === eq.id);
      const base =
        idx >= ds.timeline.nowIndex ? (ds.currentLoad[eq.id] ?? 0) : (ds.readings[eq.id][idx] ?? 0);
      const wobble = 1 + 0.03 * gauss(eqNo, Math.floor(t / 60_000), 7) + 0.01 * (rand() - 0.5);
      const kw = Math.max(0, base * wobble);
      if (off && t >= off.since)
        return { equipmentId: eq.id, kw: Number.NaN, status: 'offline', lastSeen: off.since };
      return {
        equipmentId: eq.id,
        kw,
        status: kw < 0.03 * eq.nominal ? 'stopped' : 'normal',
        lastSeen: t,
      };
    });
    const totalKw = readings
      .filter((r) => ds.equipment.find((e) => e.id === r.equipmentId)?.energy === 'electricity')
      .reduce((s, r) => s + (Number.isNaN(r.kw) ? 0 : r.kw), 0);
    const gas = readings.find(
      (r) => ds.equipment.find((e) => e.id === r.equipmentId)?.energy === 'gas',
    );
    return { t, totalKw, gasM3h: gas && !Number.isNaN(gas.kw) ? gas.kw : 0, readings };
  }
}
