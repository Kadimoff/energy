import { useMemo } from 'react';
import {
  cumulativeByMeasure,
  evaluateMeasureOption,
  measureValues,
  mvChartSeries,
  mvExplain,
  mvSummary,
} from '@/domain/analytics/mvView';
import { defaultMvOptions } from '@/domain/mv';
import { useAnalysis, useMeasures, useRates } from '@/stores/derived';

/** M&V overview: summary KPIs, cumulative savings, measure rows. */
export function useMvPage() {
  const { data } = useAnalysis();
  const rates = useRates();
  const measures = useMeasures();
  return useMemo(() => {
    if (!data || !measures) return undefined;
    return {
      summary: mvSummary(data.measures, rates),
      cumulative: cumulativeByMeasure(data.measures, rates),
      rows: data.measures.map((r) => ({ result: r, values: measureValues(r, rates) })),
      options: defaultMvOptions,
      cvLimit: data.cfg.cvrmseWarnPct,
      equipment: Object.fromEntries(data.ds.equipment.map((e) => [e.id, e.code])),
    };
  }, [data, measures, rates]);
}

/** One measure evaluated with Option B or C, with chart points and the adjustment explanation. */
export function useMeasureDetail(id: string | null, method: 'B' | 'C', resolution: 'day' | 'week') {
  const { data } = useAnalysis();
  const rates = useRates();
  const evaluated = useMemo(() => {
    if (!data || !id) return undefined;
    const m = data.ds.measures.find((x) => x.id === id);
    if (!m) return undefined;
    return { def: m, result: evaluateMeasureOption(data, m, method) };
  }, [data, id, method]);
  return useMemo(() => {
    if (!data || !evaluated) return undefined;
    const r = evaluated.result;
    return {
      def: evaluated.def,
      result: r,
      values: measureValues(r, rates),
      explain: mvExplain(data, r),
      series: mvChartSeries(r, resolution),
      settleDays: defaultMvOptions.settleDays,
    };
  }, [data, evaluated, rates, resolution]);
}
