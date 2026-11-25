import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Factory,
  Gauge,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { ActualVsOptimalChart } from '@/components/charts/ActualVsOptimalChart';
import { HeatmapWeek } from '@/components/charts/ops/HeatmapWeek';
import { LoadHistogram } from '@/components/charts/ops/LoadHistogram';
import {
  AnomalyStatusBadge,
  EquipmentStatusBadge,
  HealthScore,
  SeverityBadge,
} from '@/components/charts/ops/status';
import { EmptyState } from '@/components/common/EmptyState';
import { ChartSkeleton, KpiRowSkeleton } from '@/components/common/Skeletons';
import { KpiCard } from '@/components/kpi/KpiCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { energyValue } from '@/domain/cost';
import { loadProfile, weekHeatmap } from '@/domain/equipment';
import {
  equipmentChartRange,
  heatmapView,
  loadHistogram,
  maintenanceSignal,
  runHours,
} from '@/domain/ops';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatEnergy,
  formatKw,
  formatM3,
  formatNumber,
  formatPct,
  NBSP,
  UNITS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAnomalyText } from '@/pages/anomalies/useAnomalyText';
import {
  useActualVsOptimal,
  useAnalysis,
  useAnomalies,
  useDateRange,
  useEquipmentRows,
  useRates,
  useRecommendations,
} from '@/stores/derived';

