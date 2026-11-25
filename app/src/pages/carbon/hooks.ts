import { useMemo } from 'react';
import { baseConfig } from '@/data/config';
import {
  carbonBySource,
  carbonYear,
  factorRows,
  lastCompleteMonths,
  periodEmissions,
  reductionRoadmap,
} from '@/domain/analytics/carbonView';
import { useAnalysis, useCarbonByMonth, useRates, useRecommendationStates } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';
import { formatNumber, NBSP, UNITS } from '@/lib/format';

/** Everything the carbon page shows, from src/domain with the effective factors. */
export function useCarbonPage() {
  const { data } = useAnalysis();
  const rates = useRates();
  const states = useRecommendationStates();
  const months = useCarbonByMonth();
  const overrides = useSettingsStore((s) => s.overrides);
  return useMemo(() => {
    if (!data || !states || !months) return undefined;
    const year = carbonYear(data, rates, data.engine, states);
    const l12 = lastCompleteMonths(data, 12);
    const last12 = periodEmissions(data, rates, l12.fromDay, l12.toDay);
    return {
      year,
      months,
      sources: carbonBySource(data, rates, baseConfig.groups, year.fromDay, data.todayDay + 1),
      l12,
      last12,
      roadmap: reductionRoadmap(data, data.engine, states, rates, last12.totalT),
      factors: factorRows(baseConfig, rates, overrides),
      states,
    };
  }, [data, rates, states, months, overrides]);
}

export type FactorKind = 'scope1' | 'scope2' | 'gasKwhPerM3';

/** Formatted factor value with unit, e.g. "0,41 kq CO₂/kVt·saat". */
export function useFactorText() {
  const rates = useRates();
  return (k: FactorKind) =>
    k === 'gasKwhPerM3'
      ? `${formatNumber(rates.gasKwhPerM3, 1)}${NBSP}${UNITS.kwh}/${UNITS.m3}`
      : factorText(k === 'scope1' ? rates.scope1KgCo2PerKwh : rates.scope2KgCo2PerKwh);
}

/** 0.41 -> "0,41 kq CO₂/kVt·saat", 0.202 -> "0,202 kq CO₂/kVt·saat" */
export function factorText(v: number) {
  const d = Math.abs(Number(v.toFixed(2)) - v) < 1e-9 ? 2 : 3;
  return `${formatNumber(v, d)}${NBSP}${UNITS.kgCo2}/${UNITS.kwh}`;
}
