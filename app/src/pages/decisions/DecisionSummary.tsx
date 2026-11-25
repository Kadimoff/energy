import { Banknote, CheckCircle2, Hourglass, TrendingUp } from 'lucide-react';
import type { RecommendationSummary } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatAzn, formatEnergy, formatM3, formatPct, formatTCo2 } from '@/lib/format';
import { useCountUp } from '@/lib/useCountUp';
import { cn } from '@/lib/utils';
import { useBudgetHero } from '@/stores/coreViews';

function Cell({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof Banknote;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 bg-surface px-5 py-5 sm:px-6', className)}>
      <p className="flex items-center gap-1.5 text-13 font-medium text-ink-2">
        <Icon className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </p>
      {children}
    </div>
  );
}

/** Decision center summary (spec 7.6): pending, potential, accepted, live forecast. */
export function DecisionSummary({ summary }: { summary: RecommendationSummary }) {
  const { t } = useT('decisions');
  const hero = useBudgetHero();
  const potential = useCountUp(summary.potentialAznPerMonth, 600);
  const over = hero ? hero.overrunAzn > 0 : false;
  return (
    <section
      aria-label={t('summary.potential')}
      className="card grid grid-cols-2 gap-px overflow-hidden bg-border xl:grid-cols-[1.5fr_0.8fr_1fr_1.3fr]"
    >
      <Cell icon={TrendingUp} label={t('summary.potential')} className="col-span-2 xl:col-span-1">
        <p className="mt-2 text-4xl font-semibold tabular-nums tracking-[-0.015em] text-ink">
          <span className="sr-only">{formatAzn(summary.potentialAznPerMonth)}</span>
          <span aria-hidden="true">{formatAzn(potential)}</span>
          <span className="ml-1.5 text-sm font-medium tracking-normal text-ink-3">
            /{t('card.perMonth')}
          </span>
        </p>
        <p className="mt-1 text-xs tabular-nums text-ink-2">
          {[
            t('summary.potentialEnergy', { energy: formatEnergy(summary.potentialKwhPerMonth) }),
            summary.potentialM3PerMonth > 0
              ? t('summary.potentialGas', { gas: formatM3(summary.potentialM3PerMonth) })
              : null,
            t('summary.potentialCo2', { co2: formatTCo2(summary.potentialTCo2PerYear, 0) }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-2 text-xs text-ink-3">
          {t('summary.allShare', { pct: formatPct(summary.allSharePct) })}
        </p>
      </Cell>
      <Cell icon={Hourglass} label={t('summary.pending')}>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{summary.pendingCount}</p>
        <p className="mt-1 text-xs text-ink-2">{t('summary.pendingHint')}</p>
      </Cell>
      <Cell icon={CheckCircle2} label={t('summary.accepted')}>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">
          {summary.acceptedThisMonth}
        </p>
        <p className="mt-1 text-xs text-success-text">
          {t('summary.acceptedEffect', { azn: formatAzn(summary.acceptedAznPerMonth) })}
        </p>
      </Cell>
      <Cell icon={Banknote} label={t('summary.forecast')} className="col-span-2 xl:col-span-1">
        {hero ? (
          <>
            <p
              className={cn(
                'mt-2 text-3xl font-semibold tabular-nums transition-colors duration-180',
                over ? 'text-danger-text' : 'text-success-text',
              )}
              aria-live="polite"
            >
              {formatAzn(hero.forecastAzn)}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              {t('summary.forecastHint', {
                budget: formatAzn(hero.budgetAzn),
                azn: formatAzn(hero.acceptedEffectAzn),
              })}
            </p>
          </>
        ) : null}
      </Cell>
    </section>
  );
}
