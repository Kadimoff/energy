import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Flame,
  Gauge,
  Power,
  PowerOff,
  Sparkles,
  TriangleAlert,
  Wifi,
  WifiOff,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { LivePowerChart } from '@/components/charts/ops/LivePowerChart';
import {
  PlantSchematic,
  PlantStatusList,
  PlantStatusTable,
} from '@/components/charts/ops/PlantSchematic';
import { ViewAsTableButton } from '@/components/charts/ops/status';
import { EmptyState } from '@/components/common/EmptyState';
import { ChartSkeleton, KpiRowSkeleton } from '@/components/common/Skeletons';
import { StaleDataBanner } from '@/components/common/StaleDataBanner';
import { KpiCard } from '@/components/kpi/KpiCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Equipment } from '@/data/types';
import {
  liveEvents,
  livePowerSeries,
  liveReadings,
  liveTotals,
  shiftStatus,
  workshopLive,
  type LiveEvent,
  type LiveEventKind,
  type ShiftStatus,
} from '@/domain/ops';
import { useT } from '@/i18n';
import {
  formatDayMonth,
  formatKw,
  formatNumber,
  formatPct,
  formatTime,
  formatTons,
  minutesAgo,
  NBSP,
} from '@/lib/format';
import { useIsMobile } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import { useAnalysis, useAnomalies, useLive } from '@/stores/derived';

