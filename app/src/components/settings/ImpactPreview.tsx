import { Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n';
import { formatAzn, formatShare, formatTCo2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMonthOverview } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';

/**
 * Live effect of the current settings on this month's numbers (same hook the
 * overview page uses), so a tariff or budget edit visibly changes the forecast.
 */
export function ImpactPreview() {
  const { t } = useT('settings');
  const ov = useMonthOverview();
  const changed = useSettingsStore((s) => Object.keys(s.overrides).length);
  const items = ov
    ? [
        {
          key: 'elec',
          label: t('impact.electricity'),
          value: formatAzn(ov.electricity.costMean),
          hint: t('impact.budget', { v: formatAzn(ov.electricity.budgetAzn) }),
          tone: ov.electricity.overrunAzn > 0 ? 'danger' : 'success',
        },
        {
          key: 'prob',
          label: t('impact.probability'),
          value: formatShare(ov.electricity.overrunProbability),
          hint:
            ov.electricity.overrunAzn > 0
              ? t('impact.over', { v: formatAzn(ov.electricity.overrunAzn) })
              : t('impact.reserve', { v: formatAzn(-ov.electricity.overrunAzn) }),
          tone: ov.electricity.overrunProbability >= 0.5 ? 'danger' : 'success',
        },
        {
          key: 'gas',
          label: t('impact.gas'),
          value: formatAzn(ov.gas.costMean),
          hint: t('impact.budget', { v: formatAzn(ov.gas.budgetAzn) }),
          tone: ov.gas.overrunAzn > 0 ? 'danger' : 'success',
        },
        {
          key: 'co2',
          label: t('impact.co2'),
          value: formatTCo2(ov.co2T.forecastT),
          hint: t('impact.co2Target', { v: formatTCo2(ov.co2T.monthlyTargetT) }),
          tone: ov.co2T.forecastT > ov.co2T.monthlyTargetT ? 'danger' : 'success',
        },
      ]
    : null;
  return (
    <section
      aria-labelledby="impact-title"
      className="rounded-card border border-violet-100 bg-violet-50/50 px-5 py-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="impact-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Activity className="size-4 text-violet-600" strokeWidth={1.75} aria-hidden="true" />
          {t('impact.title')}
        </h2>
        <p className="text-xs text-ink-3">
          {changed ? t('impact.changedCount', { n: changed }) : t('impact.allDefault')}
        </p>
      </div>
      <dl
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-live="polite"
        data-testid="impact-preview"
      >
        {items
          ? items.map((x) => (
              <div key={x.key} className="min-w-0">
                <dt className="truncate text-xs text-ink-2">{x.label}</dt>
                <dd
                  className="text-lg font-semibold tabular-nums text-ink"
                  data-testid={`impact-${x.key}`}
                >
                  {x.value}
                </dd>
                <dd
                  className={cn(
                    'text-xs',
                    x.tone === 'danger' ? 'text-danger-text' : 'text-success-text',
                  )}
                >
                  {x.hint}
                </dd>
              </div>
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
            ))}
      </dl>
      <p className="mt-3 text-xs text-ink-3">{t('impact.note')}</p>
    </section>
  );
}
