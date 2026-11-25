import { Banknote, Factory, Gauge, Leaf, TriangleAlert } from 'lucide-react';
import { AiBadge } from '@/components/ai/AiBadge';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { WhyPanel } from '@/components/ai/WhyPanel';
import { ActualVsOptimalChart } from '@/components/charts/ActualVsOptimalChart';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ChartSkeleton, KpiRowSkeleton, TableSkeleton } from '@/components/common/Skeletons';
import { SourceTooltip } from '@/components/common/SourceTooltip';
import { StaleDataBanner } from '@/components/common/StaleDataBanner';
import { KpiCard } from '@/components/kpi/KpiCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { baseConfig } from '@/data/config';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatEnpi,
  formatKgCo2,
  formatMwh,
  formatNumber,
  formatPct,
  formatTCo2,
} from '@/lib/format';
import {
  useActualVsOptimal,
  useAnalysis,
  useMonthOverview,
  useRates,
  useRecommendations,
} from '@/stores/derived';

/**
 * Developer showcase of the shared building blocks with live mock data
 * (route /dev/components, not in the navigation). Page agents can copy
 * patterns from here. Strings are reused from common.json on purpose.
 */
export default function ShowcasePage() {
  const { t, tx } = useT('common');
  const { data } = useAnalysis();
  const ov = useMonthOverview();
  const chart = useActualVsOptimal();
  const recs = useRecommendations();
  const rates = useRates();
  const top = recs?.items[0];
  return (
    <>
      <PageHeader
        title={t('app.name')}
        subtitle={t('app.tagline')}
        actions={
          <>
            <Button variant="secondary">{t('actions.export')}</Button>
            <Button variant="primary">{t('actions.viewAll')}</Button>
          </>
        }
      />
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {ov ? (
          <>
            <KpiCard
              label={t('energy.electricity')}
              value={ov.consumptionKwh.value}
              format={(v) => formatMwh(v)}
              deltaPct={ov.consumptionKwh.deltaPct}
              sparkline={ov.consumptionKwh.spark}
              icon={Factory}
              to="/"
            />
            <KpiCard
              label={t('chart.budget')}
              value={ov.costAzn.forecastAzn}
              format={(v) => formatAzn(v)}
              hint={`${t('chart.budget')}: ${formatAzn(ov.costAzn.budgetAzn)}`}
              tone={ov.electricity.overrunAzn > 0 ? 'danger' : 'success'}
              sparkline={ov.costAzn.spark}
              sparkReference={ov.costAzn.budgetAzn}
              icon={Banknote}
            />
            <KpiCard
              label="EnPI"
              value={ov.enpi.value}
              format={(v) => formatEnpi(v)}
              deltaPct={ov.enpi.deltaPct}
              sparkline={ov.enpi.spark}
              sparkReference={ov.enpi.targetKwhPerT}
              icon={Gauge}
            />
            <KpiCard
              label="CO₂"
              value={ov.co2T.value}
              format={(v) => formatTCo2(v)}
              deltaPct={ov.co2T.deltaPct}
              sparkline={ov.co2T.spark}
              icon={Leaf}
            />
            <KpiCard
              label={t('chart.waste')}
              value={ov.waste.value}
              format={(v) => formatAzn(v)}
              hint={formatPct(ov.waste.sharePct, 1)}
              tone="warning"
              deltaPct={ov.waste.deltaPct}
              sparkline={ov.waste.spark}
              icon={TriangleAlert}
            />
          </>
        ) : (
          <div className="col-span-full">
            <KpiRowSkeleton />
          </div>
        )}
      </section>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>
              {t('chart.actual')} / {t('chart.optimal')}
            </CardTitle>
            <CardDescription data-testid="timings">
              {data
                ? Object.entries(data.timings)
                    .map(([k, v]) => `${k} ${formatNumber(v, 0)} ms`)
                    .join(' · ')
                : '–'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {chart ? (
            <ActualVsOptimalChart
              points={chart.points}
              title={`${t('chart.actual')} / ${t('chart.optimal')}`}
              resolution={chart.range.resolution}
              unit={chart.unit}
            />
          ) : (
            <ChartSkeleton height={300} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AiBadge />
              <AiBadge variant="soft" />
            </div>
            {top && <ConfidenceMeter value={top.confidence} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {top && (
              <>
                <p className="text-[15px] font-semibold text-ink">{tx(`rec.title.${top.id}`)}</p>
                <p className="text-sm text-ink-2">{tx(`rec.desc.${top.id}`)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">{formatAzn(top.aznPerMonth)}/ay</Badge>
                  <Badge variant="violet">{tx(`effort.${top.effort}`)}</Badge>
                  <Badge>{tx(`recStatus.${top.status}`)}</Badge>
                  <span className="inline-flex items-center gap-1 text-13 text-ink-2">
                    {formatKgCo2(top.kwhPerMonth * rates.scope2KgCo2PerKwh)}
                    <SourceTooltip
                      label="Scope 2"
                      value={`${formatNumber(rates.scope2KgCo2PerKwh, 2)} kq CO₂/kVt·saat`}
                      source={baseConfig.emissions.scope2.source}
                      date={baseConfig.emissions.scope2.date}
                      lastChecked={baseConfig.emissions.scope2.lastChecked}
                      verify={baseConfig.emissions.scope2.verify}
                    />
                  </span>
                </div>
                <WhyPanel data={tx(`rec.desc.${top.id}`)} rule={tx(`rule.${top.rules[0]}`)} />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 pt-5">
            <StaleDataBanner minutes={12} name="AHU-A" />
            <ConfidenceMeter value={72} size="sm" />
            <ConfidenceMeter value={48} size="sm" />
            <EmptyState
              compact
              title={t('states.emptyTitle')}
              body={t('states.noRecsApproved')}
              action={{ label: t('actions.open'), to: '/decisions' }}
            />
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <ErrorState onRetry={() => undefined} />
        </Card>
        <TableSkeleton rows={4} />
      </div>
    </>
  );
}