/** Route "/live": plant schematic, last 60 minutes, live event feed, shift (spec 7.4). */
export default function LivePage() {
  const { t } = useT('live');
  const { data } = useAnalysis();
  const live = useLive(60, 5000);
  const anomalies = useAnomalies();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [asTable, setAsTable] = useState(false);

  const vm = useMemo(() => {
    if (!data || !live?.latest) return undefined;
    const latest = live.latest;
    const readings = liveReadings(data, latest);
    return {
      readings,
      totals: liveTotals(data.ds.equipment, readings, data.ds.plant.peakLimitKw),
      workshops: workshopLive(data.ds, readings),
      series: livePowerSeries(live.ticks, data.ds.plant.peakLimitKw),
      shift: shiftStatus(data, latest.t),
      stale: readings
        .filter((r) => r.status === 'offline')
        .map((r) => ({
          eq: data.ds.equipment.find((e) => e.id === r.equipmentId),
          minutes: minutesAgo(r.lastSeen, latest.t),
        })),
      updatedAt: latest.t,
    };
  }, [data, live]);

  const ticks = live?.ticks;
  const events = useMemo(
    () => (data && ticks ? liveEvents(data, ticks, anomalies ?? []) : undefined),
    [data, ticks, anomalies],
  );

  const open = (id: string) => navigate(`/equipment/${id}`);
  const tot = vm?.totals;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        meta={
          vm && (
            <span className="inline-flex items-center gap-2">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <span className="font-medium text-success-text">{t('liveNow')}</span>
              <span>{t('updated', { time: formatTime(vm.updatedAt) })}</span>
            </span>
          )
        }
      />

      {vm?.stale.map(
        (s) =>
          s.eq && (
            <StaleDataBanner key={s.eq.id} minutes={s.minutes} name={s.eq.code} className="mb-4" />
          ),
      )}

      {vm && tot ? (
        <section
          aria-label={t('title')}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label={t('kpi.power')}
            value={tot.electricKw}
            format={(v) => formatKw(v)}
            animate={false}
            icon={Gauge}
            tone={tot.headroomKw < 0 ? 'danger' : tot.headroomPct < 10 ? 'warning' : 'neutral'}
            hint={
              tot.headroomKw < 0
                ? t('kpi.powerOver', { limit: formatKw(tot.peakLimitKw) })
                : t('kpi.powerHint', {
                    limit: formatKw(tot.peakLimitKw),
                    pct: formatPct(tot.headroomPct),
                  })
            }
            sparkline={vm.series.points.map((p) => p.kw)}
            sparkReference={tot.peakLimitKw}
          />
          <KpiCard
            label={t('kpi.excess')}
            value={tot.excessKw}
            format={(v) => formatKw(v)}
            animate={false}
            icon={TriangleAlert}
            tone={tot.counts.waste > 0 ? 'warning' : 'success'}
            hint={
              tot.counts.waste > 0
                ? t('kpi.excessHint', { count: tot.counts.waste })
                : t('kpi.excessNone')
            }
            footer={t('kpi.optimal', { value: formatKw(tot.expectedKw) })}
          />
          <KpiCard
            label={t('kpi.gas')}
            value={tot.gasM3h}
            format={(v) => `${formatNumber(v, 0)}${NBSP}${t('schematic.gasUnit')}`}
            animate={false}
            icon={Flame}
            hint={t('kpi.gasHint')}
          />
          <ShiftCard shift={vm.shift} />
        </section>
      ) : (
        <div aria-busy="true">
          <span className="sr-only">{t('loadingLive')}</span>
          <KpiRowSkeleton count={4} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {vm ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{t('schematic.title')}</CardTitle>
                  <CardDescription>{t('schematic.description')}</CardDescription>
                </div>
                {!isMobile && (
                  <ViewAsTableButton asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
                )}
              </CardHeader>
              <CardContent>
                {isMobile ? (
                  <PlantStatusList workshops={vm.workshops} onOpen={open} />
                ) : asTable ? (
                  <PlantStatusTable workshops={vm.workshops} />
                ) : (
                  <PlantSchematic
                    workshops={vm.workshops}
                    onOpen={open}
                    ariaLabel={t('schematic.aria', {
                      total: vm.readings.length,
                      normal: vm.totals.counts.normal,
                      waste: vm.totals.counts.waste,
                      stopped: vm.totals.counts.stopped,
                      offline: vm.totals.counts.offline,
                    })}
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <ChartSkeleton height={420} />
          )}

          {vm ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('chart.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <LivePowerChart series={vm.series} />
              </CardContent>
            </Card>
          ) : (
            <ChartSkeleton height={240} />
          )}
        </div>

        <Card className="flex min-w-0 flex-col xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start">
          <CardHeader>
            <div>
              <CardTitle>{t('feed.title')}</CardTitle>
              <CardDescription>{t('feed.description')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {data && events ? (
              <EventFeed events={events} equipment={data.ds.equipment} />
            ) : (
              <ChartSkeleton height={320} className="border-0 p-0 shadow-none" />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ShiftCard({ shift }: { shift: ShiftStatus }) {
  const { t } = useT('live');
  if (!shift.active) {
    return (
      <div className="card flex flex-col p-5">
        <p className="text-13 font-medium text-ink-2">{t('shift.title')}</p>
        <p className="mt-2 text-xl font-semibold text-ink">{t('shift.none')}</p>
        <p className="mt-1 text-xs text-ink-3">
          {shift.nextStart
            ? t('shift.next', {
                time: `${formatDayMonth(shift.nextStart)}, ${formatTime(shift.nextStart)}`,
              })
            : t('shift.noneNext')}
        </p>
      </div>
    );
  }
  const pct = Math.round(shift.progress * 100);
  const d = shift.deltaPct;
  const status =
    Math.abs(d) < 2
      ? { text: t('shift.onPlan'), cls: 'bg-bg-subtle text-ink-2' }
      : d > 0
        ? {
            text: t('shift.ahead', { pct: formatPct(d, 1) }),
            cls: 'bg-success-surface text-success-text',
          }
        : {
            text: t('shift.behind', { pct: formatPct(Math.abs(d), 1) }),
            cls: 'bg-warning-surface text-warning-text',
          };
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-13 font-medium text-ink-2">{t('shift.title')}</p>
        <span
          className={cn(
            'whitespace-nowrap rounded-[6px] px-1.5 py-0.5 text-xs font-semibold',
            status.cls,
          )}
        >
          {status.text}
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[28px] font-semibold leading-9 tracking-[-0.015em] text-ink">
        {t('shift.current', { no: shift.shiftNo })}
        <span className="text-sm font-medium tabular-nums tracking-normal text-ink-3">
          {formatTime(shift.start)}–{formatTime(shift.end)}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={t('shift.progressAria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={t('shift.progress', { pct: formatPct(pct) })}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-100"
      >
        <div className="h-full rounded-full bg-violet-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink-3">{t('shift.progress', { pct: formatPct(pct) })}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
        <div>
          <dt className="text-ink-3">{t('shift.actual')}</dt>
          <dd className="font-semibold tabular-nums text-ink">{formatTons(shift.actualTons, 1)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">{t('shift.planToNow')}</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {formatTons(shift.planToNowTons, 1)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">{t('shift.shiftPlan')}</dt>
          <dd className="font-semibold tabular-nums text-ink">{formatTons(shift.planTons, 1)}</dd>
        </div>
      </dl>
    </div>
  );
}

const EVENT_META: Record<LiveEventKind, { icon: LucideIcon; cls: string }> = {
  start: { icon: Power, cls: 'bg-success-surface text-success-text' },
  stop: { icon: PowerOff, cls: 'bg-bg-subtle text-ink-2' },
  offline: { icon: WifiOff, cls: 'bg-danger-surface text-danger-text' },
  online: { icon: Wifi, cls: 'bg-success-surface text-success-text' },
  waste_start: { icon: TriangleAlert, cls: 'bg-warning-surface text-warning-text' },
  waste_end: { icon: CircleCheck, cls: 'bg-success-surface text-success-text' },
  load_up: { icon: ArrowUpRight, cls: 'bg-info-surface text-info-text' },
  load_down: { icon: ArrowDownRight, cls: 'bg-info-surface text-info-text' },
  peak_near: { icon: Zap, cls: 'bg-danger-surface text-danger-text' },
  anomaly: { icon: Sparkles, cls: 'bg-violet-50 text-violet-700' },
};

function EventFeed({ events, equipment }: { events: LiveEvent[]; equipment: Equipment[] }) {
  const { t, tx } = useT('live');
  const names = useMemo(() => new Map(equipment.map((e) => [e.id, e.code])), [equipment]);
  if (!events.length) {
    return <EmptyState compact title={t('feed.empty')} body={t('feed.emptyBody')} />;
  }
  const text = (e: LiveEvent) => {
    const name = e.equipmentId ? (names.get(e.equipmentId) ?? e.equipmentId) : '';
    switch (e.kind) {
      case 'anomaly': {
        const subject = name
          ? name
          : e.group === 'plant' || !e.group
            ? t('feed.plantSubject')
            : t('feed.groupSubject', {
                group: tx(`common:group.${e.group}`),
                count: e.count ?? 0,
              });
        return t('feed.anomaly', { rule: tx(`common:rule.${e.rule}`), subject });
      }
      case 'load_up':
      case 'load_down':
        return t(`feed.${e.kind}`, { name, pct: formatPct(Math.abs(e.pct ?? 0)) });
      case 'waste_start':
        return t('feed.waste_start', { name, kw: formatKw(e.kw ?? 0) });
      case 'peak_near':
        return t('feed.peak_near', { kw: formatKw(e.kw ?? 0) });
      default:
        return t(`feed.${e.kind}`, { name });
    }
  };
  return (
    <ol
      aria-label={t('feed.listLabel')}
      aria-live="polite"
      aria-relevant="additions"
      className="space-y-1"
    >
      {events.map((e) => {
        const m = EVENT_META[e.kind];
        const Icon = m.icon;
        return (
          <li key={e.id} className="flex items-start gap-3 rounded-sm px-1 py-2">
            <time
              dateTime={new Date(e.t).toISOString()}
              className="w-11 shrink-0 pt-0.5 text-13 font-medium tabular-nums text-ink-2"
            >
              {formatTime(e.t)}
            </time>
            <span
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                m.cls,
              )}
              aria-hidden="true"
            >
              <Icon className="size-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 text-13 leading-5 text-ink">
              {e.kind === 'anomaly' && (
                <AiBadge variant="soft" className="mb-1 mr-1.5 align-middle" />
              )}
              <span>{text(e)}</span>
              {e.anomalyId && (
                <Link
                  to={`/anomalies?id=${encodeURIComponent(e.anomalyId)}`}
                  className="mt-0.5 block text-xs font-medium text-violet-700 hover:underline"
                >
                  {t('feed.openAnomaly')}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