/** Route "/equipment/:id": equipment detail (spec 7.5). */
export default function EquipmentDetailPage() {
  const { id } = useParams();
  const { t, tx } = useT('equipment');
  const { data } = useAnalysis();
  const rows = useEquipmentRows();
  const anomalies = useAnomalies();
  const recs = useRecommendations();
  const rates = useRates();
  const selected = useDateRange();
  const text = useAnomalyText();
  const [mode, setMode] = useState<'hour' | 'day'>('hour');

  const eq = data?.ds.equipment.find((e) => e.id === id);
  const range = useMemo(
    () => (data && eq ? equipmentChartRange(data, mode, selected) : undefined),
    [data, eq, mode, selected],
  );
  const chart = useActualVsOptimal({
    eqIds: eq ? [eq.id] : undefined,
    range,
    withBudget: false,
  });

  const detail = useMemo(() => {
    if (!data || !eq) return undefined;
    const { ds } = data;
    const actual = ds.readings[eq.id];
    const today = ds.days[data.todayDay].startIndex;
    const from28 = Math.max(0, today - 28 * 24);
    const monthFrom = ds.days[ds.timeline.currentMonthStartDay].startIndex;
    return {
      runHours: runHours(actual, eq.nominal, monthFrom, ds.timeline.nowIndex),
      heat: heatmapView(weekHeatmap(data, eq.id, 28), eq.nominal),
      hist: loadHistogram(actual, eq.nominal, from28, today),
      profile: loadProfile(actual, eq.nominal, from28, today),
      workshop: ds.plant.workshops.find((w) => w.id === eq.workshop)?.name ?? eq.workshop,
    };
  }, [data, eq]);

  const row = rows?.find((r) => r.equipment.id === id);
  const mine = useMemo(
    () => anomalies?.filter((a) => id && a.equipmentIds.includes(id)).sort((a, b) => b.end - a.end),
    [anomalies, id],
  );
  const signal = useMemo(
    () => (anomalies && eq ? maintenanceSignal(anomalies, eq) : null),
    [anomalies, eq],
  );
  const myRecs = recs?.items.filter((r) => id && r.equipmentIds.includes(id));
  const wasteAzn = row
    ? energyValue(
        eq?.energy === 'gas' ? 0 : row.monthWaste,
        eq?.energy === 'gas' ? row.monthWaste : 0,
        rates,
      )
    : 0;

  if (data && !eq) {
    return (
      <Card className="mt-6">
        <EmptyState
          icon={Factory}
          title={t('notFound')}
          body={t('notFoundBody')}
          action={{ label: t('backToList'), to: '/equipment' }}
        />
      </Card>
    );
  }

  const gas = eq?.energy === 'gas';
  const unit = gas ? tx('live:schematic.gasUnit') : UNITS.kw;
  const fmtEnergy = (v: number) => (gas ? formatM3(v) : formatEnergy(v));
  const nominal = eq ? (gas ? `${eq.nominal}${NBSP}${unit}` : formatKw(eq.nominal)) : '';

  return (
    <>
      <nav aria-label={t('breadcrumb')} className="mb-3">
        <Link
          to="/equipment"
          className="inline-flex items-center gap-1 rounded-sm text-13 font-medium text-ink-2 hover:text-violet-700"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {t('title')}
        </Link>
      </nav>

      <PageHeader
        title={eq?.name ?? t('detailTitle')}
        subtitle={
          eq &&
          detail && (
            <span>
              {eq.type} · {detail.workshop} · {tx(`common:group.${eq.group}`)}
            </span>
          )
        }
        actions={row && <EquipmentStatusBadge status={row.status} className="text-13" />}
        meta={
          eq &&
          detail && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-13">
              <div className="flex gap-1.5">
                <dt className="text-ink-3">{t('detail.nominal')}:</dt>
                <dd className="font-semibold tabular-nums text-ink">{nominal}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-3">{t('detail.runHours')}:</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {t('detail.runHoursValue', { hours: formatNumber(detail.runHours) })}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-3">{t('detail.workshop')}:</dt>
                <dd className="text-ink">{detail.workshop}</dd>
              </div>
            </dl>
          )
        }
      />

      {row && eq ? (
        <section
          aria-label={t('detailTitle')}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label={t('detail.monthActual')}
            value={row.monthActual}
            format={fmtEnergy}
            icon={Gauge}
          />
          <KpiCard
            label={t('detail.monthWaste')}
            value={wasteAzn}
            format={(v) => formatAzn(v)}
            icon={TriangleAlert}
            tone={row.wastePct >= 10 ? 'warning' : 'neutral'}
            hint={`${fmtEnergy(row.monthWaste)}, ${t('detail.wasteShare', { pct: formatPct(row.wastePct, 1) })}`}
          />
          <div className="card flex flex-col p-5">
            <p className="text-13 font-medium text-ink-2">{t('detail.health')}</p>
            <HealthScore
              value={row.health}
              className="mt-3 text-[28px] [&>span:first-child]:leading-9"
            />
            <p className="mt-2 text-xs text-ink-3">{t('health.explain')}</p>
          </div>
          <MaintenanceCard
            signal={signal}
            unit={unit}
            text={{
              title: t('detail.maintenance.title'),
              none: t('detail.maintenance.none'),
              noneBody: t('detail.maintenance.noneBody'),
            }}
          />
        </section>
      ) : (
        <KpiRowSkeleton count={4} />
      )}

      {chart && eq ? (
        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>{t('detail.chartTitle')}</CardTitle>
              <CardDescription>{t('detail.chartDesc')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ActualVsOptimalChart
              key={mode}
              points={chart.points}
              title={`${eq.name}. ${t('detail.chartTitle')}`}
              unit={chart.unit}
              resolution={chart.range.resolution}
              showBudget={false}
              allowCumulative={mode === 'day'}
              height={300}
              toolbar={
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'hour' | 'day')}>
                  <TabsList aria-label={t('detail.chartMode')}>
                    <TabsTrigger value="hour">{t('detail.hourly')}</TabsTrigger>
                    <TabsTrigger value="day">{t('detail.daily')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ChartSkeleton className="mt-6" height={300} />
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {detail && eq ? (
          <>
            <Card className="min-w-0 xl:col-span-3">
              <CardHeader>
                <div>
                  <CardTitle>{t('detail.heatmapTitle')}</CardTitle>
                  <CardDescription>{t('detail.heatmapDesc')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <HeatmapWeek view={detail.heat} name={eq.name} unit={unit} />
                {detail.heat.excessSlots > 0 && (
                  <p className="mt-3 text-13 text-warning-text">
                    {t('heatmap.excessSummary', {
                      count: detail.heat.excessSlots,
                      kwh: fmtEnergy(detail.heat.excessKwhPerWeek),
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="min-w-0 xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>{t('detail.histTitle')}</CardTitle>
                  <CardDescription>{t('detail.histDesc')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <LoadHistogram bins={detail.hist} profile={detail.profile} name={eq.name} />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <ChartSkeleton className="xl:col-span-3" height={220} />
            <ChartSkeleton className="xl:col-span-2" height={220} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('detail.anomaliesTitle')}</CardTitle>
            {eq && (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/anomalies?equipment=${eq.id}`}>{t('detail.allAnomalies')}</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!mine ? (
              <ChartSkeleton height={160} className="border-0 p-0 shadow-none" />
            ) : mine.length === 0 ? (
              <EmptyState
                compact
                icon={CircleCheck}
                title={t('detail.anomaliesEmpty')}
                body={t('detail.anomaliesEmptyBody')}
              />
            ) : (
              <ul className="divide-y divide-border">
                {mine.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/anomalies?id=${encodeURIComponent(a.id)}`}
                      className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-3 hover:bg-bg-subtle"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={a.severity} />
                          <AnomalyStatusBadge status={a.status} />
                        </div>
                        <p className="text-sm font-medium text-ink">{text.title(a)}</p>
                        <p className="text-xs text-ink-3">
                          {text.period(a)} · {text.loss(a)}, {formatAzn(a.lossAzn)}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-ink-3"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t('detail.recsTitle')}</CardTitle>
              <AiBadge />
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/decisions">{t('detail.openDecisions')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!myRecs ? (
              <ChartSkeleton height={160} className="border-0 p-0 shadow-none" />
            ) : myRecs.length === 0 ? (
              <EmptyState compact title={t('detail.recsEmpty')} body={t('detail.recsEmptyBody')} />
            ) : (
              <ul className="space-y-3">
                {myRecs.map((r) => (
                  <li
                    key={r.id}
                    className="relative overflow-hidden rounded-md border border-border bg-surface p-4 pl-5"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-[3px] bg-violet-600 bg-ai"
                    />
                    <p className="text-sm font-semibold text-ink">
                      {tx(`common:rec.title.${r.id}`)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="success">
                        {t('detail.saving', { value: formatAzn(r.aznPerMonth) })}
                      </Badge>
                      <Badge variant="violet">{tx(`common:effort.${r.effort}`)}</Badge>
                      <Badge>{tx(`common:recStatus.${r.status}`)}</Badge>
                    </div>
                    <ConfidenceMeter value={r.confidence} size="sm" className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MaintenanceCard({
  signal,
  unit,
  text,
}: {
  signal: ReturnType<typeof maintenanceSignal>;
  unit: string;
  text: { title: string; none: string; noneBody: string };
}) {
  const { t } = useT('equipment');
  const kw = (v: number) => `${formatNumber(v, 1)}${NBSP}${unit}`;
  if (!signal) {
    return (
      <div className="card flex flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-13 font-medium text-ink-2">{text.title}</p>
          <Wrench className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-success-text">
          <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {text.none}
        </p>
        <p className="mt-1 text-xs text-ink-3">{text.noneBody}</p>
      </div>
    );
  }
  const headline =
    signal.kind === 'spikes'
      ? t('detail.maintenance.spikes', { count: signal.count })
      : t(`detail.maintenance.${signal.kind}`, { days: signal.days });
  return (
    <div
      className={cn('flex flex-col rounded-card border border-warning/40 bg-warning-surface p-5')}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-13 font-medium text-warning-text">{text.title}</p>
        <AiBadge variant="soft" />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-ink">
        <Wrench
          className="mt-0.5 size-4 shrink-0 text-warning-text"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        {headline}
      </p>
      <p className="mt-1 text-xs text-ink-2">
        {signal.kind === 'spikes'
          ? t('detail.maintenance.spikesBody')
          : t('detail.maintenance.trendBody', {
              ref: kw(signal.refKw),
              current: kw(signal.currentKw),
              pct: `+${formatPct(signal.increasePct, 1)}`,
              slope: kw(signal.slopeKwPerDay),
            })}
      </p>
      <Link
        to={`/anomalies?id=${encodeURIComponent(signal.anomalyId)}`}
        className="mt-2 text-xs font-medium text-violet-700 hover:underline"
      >
        {t('detail.maintenance.openAnomaly')}
      </Link>
    </div>
  );
}
