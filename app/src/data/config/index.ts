import analysisJson from './analysis.json';
import budgetsJson from './budgets.json';
import emissionsJson from './emissions.json';
import equipmentJson from './equipment.json';
import groupsJson from './groups.json';
import measuresJson from './measures.json';
import plantJson from './plant.json';
import recommendationsJson from './recommendations.json';
import tariffsJson from './tariffs.json';
import type { Equipment, EquipmentGroup, PlantProfile, RecommendationTemplate } from '../types';

/**
 * All tariffs, factors, budgets, targets and thresholds live in the JSON files
 * of this folder. Nothing else in the code base may hardcode them. Settings
 * overrides (user edits) are merged on top via `applyOverrides`.
 */

export interface ConsumerGroup {
  id: string;
  rateAznPerKwh: number;
  labelKey: string;
}

export interface TariffConfig {
  currency: string;
  electricity: {
    consumerGroups: ConsumerGroup[];
    defaultConsumerGroup: string;
    fixedFeeAznPerMonth: number;
    fixedFeeEffectiveFrom: string;
    source: string;
    sourceUrl: string | null;
    lastChecked: string | null;
    verify: boolean;
  };
  gas: {
    rateAznPerM3: number;
    fixedFeeAznPerMonth: number;
    source: string;
    sourceUrl: string | null;
    lastChecked: string | null;
    verify: boolean;
    placeholder: boolean;
  };
}

export interface FactorMeta {
  source: string;
  sourceUrl?: string | null;
  basis?: string;
  date?: string;
  lastChecked: string | null;
  verify: boolean;
}

export interface EmissionsConfig {
  scope1: FactorMeta & { id: string; kgCo2PerKwh: number };
  scope2: FactorMeta & { id: string; method: 'location' | 'market'; kgCo2PerKwh: number };
  gasKwhPerM3: FactorMeta & { value: number };
  cbam: {
    euEtsPriceEurPerT: number;
    eurToAzn: number;
    freeThresholdTonnesPerYear: number;
    coveredGroups: string[];
    definitivePhaseFrom: string;
    firstDeclarationDue: string;
    source: string;
    lastChecked: string | null;
    verify: boolean;
  };
}

export interface BudgetConfig {
  electricityAznPerMonth: number;
  gasAznPerMonth: number;
  targets: {
    annualEnergyReductionPct: number;
    annualCo2ReductionPct: number;
    annualCo2TargetT: number;
    enpiTargetKwhPerT: number;
    baselineYear: string;
  };
}

export interface AnalysisConfig {
  bandSigma: number;
  robust: { iterations: number; cutoffSigma: number };
  cvrmseWarnPct: number;
  trainingDays: number;
  minTrainingDays: number;
  detectionWindowDays: number;
  rules: {
    idleLoad: {
      minExcessKw: number;
      minExcessPctNominal: number;
      minHours: number;
      maxGapHours: number;
    };
    baseloadTrend: {
      trendDays: number;
      referenceDays: number;
      minIncreasePct: number;
      minR2: number;
      nightStartHour: number;
      nightEndHour: number;
    };
    spike: { zScore: number; minExcessPctNominal: number; minExcessKw: number };
    peak: {
      minSimultaneousStarts: number;
      surgeZ: number;
      startFromPct: number;
      startToPct: number;
    };
    weatherMismatch: { coldDayMeanC: number; minLoadPct: number };
    enpi: { thresholdPct: number };
  };
  severity: { criticalKwh: number; highKwh: number; mediumKwh: number };
  forecast: { wasteWindowDays: number; systematicWasteUncertaintyPct: number };
  staleAfterMinutes: number;
}

export interface MeasureDef {
  id: string;
  equipmentIds: string[];
  implementedDaysAgo: number;
  expectedSavingPct: number;
  method: 'B' | 'C';
  investmentAzn: number;
}

export interface AppConfig {
  tariffs: TariffConfig;
  emissions: EmissionsConfig;
  budgets: BudgetConfig;
  analysis: AnalysisConfig;
  plant: PlantProfile;
  equipment: Equipment[];
  groups: EquipmentGroup[];
  recommendations: RecommendationTemplate[];
  measures: MeasureDef[];
}

