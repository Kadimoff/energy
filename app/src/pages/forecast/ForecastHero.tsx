import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { AiBadge } from '@/components/ai/AiBadge';
import { WhyPanel } from '@/components/ai/WhyPanel';
import { FanChart } from '@/components/charts/analytics/FanChart';
import { ChartSkeleton } from '@/components/common/Skeletons';
import { Card } from '@/components/ui/card';
import type { ForecastHorizon } from '@/domain/analytics/forecastView';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDate,
  formatDateRange,
  formatMwh,
  formatNumber,
  formatPct,
  formatSigned,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHorizonForecast } from './hooks';
import { probabilityText } from './text';

/** Month-end / quarter-end forecast: status sentence, key numbers and the P10–P90 fan. */
export function ForecastHero({ horizon }: { horizon: ForecastHorizon }) {
  const { t } = useT('forecast');
  const vm = useHorizonForecast(horizon);
  if (!vm) return <ChartSkeleton height={360} />;
  const f = vm.forecast;
  const over = f.overrunAzn > 0;
  const period = horizon === 'month' ? t('hero.periodMonth') : t('hero.periodQuarter');
  const prob = probabilityText(f.overrunProbability, t('hero.probAbove'), t('hero.probBelow'));
  const Icon = over ? TriangleAlert : CircleCheck;
  const remainingDays = f.totalDays - f.elapsedDays;
  const stats = [
    {
      label: horizon === 'month' ? t('hero.forecastCostMonth') : t('hero.forecastCostQuarter'),
      value: formatAzn(f.costMean),
      hint: t('hero.budget', { budget: formatAzn(f.budgetAzn) }),
    },
    {
      label: t('hero.actualToDate'),
      value: formatAzn(f.actualToDateAzn),
      hint: formatMwh(f.actualToDate),
    },
    {
      label: t('hero.remaining', { days: remainingDays }),
      value: formatAzn(f.remainingAzn),
      hint: formatMwh(f.remaining),
    },
    {
      label: t('hero.recEffect'),
      value: formatSigned(-f.recommendationEffectAzn, (v) => formatAzn(v)),
      hint:
        f.recommendationEffect > 0 ? formatMwh(f.recommendationEffect) : t('hero.recEffectNone'),
    },
  ];
  return (
    <Card className="p-5 sm:p-6" aria-labelledby="forecast-hero-title">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AiBadge label={t('hero.aiLabel')} />
            <span className="text-13 text-ink-3">
              {formatDateRange(f.range.from, f.range.to - 1)}
            </span>
          </div>
          <h2
            id="forecast-hero-title"
            className={cn(
              'mt-3 flex items-start gap-2.5 text-2xl font-semibold tracking-[-0.01em]',
              over ? 'text-danger-text' : 'text-success-text',
            )}
          >
            <Icon className="mt-1 size-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>
              {over
                ? t('hero.overrun', { period, amount: formatAzn(f.overrunAzn) })
                : t('hero.within', { period, amount: formatAzn(-f.overrunAzn) })}
            </span>
          </h2>
          <p className="mt-2 text-base font-medium text-ink">{t('hero.probability', { prob })}</p>
          <p className="mt-1 text-13 text-ink-2">
            {t('hero.interval', { p10: formatAzn(f.costP10), p90: formatAzn(f.costP90) })}
          </p>
          {!f.range.complete && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-info-surface px-2 py-1 text-xs text-info-text">
              <CircleAlert className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('hero.partialQuarter', { date: formatDate(f.range.to - 1) })}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 border-l border-border pl-3">
              <dt className="text-xs text-ink-3">{s.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{s.value}</dd>
              <dd className="text-xs tabular-nums text-ink-3">{s.hint}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-6">
        <FanChart
          points={vm.fan}
          labels={{
            title: t('fan.title'),
            summary: t('fan.summary', {
              mean: formatAzn(f.costMean),
              p10: formatAzn(f.costP10),
              p90: formatAzn(f.costP90),
              budget: formatAzn(f.budgetAzn),
            }),
            date: t('fan.date'),
            actual: t('fan.actual'),
            mean: t('fan.mean'),
            p10p90: t('fan.p10p90'),
            p25p75: t('fan.p25p75'),
            p10: t('fan.p10'),
            p90: t('fan.p90'),
            budget: t('fan.budget'),
            budgetPace: t('fan.budgetPace'),
          }}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between">
        <p className={cn('text-xs', vm.model.lowReliability ? 'text-warning-text' : 'text-ink-3')}>
          {vm.model.lowReliability && (
            <TriangleAlert className="mr-1 inline size-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          {t('hero.modelQuality', {
            r2: formatNumber(vm.model.r2, 2),
            cv: formatPct(vm.model.cvRmsePct, 1),
          })}
          {vm.model.lowReliability && `. ${t('hero.lowReliability')}`}
        </p>
        <WhyPanel className="sm:max-w-md" rule={t('hero.method')} />
      </div>
    </Card>
  );
}
