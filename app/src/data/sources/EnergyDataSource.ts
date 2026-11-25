import type {
  Anomaly,
  AnomalyStatus,
  DateRange,
  EnergyDataset,
  Equipment,
  LiveTick,
  PlantProfile,
  Recommendation,
  RecommendationState,
} from '../types';

/**
 * The only data contract the UI knows. `MockDataSource` implements it with
 * the deterministic generator; a future `ApiDataSource` implements the same
 * methods against the real backend and nothing in the UI changes.
 */

export type Resolution = 'hour' | 'day';

export interface ReadingsQuery {
  equipmentIds?: string[];
  range: DateRange;
  resolution: Resolution;
}

export interface ReadingPoint {
  t: number;
  value: number;
}

export interface ReadingSeries {
  equipmentId: string;
  unit: 'kWh' | 'm3';
  points: ReadingPoint[];
}

export interface ProductionPoint {
  /** day start ms */
  t: number;
  tons: number;
  plannedTons: number;
  productionHours: number;
  isPlan: boolean;
}

export interface WeatherPoint {
  t: number;
  temperatureC: number;
  isForecast: boolean;
}

export type Unsubscribe = () => void;

export interface EnergyDataSource {
  readonly kind: 'mock' | 'api';
  getPlant(): Promise<PlantProfile>;
  getEquipment(): Promise<Equipment[]>;
  getReadings(q: ReadingsQuery): Promise<ReadingSeries[]>;
  getProduction(range: DateRange): Promise<ProductionPoint[]>;
  getWeather(range: DateRange): Promise<WeatherPoint[]>;
  /**
   * Full columnar snapshot used by the analytics layer (13 months hourly per
   * equipment + plan/forecast until the end of next month).
   */
  getDataset(): Promise<EnergyDataset>;
  getAnomalies(): Promise<Anomaly[]>;
  updateAnomalyStatus(id: string, status: AnomalyStatus): Promise<void>;
  getRecommendations(): Promise<Recommendation[]>;
  /** initial (server side) recommendation states */
  getRecommendationStates(): Promise<Record<string, RecommendationState>>;
  updateRecommendationStatus(id: string, state: RecommendationState): Promise<void>;
  /** minute-level history of the live power for the last `minutes` */
  getLiveHistory(minutes: number): Promise<LiveTick[]>;
  /** live power stream, one tick every `intervalMs` */
  getLiveStream(onTick: (tick: LiveTick) => void, intervalMs?: number): Unsubscribe;
}
