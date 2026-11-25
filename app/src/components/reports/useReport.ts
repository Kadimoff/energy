import { useMemo } from 'react';
import { useAdminStore, usePlantProfile, staticFactorsChanged } from '@/stores/admin';
import {
  useAnalysis,
  useAnomalies,
  useMeasures,
  useRates,
  useRecommendationStates,
  useRecommendations,
} from '@/stores/derived';
import {
  buildReport,
  reportPeriods,
  type Report,
  type ReportTemplateId,
} from '@/services/ReportService';

/** Report view model for a template and month, built by ReportService from live domain data. */
export function useReport(template: ReportTemplateId, monthKey: string | null) {
  const analysis = useAnalysis();
  const data = analysis.data;
  const rates = useRates();
  const states = useRecommendationStates();
  const recs = useRecommendations();
  const anomalies = useAnomalies();
  const measures = useMeasures();
  const plant = usePlantProfile();
  const checked = useAdminStore((s) => s.checked);
  const periods = useMemo(() => (data ? reportPeriods(data) : undefined), [data]);
  const report: Report | undefined = useMemo(() => {
    if (!data || !states || !recs || !anomalies || !measures || !periods?.length) return undefined;
    const key = periods.some((p) => p.key === monthKey) ? (monthKey as string) : periods[0].key;
    return buildReport(template, {
      analysis: data,
      rates,
      recStates: states,
      recommendations: recs.items,
      anomalies,
      measures: measures.items,
      plant: {
        name: plant.name,
        sector: plant.sector,
        location: plant.location,
        areaM2: plant.areaM2,
        staticFactorsChanged: staticFactorsChanged(plant),
      },
      monthKey: key,
      checked,
    });
  }, [data, states, recs, anomalies, measures, periods, monthKey, template, rates, plant, checked]);
  return {
    report,
    periods,
    nowMs: data?.ds.timeline.nowMs,
    isError: analysis.isError,
    refetch: analysis.refetch,
  };
}
