import { Activity, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DecisionNotice } from '@/components/ai/decision/DecisionNotice';
import { ActualVsOptimalChart } from '@/components/charts/ActualVsOptimalChart';
import { DeferredSection } from '@/components/common/DeferredSection';
import { ChartSkeleton } from '@/components/common/Skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n';
import { formatDateRange, formatMonthYear } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useBudgetHero,
  useCarbonSnapshot,
  useOverviewFacts,
  useWasteBars,
} from '@/stores/coreViews';
import { useActualVsOptimal, useMonthOverview, useRecommendations } from '@/stores/derived';
import { useUiStore } from '@/stores/ui';
import { CarbonMini } from './CarbonMini';
import { Hero } from './Hero';
import { KpiRow } from './KpiRow';
import { PendingDecisions } from './PendingDecisions';
import { RecentAnomalies } from './RecentAnomalies';
import { ROLE_LAYOUT, type SectionKey } from './roleLayout';
import { WasteBreakdown } from './WasteBreakdown';

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('az') + s.slice(1);

function LiveNow({ total, critical }: { total: number; critical: number }) {
  const { t } = useT('overview');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          {t('live.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-2">{t('live.body', { total, critical })}</p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link to="/live">
            <Activity aria-hidden="true" />
            {t('live.cta')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MainChart({
  chart,
  title,
  cumulative,
}: {
  chart: NonNullable<ReturnType<typeof useActualVsOptimal>>;
  title: string;
  cumulative: boolean;
}) {
  const [cum, setCum] = useState(cumulative);
  return (
    <ActualVsOptimalChart
      points={chart.points}
      title={title}
      unit={chart.unit}
      resolution={chart.range.resolution}
      height={320}
      cumulative={cum}
      onCumulativeChange={setCum}
    />
  );
}

/** Route "/": overview for directors, energy managers and operators (spec 7.3). */
export default function OverviewPage() {
  const { t, tx } = useT('overview');
  const role = useUiStore((s) => s.role);
  const layout = ROLE_LAYOUT[role];
  const ov = useMonthOverview();
  const hero = useBudgetHero();
  const facts = useOverviewFacts();
  const chart = useActualVsOptimal();
  const bars = useWasteBars();
  const carbon = useCarbonSnapshot();
  const recs = useRecommendations();

  const sections: Record<SectionKey, React.ReactNode> = {
    main: (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>{t('chart.title')}</CardTitle>
              <CardDescription className="max-w-xl">
                {chart ? `${formatDateRange(chart.range.from, chart.range.to - 1)}. ` : ''}
                {t('chart.subtitle')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {chart ? (
              <MainChart
                key={role}
                chart={chart}
                title={t('chart.title')}
                cumulative={layout.cumulative}
              />
            ) : (
              <ChartSkeleton height={320} className="border-0 p-0 shadow-none" />
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          {layout.side === 'live' && facts && (
            <LiveNow total={facts.anomalyCounts.total} critical={facts.anomalyCounts.critical} />
          )}
          <PendingDecisions
            items={facts?.pending}
            total={facts?.pendingCount ?? 0}
            actions={layout.decisionActions}
          />
        </div>
      </div>
    ),
    breakdown: (
      <div
        className={cn(
          'grid gap-6',
          layout.carbon && 'xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
        )}
      >
        <WasteBreakdown bars={bars} money={layout.money} />
        {layout.carbon && (
          <CarbonMini snap={carbon} pendingT={recs?.summary.potentialTCo2PerYear} />
        )}
      </div>
    ),
    anomalies: (
      <RecentAnomalies
        items={facts?.recentAnomalies}
        count={layout.anomalyCount}
        detail={layout.anomalyDetail}
      />
    ),
  };

  return (
    <>
      <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{t('title')}</h1>
        <p className="text-13 text-ink-3">
          {ov ? `${capitalize(formatMonthYear(ov.monthStart))} · ` : ''}
          {tx(`role.${role}`)}
        </p>
      </header>
      <Hero hero={hero} layout={layout} />
      <div className="mt-10">
        <KpiRow ov={ov} hero={hero} order={layout.kpis} />
      </div>
      <div className="mt-6 space-y-6">
        {layout.sections.map((s, i) => (
          <div key={s}>
            {i === 0 ? (
              sections[s]
            ) : (
              // later sections are below the fold: rendered after the first paint
              <DeferredSection minHeight={s === 'anomalies' ? 260 : 420}>{sections[s]}</DeferredSection>
            )}
          </div>
        ))}
      </div>
      <DecisionNotice />
    </>
  );
}
