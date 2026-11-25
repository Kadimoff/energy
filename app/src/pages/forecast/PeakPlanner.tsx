import { ArrowDown, ArrowUp, RotateCcw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AiBadge } from '@/components/ai/AiBadge';
import { PeakProfileChart } from '@/components/charts/analytics/PeakProfileChart';
import { ChartSkeleton } from '@/components/common/Skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  minuteLabel,
  moveInOrder,
  PLAN_INTERVALS,
  peakReduction,
  simulatePlan,
  startMinutes,
  suggestPlan,
  type StartPlan,
} from '@/domain/analytics/peak';
import { useT } from '@/i18n';
import { formatKw, formatKwh, formatPct, formatSigned } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePeakProfile } from './hooks';

const SURGE_OPTIONS = [15, 30, 60];

/** Peak load planner (spec 7.8): reorder the extrusion line starts to lower the peak. */
export function PeakPlanner() {
  const { t } = useT('forecast');
  const vm = usePeakProfile();
  const [order, setOrder] = useState<string[] | null>(null);
  const [intervalMin, setIntervalMin] = useState(0);
  const [surgeMin, setSurgeMin] = useState(15);
  const lineIds = useMemo(() => vm?.profile.lines.map((l) => l.id) ?? [], [vm]);
  const currentOrder = order ?? lineIds;
  const calc = useMemo(() => {
    if (!vm) return null;
    const plan: StartPlan = { order: currentOrder, intervalMin, surgeMin };
    const reference = simulatePlan(vm.profile, { order: lineIds, intervalMin: 0, surgeMin });
    const result = simulatePlan(vm.profile, plan);
    const best = suggestPlan(vm.profile, surgeMin);
    return {
      reference,
      result,
      best,
      starts: startMinutes(vm.profile, plan),
      red: peakReduction(result, reference),
      surgeKwh: vm.profile.lines.reduce((s, l) => s + l.surgeKwh, 0),
    };
  }, [vm, currentOrder, intervalMin, surgeMin, lineIds]);

  if (!vm || !calc) return <ChartSkeleton height={300} />;
  const { profile, names } = vm;
  const { result, reference, red, best } = calc;
  const limit = profile.peakLimitKw;
  const overLimit = result.peakKw - limit;
  const isCurrent = intervalMin === 0;
  const bestText = t('peak.suggestion', {
    order: best.order.map((id) => names[id]).join(', '),
    interval:
      best.intervalMin === 0 ? t('peak.together') : t('peak.minutes', { value: best.intervalMin }),
    peak: formatKw(best.result.peakKw),
  });

  const stats = [
    { label: t('peak.peakNow'), value: formatKw(reference.peakKw), tone: 'text-ink' },
    { label: t('peak.peakPlan'), value: formatKw(result.peakKw), tone: 'text-ink' },
    {
      label: t('peak.reduction'),
      value: red.kw > 0.5 ? `${formatKw(red.kw)} (${formatPct(red.pct, 0)})` : formatKw(0),
      tone: red.kw > 0.5 ? 'text-success-text' : 'text-ink-2',
    },
    { label: t('peak.hourly'), value: formatKw(result.peakHourlyKw), tone: 'text-ink' },
    {
      label: t('peak.delay'),
      value:
        result.lastDelayMin > 0
          ? t('peak.delayValue', { value: result.lastDelayMin })
          : t('peak.noDelay'),
      tone: 'text-ink',
    },
  ];

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="peak-title">
      <h2 id="peak-title" className="text-lg font-semibold text-ink">
        {t('peak.title')}
      </h2>
      <p className="mt-1 max-w-3xl text-13 text-ink-2">{t('peak.subtitle')}</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <p className="text-13 font-medium text-ink" id="peak-order">
              {t('peak.order')}
            </p>
            <p className="mt-0.5 text-xs text-ink-3">
              {t('peak.orderHint', { time: minuteLabel(profile.startHour * 60) })}
            </p>
            <ol aria-labelledby="peak-order" className="mt-2 space-y-1.5">
              {currentOrder.map((id, i) => (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-ink">{names[id]}</span>
                  <span className="ml-auto text-13 tabular-nums text-ink-2">
                    {minuteLabel(calc.starts[id])}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => setOrder(moveInOrder(currentOrder, id, -1))}
                    aria-label={t('peak.moveUp', { name: names[id] })}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={i === currentOrder.length - 1}
                    onClick={() => setOrder(moveInOrder(currentOrder, id, 1))}
                    aria-label={t('peak.moveDown', { name: names[id] })}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-2">
            <p className="text-13 font-medium text-ink">{t('peak.interval')}</p>
            <Tabs value={String(intervalMin)} onValueChange={(v) => setIntervalMin(Number(v))}>
              <TabsList aria-label={t('peak.interval')} className="grid h-auto w-full grid-cols-5">
                {PLAN_INTERVALS.map((m) => (
                  <TabsTrigger
                    key={m}
                    value={String(m)}
                    className="h-auto min-h-8 whitespace-normal px-1 py-1 text-xs leading-tight"
                  >
                    {m === 0 ? t('peak.together') : t('peak.minutes', { value: m })}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-2">
            <p className="text-13 font-medium text-ink">{t('peak.surge')}</p>
            <Tabs value={String(surgeMin)} onValueChange={(v) => setSurgeMin(Number(v))}>
              <TabsList aria-label={t('peak.surge')} className="w-full">
                {SURGE_OPTIONS.map((m) => (
                  <TabsTrigger key={m} value={String(m)} className="flex-1">
                    {t('peak.minutes', { value: m })}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="text-xs text-ink-3">
              {t('peak.surgeHint', { kwh: formatKwh(calc.surgeKwh) })}
            </p>
          </div>
          <div className="rounded-md border border-violet-100 bg-violet-50/60 p-3">
            <div className="flex items-center gap-2">
              <AiBadge variant="soft" />
              <p className="text-13 font-medium text-ink">{t('peak.suggest')}</p>
            </div>
            <p className="mt-1.5 text-13 text-ink-2">{bestText}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="subtle"
                onClick={() => {
                  setOrder(best.order);
                  setIntervalMin(best.intervalMin);
                }}
              >
                <Sparkles aria-hidden="true" />
                {t('peak.apply')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isCurrent && order === null}
                onClick={() => {
                  setOrder(null);
                  setIntervalMin(0);
                }}
              >
                <RotateCcw aria-hidden="true" />
                {t('peak.reset')}
              </Button>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <dl
            className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-5"
            aria-live="polite"
          >
            {stats.map((s) => (
              <div key={s.label} className="min-w-0 border-l border-border pl-3">
                <dt className="text-xs text-ink-3">{s.label}</dt>
                <dd className={cn('mt-0.5 text-base font-semibold tabular-nums', s.tone)}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <p
            className={cn(
              'mt-3 inline-flex rounded-sm px-2 py-1 text-xs font-medium',
              overLimit > 0
                ? 'bg-danger-surface text-danger-text'
                : 'bg-success-surface text-success-text',
            )}
          >
            {t('peak.limit', { value: formatKw(limit) })}
            {': '}
            {overLimit > 0
              ? t('peak.overLimit', { value: formatKw(overLimit) })
              : t('peak.underLimit', { value: formatKw(-overLimit) })}
          </p>
          <div className="mt-4">
            <PeakProfileChart
              plan={result}
              current={reference}
              lines={currentOrder.map((id) => ({ id, label: names[id] }))}
              limitKw={limit}
              labels={{
                title: t('peak.chart.title'),
                summary: t('peak.chart.summary', {
                  peak: formatKw(result.peakKw),
                  time: minuteLabel(result.peakMinute),
                  current: formatKw(reference.peakKw),
                  limit: formatKw(limit),
                }),
                time: t('peak.chart.time'),
                base: t('peak.chart.base'),
                total: t('peak.chart.total'),
                current: t('peak.chart.current'),
                limit: t('peak.chart.limit'),
              }}
            />
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {t('peak.basis', { days: profile.days })}.{' '}
            {Math.abs(red.energyKwh) >= 1 &&
              `${t('peak.energyDiff', { value: formatSigned(red.energyKwh, (v) => formatKwh(v)) })}. `}
            {t('peak.note')}
          </p>
        </div>
      </div>
    </Card>
  );
}
