import { useCallback } from 'react';
import type { AnalysisConfig } from '@/data/config';
import type { Anomaly } from '@/data/types';
import { anomalyHours, anomalyTitle } from '@/domain/ops';
import type { AnomalyVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDateRange,
  formatDateTime,
  formatEnergy,
  formatEnpi,
  formatHours,
  formatKw,
  formatM3,
  formatNumber,
  formatPct,
  formatTemp,
  formatTime,
} from '@/lib/format';

/**
 * Text builders for anomalies (titles, periods, AI explanations, rule
 * descriptions). Numbers come from the anomaly metrics and are only
 * formatted here; templates live in i18n.
 */
export function useAnomalyText() {
  const { t, tx } = useT('anomalies');

  const title = useCallback(
    (a: AnomalyVM) => {
      const p = anomalyTitle(a);
      return tx(`common:${p.key}`, {
        equipment: p.equipment || t('plant'),
        hours: formatNumber(p.hours),
        pct: formatNumber(p.pct, 0),
        count: p.count,
      });
    },
    [t, tx],
  );

  const period = useCallback(
    (a: Anomaly) =>
      a.end - a.start <= 86_400_000
        ? `${formatDateTime(a.start)}–${formatTime(a.end)}`
        : formatDateRange(a.start, a.end - 1),
    [],
  );

  const loss = useCallback(
    (a: AnomalyVM) => (a.energy === 'gas' ? formatM3(a.lossM3) : formatEnergy(a.lossKwh)),
    [],
  );

  const explain = useCallback(
    (a: AnomalyVM) => {
      const m = a.metrics;
      const equipment = a.equipmentNames.join(', ') || t('plant');
      const gas = a.energy === 'gas';
      const kw = (v: number) => (gas ? formatM3(v, 1) : formatKw(v, v < 10 && v >= 0.05 ? 1 : 0));
      const lossText = `${loss(a)}, ${formatAzn(a.lossAzn)}`;
      switch (a.rule) {
        case 'idle_load':
          return t('explain.idle_load', {
            equipment,
            occurrences: a.occurrences.length,
            hours: formatHours(anomalyHours(a)),
            avgKw: kw(m.avgKw ?? 0),
            loadPct: formatPct(m.loadPct ?? 0),
            expectedKw: kw(m.expectedKw ?? 0),
            loss: lossText,
          });
        case 'baseload_trend':
          return t('explain.baseload_trend', {
            equipment,
            days: Math.round(m.days ?? 0),
            refKw: kw(m.refKw ?? 0),
            currentKw: kw(m.currentKw ?? 0),
            pct: `+${formatPct(m.increasePct ?? 0, 1)}`,
            slope: kw(m.slopeKwPerDay ?? 0),
            loss: lossText,
          });
        case 'spike':
          return t('explain.spike', {
            equipment,
            time: formatDateTime(a.start),
            peakKw: kw(m.peakKw ?? 0),
            expectedKw: kw(m.expectedKw ?? 0),
            z: formatNumber(m.zScore ?? 0, 1),
            loss: lossText,
          });
        case 'peak_power':
          return t('explain.peak_power', {
            count: Math.round(m.starts ?? a.equipmentIds.length),
            hour: `${String(Math.round(m.hour ?? 0)).padStart(2, '0')}:00`,
            peakKw: formatKw(m.peakKw ?? 0),
            limitKw: formatKw(m.peakLimitKw ?? 0),
            typicalKw: formatKw(m.typicalKw ?? 0),
            loss: lossText,
          });
        case 'weather_mismatch':
          return t('explain.weather_mismatch', {
            equipment,
            temp: formatTemp(m.meanTempC ?? 0),
            hours: formatHours(m.totalHours ?? m.hours ?? 0),
            loadPct: formatPct(m.loadPct ?? 0),
            expectedKw: kw(m.expectedKw ?? 0),
            loss: lossText,
          });
        case 'enpi_degradation':
          return t('explain.enpi_degradation', {
            enpi: formatEnpi(m.enpi ?? 0),
            expected: formatEnpi(m.expectedEnpi ?? 0),
            pct: `+${formatPct(m.deviationPct ?? 0, 1)}`,
            loss: lossText,
          });
      }
    },
    [t, loss],
  );

  /** Rule description with the thresholds from config/analysis.json. */
  const rule = useCallback(
    (a: Anomaly, cfg: AnalysisConfig) => {
      const r = cfg.rules;
      switch (a.rule) {
        case 'idle_load':
          return t('rule.idle_load', { minHours: r.idleLoad.minHours });
        case 'baseload_trend':
          return t('rule.baseload_trend', {
            from: String(r.baseloadTrend.nightStartHour).padStart(2, '0'),
            to: String(r.baseloadTrend.nightEndHour).padStart(2, '0'),
            days: r.baseloadTrend.trendDays,
            pct: formatPct(r.baseloadTrend.minIncreasePct),
          });
        case 'spike':
          return t('rule.spike', { z: formatNumber(r.spike.zScore) });
        case 'peak_power':
          return t('rule.peak_power', { count: r.peak.minSimultaneousStarts });
        case 'weather_mismatch':
          return t('rule.weather_mismatch', {
            temp: formatTemp(r.weatherMismatch.coldDayMeanC, 0),
            load: formatPct(r.weatherMismatch.minLoadPct * 100),
          });
        case 'enpi_degradation':
          return t('rule.enpi_degradation', { pct: formatPct(r.enpi.thresholdPct) });
      }
    },
    [t],
  );

  /** "Müqayisə" line of the Why panel. */
  const compare = useCallback(
    (a: AnomalyVM) => {
      const m = a.metrics;
      if (a.rule === 'enpi_degradation') {
        return t('detail.whyCompareEnpi', {
          actual: formatEnpi(m.enpi ?? 0),
          expected: formatEnpi(m.expectedEnpi ?? 0),
        });
      }
      const gas = a.energy === 'gas';
      const kw = (v: number) => (gas ? formatM3(v, 1) : formatKw(v, v < 10 ? 1 : 0));
      const actual = m.avgKw ?? m.peakKw ?? m.currentKw ?? 0;
      const expected = m.expectedKw ?? m.typicalKw ?? m.refKw ?? 0;
      return t('detail.whyCompare', { actual: kw(actual), expected: kw(expected) });
    },
    [t],
  );

  return { title, period, loss, explain, rule, compare };
}
