import { useDeferredValue, useMemo } from 'react';
import {
  beforeAfterSeries,
  changeableDays,
  fanSeries,
  horizonForecast,
  normalizeScenario,
  outcomeDeltas,
  recommendationChecklist,
  type ForecastHorizon,
} from '@/domain/analytics/forecastView';
import { workdayProfile } from '@/domain/analytics/peak';
import type { ScenarioInput } from '@/domain/scenario';
import {
  useAnalysis,
  useRates,
  useRecommendationStates,
  useRecommendations,
  useScenario,
} from '@/stores/derived';

/** Month-end or quarter-end electricity forecast with the cumulative cost fan. */
export function useHorizonForecast(horizon: ForecastHorizon) {
  const { data } = useAnalysis();
  const rates = useRates();
  const states = useRecommendationStates();
  return useMemo(() => {
    if (!data || !states) return undefined;
    const forecast = horizonForecast(data, horizon, rates, data.engine, states);
    return { forecast, fan: fanSeries(forecast, rates), model: data.plantModel };
  }, [data, horizon, rates, states]);
}

/**
 * Simulator wiring: normalises the slider state, runs the scenario (deferred
 * so dragging stays smooth) and derives the before/after view models.
 */
export function useSimulation(input: ScenarioInput) {
  const rates = useRates();
  const normalized = useMemo(() => normalizeScenario(input, rates), [input, rates]);
  const deferred = useDeferredValue(normalized);
  const result = useScenario(deferred);
  return useMemo(() => {
    if (!result) return undefined;
    return {
      input: deferred,
      result,
      deltas: outcomeDeltas(result.base, result.scenario),
      series: beforeAfterSeries(result),
      days: changeableDays(result),
      pending: deferred !== normalized,
    };
  }, [result, deferred, normalized]);
}

/** Recommendation checklist for the simulator with money values. */
export function useChecklist() {
  const { data } = useAnalysis();
  const states = useRecommendationStates();
  const recs = useRecommendations();
  return useMemo(() => {
    if (!data || !states || !recs) return undefined;
    const byId = new Map(recs.items.map((r) => [r.id, r]));
    return recommendationChecklist(data.engine, states)
      .map((c) => ({ ...c, aznPerMonth: byId.get(c.id)?.aznPerMonth ?? 0 }))
      .sort((x, y) => y.aznPerMonth - x.aznPerMonth);
  }, [data, states, recs]);
}

/** Typical workday profile with the extrusion lines (peak planner). */
export function usePeakProfile() {
  const { data } = useAnalysis();
  return useMemo(() => {
    if (!data) return undefined;
    const lines = data.ds.equipment.filter((e) => e.group === 'extrusion');
    return {
      profile: workdayProfile(
        data,
        lines.map((l) => l.id),
      ),
      names: Object.fromEntries(lines.map((l) => [l.id, l.code])),
    };
  }, [data]);
}
