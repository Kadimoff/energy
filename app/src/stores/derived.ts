import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { baseConfig, resolveRates, type EffectiveRates } from '../data/config';
import { dataSource, loadAnalysis } from '../data/sources';
import type { LiveReading, LiveTick, RecommendationState } from '../data/types';
import type { Analysis } from '../domain/analysis';
import { cumulativeSavings } from '../domain/mv';
import { runScenario, type ScenarioInput } from '../domain/scenario';
import {
  anomalyVMs,
  carbonByMonth,
  chartSeries,
  effectiveRecStates,
  equipmentRows,
  monthBudgetKwh,
  monthOverview,
  recommendationSummary,
  recommendationVMs,
  resolveRange,
  wasteByGroup,
  type ChartPoint,
  type ResolvedRange,
} from '../domain/viewmodels';
import { electricityBudgetForecast, forecastPeriod, monthDayRange } from '../domain/forecast';
import { useAnomalyStore } from './anomalies';
import { useRecommendationStore } from './recommendations';
import { useSettingsStore } from './settings';
import { useUiStore } from './ui';

/**
 * View-model hooks. Pages call these and render; all numbers come from
 * src/domain via the pure builders in src/domain/viewmodels.ts.
 * Every hook returns `undefined` while the analysis is loading.
 */

export const queryKeys = {
  analysis: ['analysis'] as const,
  recStates: ['recommendation-states'] as const,
  anomalies: ['anomalies'] as const,
};