export const baseConfig: AppConfig = {
  tariffs: tariffsJson as TariffConfig,
  emissions: emissionsJson as EmissionsConfig,
  budgets: budgetsJson as BudgetConfig,
  analysis: analysisJson as AnalysisConfig,
  plant: plantJson as PlantProfile,
  equipment: equipmentJson as Equipment[],
  groups: groupsJson as EquipmentGroup[],
  recommendations: recommendationsJson as RecommendationTemplate[],
  measures: measuresJson as MeasureDef[],
};

/** User-editable values (Settings page). Every field optional. */
export interface SettingsOverrides {
  consumerGroup?: string;
  electricityRateAznPerKwh?: number;
  electricityFixedFeeAzn?: number;
  gasRateAznPerM3?: number;
  gasFixedFeeAzn?: number;
  electricityBudgetAzn?: number;
  gasBudgetAzn?: number;
  scope1KgCo2PerKwh?: number;
  scope2KgCo2PerKwh?: number;
  gasKwhPerM3?: number;
  euEtsPriceEurPerT?: number;
  eurToAzn?: number;
  annualEnergyReductionPct?: number;
  annualCo2ReductionPct?: number;
  annualCo2TargetT?: number;
  enpiTargetKwhPerT?: number;
}

/** Flat, resolved values every calculation uses. */
export interface EffectiveRates {
  consumerGroup: string;
  electricityRateAznPerKwh: number;
  electricityFixedFeeAzn: number;
  gasRateAznPerM3: number;
  gasFixedFeeAzn: number;
  electricityBudgetAzn: number;
  gasBudgetAzn: number;
  scope1KgCo2PerKwh: number;
  scope2KgCo2PerKwh: number;
  gasKwhPerM3: number;
  euEtsPriceEurPerT: number;
  eurToAzn: number;
  annualEnergyReductionPct: number;
  annualCo2ReductionPct: number;
  annualCo2TargetT: number;
  enpiTargetKwhPerT: number;
}

export function resolveRates(cfg: AppConfig, o: SettingsOverrides = {}): EffectiveRates {
  const groupId = o.consumerGroup ?? cfg.tariffs.electricity.defaultConsumerGroup;
  const group =
    cfg.tariffs.electricity.consumerGroups.find((g) => g.id === groupId) ??
    cfg.tariffs.electricity.consumerGroups[0];
  return {
    consumerGroup: group.id,
    electricityRateAznPerKwh: o.electricityRateAznPerKwh ?? group.rateAznPerKwh,
    electricityFixedFeeAzn: o.electricityFixedFeeAzn ?? cfg.tariffs.electricity.fixedFeeAznPerMonth,
    gasRateAznPerM3: o.gasRateAznPerM3 ?? cfg.tariffs.gas.rateAznPerM3,
    gasFixedFeeAzn: o.gasFixedFeeAzn ?? cfg.tariffs.gas.fixedFeeAznPerMonth,
    electricityBudgetAzn: o.electricityBudgetAzn ?? cfg.budgets.electricityAznPerMonth,
    gasBudgetAzn: o.gasBudgetAzn ?? cfg.budgets.gasAznPerMonth,
    scope1KgCo2PerKwh: o.scope1KgCo2PerKwh ?? cfg.emissions.scope1.kgCo2PerKwh,
    scope2KgCo2PerKwh: o.scope2KgCo2PerKwh ?? cfg.emissions.scope2.kgCo2PerKwh,
    gasKwhPerM3: o.gasKwhPerM3 ?? cfg.emissions.gasKwhPerM3.value,
    euEtsPriceEurPerT: o.euEtsPriceEurPerT ?? cfg.emissions.cbam.euEtsPriceEurPerT,
    eurToAzn: o.eurToAzn ?? cfg.emissions.cbam.eurToAzn,
    annualEnergyReductionPct:
      o.annualEnergyReductionPct ?? cfg.budgets.targets.annualEnergyReductionPct,
    annualCo2ReductionPct: o.annualCo2ReductionPct ?? cfg.budgets.targets.annualCo2ReductionPct,
    annualCo2TargetT: o.annualCo2TargetT ?? cfg.budgets.targets.annualCo2TargetT,
    enpiTargetKwhPerT: o.enpiTargetKwhPerT ?? cfg.budgets.targets.enpiTargetKwhPerT,
  };
}
