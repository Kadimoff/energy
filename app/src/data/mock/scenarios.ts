/**
 * Ground truth of the deliberately injected waste scenarios (spec 9.4) plus
 * two extra samples. Only the generator and the tests read this file; the
 * analysis must find the patterns on its own.
 */
export interface ScenarioDef {
  id: string;
  /** spec 9.4 number, 0 = extra sample */
  specNo: number;
  equipmentIds: string[];
  /** active when the day is within the last N days (today = 0) */
  activeDays: number;
  expectedRule:
    | 'idle_load'
    | 'baseload_trend'
    | 'spike'
    | 'peak_power'
    | 'weather_mismatch'
    | 'enpi_degradation';
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 's1-k2-night',
    specNo: 1,
    equipmentIds: ['comp-2'],
    activeDays: 42,
    expectedRule: 'idle_load',
  },
  {
    id: 's2-air-leak',
    specNo: 2,
    equipmentIds: ['comp-1'],
    activeDays: 9,
    expectedRule: 'baseload_trend',
  },
  {
    id: 's3-chiller1-sunday',
    specNo: 3,
    equipmentIds: ['chiller-1'],
    activeDays: 70,
    expectedRule: 'idle_load',
  },
  {
    id: 's4-hvac-after-shift',
    specNo: 4,
    equipmentIds: ['ahu-shop', 'ahu-wh'],
    activeDays: 60,
    expectedRule: 'idle_load',
  },
  {
    id: 's5-warehouse-lights',
    specNo: 5,
    equipmentIds: ['light-wh'],
    activeDays: 50,
    expectedRule: 'idle_load',
  },
  {
    id: 's6-extruder-start',
    specNo: 6,
    equipmentIds: ['ext-1', 'ext-2', 'ext-3', 'ext-4'],
    activeDays: 100000,
    expectedRule: 'peak_power',
  },
  {
    id: 's7-chiller2-cold',
    specNo: 7,
    equipmentIds: ['chiller-2'],
    activeDays: 55,
    expectedRule: 'weather_mismatch',
  },
  {
    id: 's8-boiler-weekend',
    specNo: 8,
    equipmentIds: ['boiler'],
    activeDays: 42,
    expectedRule: 'idle_load',
  },
  {
    id: 'x1-extruder-standby',
    specNo: 0,
    equipmentIds: ['ext-1', 'ext-2', 'ext-3', 'ext-4'],
    activeDays: 84,
    expectedRule: 'idle_load',
  },
  { id: 'x2-e3-spike', specNo: 0, equipmentIds: ['ext-3'], activeDays: 4, expectedRule: 'spike' },
];

export const scenarioById = (id: string): ScenarioDef => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario ${id}`);
  return s;
};

/** True measure effects in the mock (what really happened, unknown to M&V). */
export const MEASURE_TRUTH: Record<string, number> = {
  'm-im-servo': 0.885,
  'm-led-shop': 0.62,
  'm-ct-vsd': 0.86,
  'm-office-hvac': 0.9,
};
