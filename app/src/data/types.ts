/**
 * Shared data model. The UI only knows these types and the EnergyDataSource
 * interface (src/data/sources/EnergyDataSource.ts); it never knows whether the
 * data comes from the mock generator or a real API.
 */

export type EnergyCarrier = 'electricity' | 'gas';

export type EquipmentGroupId =
  | 'compressed_air'
  | 'cooling'
  | 'extrusion'
  | 'injection'
  | 'hvac'
  | 'lighting'
  | 'auxiliary'
  | 'boiler';

export interface EquipmentGroup {
  id: EquipmentGroupId;
  /** i18n key in common.json */
  labelKey: string;
  color: string;
  energy: EnergyCarrier;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type: string;
  group: EquipmentGroupId;
  workshop: string;
  energy: EnergyCarrier;
  /** kW for electricity, m³/h for gas */
  nominal: number;
}

export interface Workshop {
  id: string;
  name: string;
}

export interface ShiftDef {
  id: string;
  start: number;
  end: number;
}

export interface DaySchedule {
  shifts: number;
  start: number;
  end: number;
}

export interface PlantProfile {
  id: string;
  name: string;
  sector: string;
  location: string;
  areaM2: number;
  fictional: boolean;
  schedule: { weekday: DaySchedule; saturday: DaySchedule; sunday: DaySchedule };
  shifts: ShiftDef[];
  holidays: string[];
  holidaysVerify: boolean;
  workshops: Workshop[];
  peakLimitKw: number;
  climate: { cddBaseC: number; hddBaseC: number };
}

export type DayType = 'workday' | 'saturday' | 'sunday' | 'holiday';

/** One calendar day (plant-local time). Hour indices are into the hourly arrays. */
export interface DayInfo {
  /** yyyy-MM-dd */
  key: string;
  /** local midnight, ms */
  start: number;
  startIndex: number;
  /** exclusive */
  endIndex: number;
  dayType: DayType;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  /** tons; actual for past days, plan for today and future */
  tons: number;
  /** planned tons (equal to tons for future days) */
  plannedTons: number;
  productionHours: number;
  meanTempC: number;
  /** day is fully in the future (after now) */
  isFuture: boolean;
  /** day containing "now" */
  isToday: boolean;
}

export interface Timeline {
  /** ms of first hour (local midnight of first day of first month) */
  startMs: number;
  hours: number;
  /** index of the first hour that has no actual data yet (current, incomplete hour) */
  nowIndex: number;
  nowMs: number;
  /** start ms of each hour */
  hourStarts: Float64Array;
  /** local hour of day 0..23 */
  hourOfDay: Uint8Array;
  /** 0 = Monday … 6 = Sunday */
  weekday: Uint8Array;
  /** index into days[] */
  dayIndex: Uint16Array;
  /** index of the current month's first day in days[] */
  currentMonthStartDay: number;
}

export interface HourlyContext {
  /** outdoor temperature °C (observed before nowIndex, forecast after) */
  temperature: Float32Array;
  /** 1 when the hour is a scheduled production hour */
  production: Uint8Array;
  /** production intensity, t/h during production hours, else 0 */
  intensity: Float32Array;
  /** 1 between sunset and sunrise (outdoor lighting driver) */
  dark: Uint8Array;
}

/** Hourly series per equipment. kW (= kWh per hour) or m³ for gas. NaN after nowIndex. */
export type HourlySeries = Record<string, Float32Array>;

export interface ImplementedMeasure {
  id: string;
  equipmentIds: string[];
  implementedAt: number;
  expectedSavingPct: number;
  method: 'B' | 'C';
  investmentAzn: number;
}

export type LiveStatus = 'normal' | 'waste' | 'stopped' | 'offline';

export interface LiveReading {
  equipmentId: string;
  kw: number;
  status: LiveStatus;
  /** ms of last successful reading */
  lastSeen: number;
}

export interface LiveTick {
  t: number;
  totalKw: number;
  gasM3h: number;
  readings: LiveReading[];
}

export interface EnergyDataset {
  generatedAt: number;
  /** generation time in ms (mock only) */
  generationMs: number;
  plant: PlantProfile;
  groups: EquipmentGroup[];
  equipment: Equipment[];
  timeline: Timeline;
  days: DayInfo[];
  context: HourlyContext;
  readings: HourlySeries;
  /** load in the current (incomplete) hour, used to seed the live stream */
  currentLoad: Record<string, number>;
  measures: ImplementedMeasure[];
  /** ids of equipment whose meter currently has no connection (live demo) */
  offlineEquipment: { id: string; since: number }[];
}

// ---------- Analysis outputs (computed by src/domain) ----------

export type AnomalyRule =
  'idle_load' | 'baseload_trend' | 'spike' | 'peak_power' | 'weather_mismatch' | 'enpi_degradation';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AnomalyStatus = 'open' | 'investigating' | 'resolved' | 'false_alarm';

export interface AnomalyOccurrence {
  start: number;
  end: number;
  lossKwh: number;
}

export interface Anomaly {
  id: string;
  rule: AnomalyRule;
  severity: Severity;
  equipmentIds: string[];
  group: EquipmentGroupId | 'plant';
  energy: EnergyCarrier;
  start: number;
  end: number;
  occurrences: AnomalyOccurrence[];
  /** total excess in kWh (electricity) or m³ (gas) */
  lossKwh: number;
  lossM3: number;
  status: AnomalyStatus;
  /** rule specific numbers used by explanation templates */
  metrics: Record<string, number>;
  /** linked recommendation ids */
  recommendationIds: string[];
}

export type RecommendationStatus =
  'proposed' | 'approved' | 'scheduled' | 'in_progress' | 'measuring' | 'verified' | 'rejected';

export type Effort = 'zero' | 'low' | 'invest';

export type RejectReason = 'not_feasible' | 'production_risk' | 'already_done' | 'other';

export type HourMask = 'nonprod' | 'prod' | 'all' | 'startup';

export interface RecommendationTemplate {
  id: string;
  category: 'schedule' | 'maintenance' | 'control' | 'peak' | 'investment';
  group: EquipmentGroupId;
  equipmentIds: string[];
  mask: HourMask;
  capture: number;
  windowDays: number;
  effort: Effort;
  investmentAzn: number;
  riskKey: string;
  riskLevel: 'none' | 'low' | 'medium';
  rules: AnomalyRule[];
}

/** Physical-unit recommendation produced by the engine (money/CO₂ added in view models). */
export interface Recommendation extends RecommendationTemplate {
  energy: EnergyCarrier;
  /** saving per month at the current waste rate */
  kwhPerMonth: number;
  m3PerMonth: number;
  /** peak power reduction (kW), only for peak recommendations */
  peakKwReduction: number;
  /** waste pool the saving is taken from (per month), never smaller than the saving */
  wastePoolPerMonth: number;
  /** 0..100 */
  confidence: number;
  anomalyIds: string[];
}

export interface RecommendationState {
  status: RecommendationStatus;
  scheduledFor?: number;
  rejectReason?: RejectReason;
  rejectNote?: string;
  updatedAt: number;
}

export interface DateRange {
  from: number;
  to: number;
}
