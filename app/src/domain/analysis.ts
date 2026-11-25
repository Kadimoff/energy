import type { AppConfig } from '../data/config';
import type { Anomaly, EnergyDataset, EquipmentGroupId } from '../data/types';
import { detectAnomalies } from './anomalies';
import { degreeDays, fitDailyBaseline, type DailyBaselineModel } from './baseline';
import { buildCore, dailyTotals, type AnalysisCore } from './core';
import { defaultMvOptions, evaluateMeasure, type MeasureResult } from './mv';
import { runRecommendationEngine, type RecommendationEngineResult } from './recommendations';

/**
 * One-shot analysis of a dataset. Config-dependent money/CO₂ values are NOT
 * computed here (they depend on user settings); see src/stores/derived.
 */
export interface Analysis extends AnalysisCore {
  anomalies: Anomaly[];
  engine: RecommendationEngineResult;
  measures: MeasureResult[];
  /** spec model E = a + b·ton + c·CDD + d·HDD + e·hours, plant electricity */
  plantModel: DailyBaselineModel;
  /** same per equipment group */
  groupModels: Partial<Record<EquipmentGroupId, DailyBaselineModel>>;
}

/** Fit the spec daily model on the last `trainingDays` complete days, excluding anomaly days. */
export function fitScopeDailyModel(core: AnalysisCore, eqIds: string[]): DailyBaselineModel {
  const dt = dailyTotals(core, eqIds);
  const samples = [];
  const last = core.todayDay - 1;
  for (let d = Math.max(0, last - core.cfg.trainingDays + 1); d <= last; d++) {
    const day = core.ds.days[d];
    // anomaly days (waste > 3 % of the day) are removed before fitting
    if (dt.waste[d] > 0.03 * dt.actual[d]) continue;
    const dd = degreeDays(
      day.meanTempC,
      core.ds.plant.climate.cddBaseC,
      core.ds.plant.climate.hddBaseC,
    );
    samples.push({
      vars: { tons: day.tons, cdd: dd.cdd, hdd: dd.hdd, hours: day.productionHours },
      energy: dt.actual[d],
    });
  }
  return fitDailyBaseline(samples, {
    ...core.cfg.robust,
    bandSigma: core.cfg.bandSigma,
    cvrmseWarnPct: core.cfg.cvrmseWarnPct,
  });
}

export function analyze(ds: EnergyDataset, config: AppConfig): Analysis {
  const t0 = performance.now();
  const core = buildCore(ds, config);
  const t1 = performance.now();
  const anomalies = detectAnomalies(core);
  const t2 = performance.now();
  const engine = runRecommendationEngine(core, config.recommendations, anomalies);
  const t3 = performance.now();
  const measures = ds.measures.map((m) => evaluateMeasure(core, m, defaultMvOptions));
  const plantModel = fitScopeDailyModel(core, core.electricIds);
  const groupModels: Analysis['groupModels'] = {};
  for (const g of ds.groups) {
    const ids = ds.equipment.filter((e) => e.group === g.id).map((e) => e.id);
    if (ids.length) groupModels[g.id] = fitScopeDailyModel(core, ids);
  }
  const t4 = performance.now();
  // keep object identity so per-core memo caches stay valid
  return Object.assign(core, {
    anomalies,
    engine,
    measures,
    plantModel,
    groupModels,
    timings: {
      ...core.timings,
      coreMs: t1 - t0,
      anomaliesMs: t2 - t1,
      recommendationsMs: t3 - t2,
      mvAndModelsMs: t4 - t3,
      totalMs: t4 - t0,
      generationMs: ds.generationMs,
    },
  });
}

const analysisCache = new WeakMap<EnergyDataset, Analysis>();

/** Memoised `analyze` per dataset instance. */
export function analysisFor(ds: EnergyDataset, config: AppConfig): Analysis {
  let a = analysisCache.get(ds);
  if (!a) {
    a = analyze(ds, config);
    analysisCache.set(ds, a);
  }
  return a;
}

/** Register an analysis computed elsewhere (web worker) for its dataset. */
export function registerAnalysis(a: Analysis) {
  analysisCache.set(a.ds, a);
}