/** Dataset + models + anomalies + recommendations + M&V (computed once). */
export function useAnalysis() {
  return useQuery({
    queryKey: queryKeys.analysis,
    queryFn: () => loadAnalysis(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Tariffs, budgets, factors and targets with Settings overrides applied. */
export function useRates(): EffectiveRates {
  const overrides = useSettingsStore((s) => s.overrides);
  return useMemo(() => resolveRates(baseConfig, overrides), [overrides]);
}

/** Effective recommendation states: data source states overlaid with user decisions. */
export function useRecommendationStates(): Record<string, RecommendationState> | undefined {
  const ready = !!useAnalysis().data;
  const q = useQuery({
    queryKey: queryKeys.recStates,
    queryFn: () => dataSource.getRecommendationStates(),
    staleTime: Infinity,
    enabled: ready,
  });
  const overrides = useRecommendationStore((s) => s.overrides);
  return useMemo(
    () => (q.data ? effectiveRecStates(q.data, overrides) : undefined),
    [q.data, overrides],
  );
}

/** Selected date range resolved against the dataset (Topbar selector). */
export function useDateRange(): ResolvedRange | undefined {
  const { data } = useAnalysis();
  const preset = useUiStore((s) => s.rangePreset);
  const custom = useUiStore((s) => s.customRange);
  return useMemo(
    () => (data ? resolveRange(data, preset, custom) : undefined),
    [data, preset, custom],
  );
}

export function useRecommendations() {
  const { data } = useAnalysis();
  const rates = useRates();
  const states = useRecommendationStates();
  return useMemo(() => {
    if (!data || !states) return undefined;
    const items = recommendationVMs(data.engine.recommendations, states, rates, data.ds.equipment);
    return { items, summary: recommendationSummary(data, items, rates) };
  }, [data, rates, states]);
}

/** Number of recommendations waiting for a decision (sidebar badge). */
export function usePendingCount(): number | undefined {
  return useRecommendations()?.summary.pendingCount;
}

export function useAnomalies() {
  const { data } = useAnalysis();
  const rates = useRates();
  const status = useAnomalyStore((s) => s.status);
  const q = useQuery({
    queryKey: queryKeys.anomalies,
    queryFn: () => dataSource.getAnomalies(),
    staleTime: Infinity,
    enabled: !!data,
  });
  return useMemo(
    () => (data && q.data ? anomalyVMs(q.data, status, rates, data.ds.equipment) : undefined),
    [data, q.data, status, rates],
  );
}

/** Current month: KPIs, electricity/gas budget forecast (accepted recommendations applied). */
export function useMonthOverview() {
  const { data } = useAnalysis();
  const rates = useRates();
  const states = useRecommendationStates();
  return useMemo(
    () => (data && states ? monthOverview(data, rates, states) : undefined),
    [data, rates, states],
  );
}

/**
 * Actual vs optimal points for a scope (default: all electricity meters) and
 * the selected (or given) range, including forecast and budget line when the
 * range covers the current month.
 */
export function useActualVsOptimal(
  opts: { eqIds?: string[]; range?: ResolvedRange; withBudget?: boolean } = {},
): { points: ChartPoint[]; range: ResolvedRange; unit: 'kWh' | 'm3' } | undefined {
  const { data } = useAnalysis();
  const selected = useDateRange();
  const rates = useRates();
  const states = useRecommendationStates();
  const range = opts.range ?? selected;
  const key = opts.eqIds?.join('|');
  return useMemo(() => {
    if (!data || !range || !states) return undefined;
    const eqIds = key ? key.split('|') : data.electricIds;
    const gas = eqIds.every((id) => data.gasIds.includes(id));
    const fc = electricityBudgetForecast(
      forecastPeriod(data, {
        eqIds,
        fromDay: range.fromDay,
        toDay: range.toDay,
        engine: data.engine,
        recStates: states,
      }),
      rates,
    );
    const cur = monthDayRange(data, 0);
    const isMonth = range.fromDay === cur.fromDay && range.toDay === cur.toDay;
    const points = chartSeries(data, {
      eqIds,
      range,
      forecast: fc,
      monthBudgetKwh:
        (opts.withBudget ?? true) && isMonth && !gas && key === undefined
          ? monthBudgetKwh(rates)
          : null,
    });
    return { points, range, unit: gas ? 'm3' : 'kWh' };
  }, [data, range, rates, states, key, opts.withBudget]);
}

export function useWasteByGroup() {
  const { data } = useAnalysis();
  const rates = useRates();
  return useMemo(() => (data ? wasteByGroup(data, rates, baseConfig) : undefined), [data, rates]);
}

export function useEquipmentRows() {
  const { data } = useAnalysis();
  const anomalies = useAnomalies();
  return useMemo(
    () => (data && anomalies ? equipmentRows(data, anomalies) : undefined),
    [data, anomalies],
  );
}

export function useCarbonByMonth() {
  const { data } = useAnalysis();
  const rates = useRates();
  return useMemo(() => (data ? carbonByMonth(data, rates) : undefined), [data, rates]);
}

export function useMeasures() {
  const { data } = useAnalysis();
  const rates = useRates();
  return useMemo(() => {
    if (!data) return undefined;
    return {
      items: data.measures.map((m) => ({
        ...m,
        avoidedAzn: m.avoidedKwh * rates.electricityRateAznPerKwh,
        avoidedPerMonthAzn: m.avoidedPerMonthKwh * rates.electricityRateAznPerKwh,
      })),
      cumulative: cumulativeSavings(data.measures),
    };
  }, [data, rates]);
}

export function useScenario(input: ScenarioInput) {
  const { data } = useAnalysis();
  const rates = useRates();
  const states = useRecommendationStates();
  const key = JSON.stringify(input);
  return useMemo(() => {
    if (!data || !states) return undefined;
    return runScenario(data, data.engine, states, rates, JSON.parse(key) as ScenarioInput);
  }, [data, rates, states, key]);
}

export interface LiveState {
  ticks: LiveTick[];
  latest: LiveTick | null;
  /** readings with waste status (above the optimal band of the current hour) */
  readings: (LiveReading & { expectedKw: number; upperKw: number })[];
  staleMinutes: number;
}

/** Live stream (5 s) + 60 minute history; status `waste` when above the current hour band. */
export function useLive(historyMinutes = 60, intervalMs = 5000): LiveState | undefined {
  const { data } = useAnalysis();
  const [ticks, setTicks] = useState<LiveTick[]>([]);
  useEffect(() => {
    if (!data) return;
    let alive = true;
    void dataSource.getLiveHistory(historyMinutes).then((h) => alive && setTicks(h));
    const unsub = dataSource.getLiveStream((t) => {
      if (!alive) return;
      setTicks((prev) => [...prev.filter((p) => p.t > t.t - historyMinutes * 60_000), t]);
    }, intervalMs);
    return () => {
      alive = false;
      unsub();
    };
  }, [data, historyMinutes, intervalMs]);
  return useMemo(() => {
    if (!data) return undefined;
    const latest = ticks[ticks.length - 1] ?? null;
    const idx = Math.min(data.ds.timeline.hours - 1, data.ds.timeline.nowIndex);
    const readings = (latest?.readings ?? []).map((r) => {
      const b = (data as Analysis).bands[r.equipmentId];
      const upper = b?.upper[idx] ?? 0;
      const expected = b?.expected[idx] ?? 0;
      const status = r.status === 'normal' && r.kw > upper ? ('waste' as const) : r.status;
      return { ...r, status, expectedKw: expected, upperKw: upper };
    });
    const offline = data.ds.offlineEquipment[0];
    const staleMinutes = offline && latest ? Math.round((latest.t - offline.since) / 60_000) : 0;
    return { ticks, latest, readings, staleMinutes };
  }, [data, ticks]);
}
