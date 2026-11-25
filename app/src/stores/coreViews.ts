import { useMemo } from 'react';
import { baseConfig } from '../data/config';
import type { RecommendationVM } from '../domain/viewmodels';
import {
  budgetHero,
  carbonSnapshot,
  openAnomalyCounts,
  recentAnomalies,
  topPending,
  wasteBars,
} from '../domain/insights';
import { equipmentWasteRanking } from '../domain/copilotFacts';
import { evidenceRange, priorityMatrix } from '../domain/decisions';
import {
  useActualVsOptimal,
  useAnalysis,
  useAnomalies,
  useCarbonByMonth,
  useEquipmentRows,
  useMonthOverview,
  useRates,
  useRecommendations,
  useWasteByGroup,
} from './derived';

/**
 * View-model hooks for the core area (overview, decision center, copilot).
 * Thin wrappers over pure functions in src/domain/insights.ts,
 * src/domain/decisions.ts and src/domain/copilotFacts.ts.
 */

export function useBudgetHero() {
  const ov = useMonthOverview();
  const rates = useRates();
  return useMemo(() => (ov ? budgetHero(ov, rates) : undefined), [ov, rates]);
}

export function useWasteBars() {
  const groups = useWasteByGroup();
  const rates = useRates();
  return useMemo(() => (groups ? wasteBars(groups, rates) : undefined), [groups, rates]);
}

export function useCarbonSnapshot() {
  const months = useCarbonByMonth();
  const ov = useMonthOverview();
  const rates = useRates();
  const { data } = useAnalysis();
  return useMemo(
    () =>
      months && ov && data ? carbonSnapshot(months, ov, rates, data.ds.timeline.nowMs) : undefined,
    [months, ov, rates, data],
  );
}

export function usePriorityMatrix(items: RecommendationVM[] | undefined) {
  return useMemo(() => (items ? priorityMatrix(items) : undefined), [items]);
}

/** Evidence chart data for a recommendation's "Niyə?" panel. */
export function useEvidence(rec: Pick<RecommendationVM, 'equipmentIds' | 'mask' | 'windowDays'>) {
  const { data } = useAnalysis();
  const { mask, windowDays } = rec;
  const range = useMemo(
    () => (data ? evidenceRange(data, { mask, windowDays }) : undefined),
    [data, mask, windowDays],
  );
  return useActualVsOptimal({ eqIds: rec.equipmentIds, range, withBudget: false });
}

/** Everything the copilot needs, or undefined while loading. */
export function useCopilotData() {
  const { data } = useAnalysis();
  const rates = useRates();
  const overview = useMonthOverview();
  const recs = useRecommendations();
  const anomalies = useAnomalies();
  const equipmentRows = useEquipmentRows();
  const wasteGroups = useWasteByGroup();
  const carbonMonths = useCarbonByMonth();
  return useMemo(() => {
    if (
      !data ||
      !overview ||
      !recs ||
      !anomalies ||
      !equipmentRows ||
      !wasteGroups ||
      !carbonMonths
    )
      return undefined;
    return {
      analysis: data,
      rates,
      overview,
      recommendations: recs.items,
      summary: recs.summary,
      anomalies,
      equipmentRows,
      wasteGroups,
      carbonMonths,
    };
  }, [data, rates, overview, recs, anomalies, equipmentRows, wasteGroups, carbonMonths]);
}

export const groupColor = (id: string) =>
  baseConfig.groups.find((g) => g.id === id)?.color ?? 'var(--violet-400)';

/** Facts for the overview AI summary, pending list and anomaly list. */
export function useOverviewFacts() {
  const ov = useMonthOverview();
  const recs = useRecommendations();
  const anomalies = useAnomalies();
  const rows = useEquipmentRows();
  const groups = useWasteByGroup();
  const rates = useRates();
  return useMemo(() => {
    if (!ov || !recs || !anomalies || !rows || !groups) return undefined;
    return {
      wasteAzn: ov.waste.value,
      topGroup: groups.find((g) => g.wasteAzn > 0) ?? null,
      pendingCount: recs.summary.pendingCount,
      potentialAzn: recs.summary.potentialAznPerMonth,
      pending: topPending(recs.items, 3),
      anomalyCounts: openAnomalyCounts(anomalies),
      recentAnomalies: recentAnomalies(anomalies, 5),
      topEquipment: equipmentWasteRanking(rows, rates)[0] ?? null,
    };
  }, [ov, recs, anomalies, rows, groups, rates]);
}
