import {
  AlertOctagon,
  ArrowRight,
  CircleCheck,
  MessageSquareText,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { BudgetHero, BudgetState } from '@/domain/insights';
import { useT } from '@/i18n';
import { formatAzn, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useOverviewFacts } from '@/stores/coreViews';
import { useUiStore } from '@/stores/ui';
import type { RoleLayout } from './roleLayout';

const TONE: Record<
  BudgetState,
  { text: string; bg: string; bar: string; icon: typeof CircleCheck }
> = {
  over: { text: 'text-danger-text', bg: 'bg-danger-surface', bar: 'bg-danger', icon: AlertOctagon },
  risk: {
    text: 'text-warning-text',
    bg: 'bg-warning-surface',
    bar: 'bg-warning',
    icon: TriangleAlert,
  },
  within: {
    text: 'text-success-text',
    bg: 'bg-success-surface',
    bar: 'bg-success',
    icon: CircleCheck,
  },
};

/** Budget bar: forecast fill, P10–P90 range and the budget marker. */
function BudgetBar({ hero }: { hero: BudgetHero }) {
  const { t } = useT('overview');
  const tone = TONE[hero.state];
  const max = Math.max(hero.budgetAzn, hero.p90Azn) * 1.06;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="mt-6 max-w-xl">
      <div className="relative h-2.5 rounded-full bg-violet-50 ring-1 ring-inset ring-border">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', tone.bar)}
          style={{ width: pct(hero.forecastAzn) }}
        />
        <div
          className="absolute inset-y-[-3px] rounded-full bg-ink/10"
          style={{
            left: pct(hero.p10Azn),
            width: `calc(${pct(hero.p90Azn)} - ${pct(hero.p10Azn)})`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-[-6px] w-0.5 rounded bg-ink"
          style={{ left: pct(hero.budgetAzn) }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className={cn('font-semibold tabular-nums', tone.text)}>
          {t('hero.budgetBar', { pct: formatPct(hero.usedPct) })}
        </span>
        <span className="tabular-nums text-ink-3">
          {t('hero.range', { p10: formatAzn(hero.p10Azn), p90: formatAzn(hero.p90Azn) })}
        </span>
      </div>
    </div>
  );
}

export function Hero({ hero, layout }: { hero: BudgetHero | undefined; layout: RoleLayout }) {
  const { t, tx } = useT('overview');
  const facts = useOverviewFacts();
  const setCopilot = useUiStore((s) => s.setCopilotOpen);
  const tone = hero ? TONE[hero.state] : TONE.within;
  const Icon = tone.icon;

  const sentence = hero
    ? hero.overrunAzn > 0
      ? hero.probabilityCapped && hero.probabilityPct >= 99
        ? t('hero.overrunCapped', { amount: formatAzn(hero.overrunAzn) })
        : t('hero.overrun', {
            amount: formatAzn(hero.overrunAzn),
            prob: formatPct(hero.probabilityPct),
          })
      : hero.state === 'risk'
        ? t('hero.reserveRisk', { prob: formatPct(hero.probabilityPct) })
        : t('hero.reserve', { amount: formatAzn(hero.reserveAzn) })
    : '';

  const parts: string[] = [];
  if (facts) {
    for (const p of layout.summary) {
      if (p === 'waste' && facts.topGroup)
        parts.push(
          t('summary.waste', {
            waste: formatAzn(facts.wasteAzn),
            group: tx(`common:group.${facts.topGroup.group}`).toLocaleLowerCase('az'),
            groupAzn: formatAzn(facts.topGroup.wasteAzn),
          }),
        );
      if (p === 'potential' && facts.pendingCount > 0)
        parts.push(
          t('summary.potential', { count: facts.pendingCount, azn: formatAzn(facts.potentialAzn) }),
        );
      if (p === 'top' && facts.pending[0])
        parts.push(
          t('summary.top', {
            title: tx(`common:rec.title.${facts.pending[0].id}`),
            azn: formatAzn(facts.pending[0].aznPerMonth),
          }),
        );
      if (p === 'anomalies')
        parts.push(
          facts.anomalyCounts.total
            ? t('summary.anomalies', facts.anomalyCounts)
            : t('summary.noAnomalies'),
        );
      if (p === 'equipment' && facts.topEquipment)
        parts.push(
          t('summary.equipment', {
            name: facts.topEquipment.equipment.name,
            pct: formatPct(facts.topEquipment.wastePct, 1),
          }),
        );
    }
  }

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0 pt-1">
        {hero ? (
          <>
            <p
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                tone.bg,
                tone.text,
              )}
            >
              <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
              {tx(`hero.state.${hero.state}`)}
            </p>
            <p
              className={cn(
                'mt-4 max-w-[20ch] text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-4xl lg:max-w-[22ch]',
                tone.text,
              )}
            >
              {sentence}
            </p>
            <p className="mt-4 max-w-xl text-sm text-ink-2">
              {t('hero.meta', {
                forecast: formatAzn(hero.forecastAzn),
                budget: formatAzn(hero.budgetAzn),
                days: hero.daysLeft,
              })}
              {hero.acceptedEffectAzn > 0.5 && (
                <span className="text-success-text">
                  {' '}
                  {t('hero.accepted', { azn: formatAzn(hero.acceptedEffectAzn) })}.
                </span>
              )}
            </p>
            <BudgetBar hero={hero} />
          </>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-10 w-full max-w-lg" />
            <Skeleton className="h-10 w-3/4 max-w-md" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        )}
      </div>

      <aside
        className="card relative overflow-hidden p-5 pl-6 sm:p-6 sm:pl-7"
        aria-label={t('summary.title')}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-ai" />
        <div className="flex items-center gap-2">
          <AiBadge />
          <h2 className="text-[15px] font-semibold text-ink">{t('summary.title')}</h2>
        </div>
        {facts ? (
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
            {parts.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild variant="primary" size="md">
            <Link to="/decisions">
              {facts && facts.pendingCount > 0
                ? t('summary.cta', { count: Math.min(3, facts.pendingCount) })
                : t('summary.ctaNone')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => setCopilot(true, tx('copilot:presets.budget'))}
          >
            <MessageSquareText aria-hidden="true" />
            {t('summary.ask')}
          </Button>
        </div>
      </aside>
    </section>
  );
}
