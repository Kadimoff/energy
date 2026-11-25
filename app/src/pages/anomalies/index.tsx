import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  MessageSquareText,
  RotateCcw,
  SearchX,
  Table2,
  ThumbsDown,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { WhyPanel } from '@/components/ai/WhyPanel';
import { ActualVsOptimalChart } from '@/components/charts/ActualVsOptimalChart';
import { AnomalyTimeline } from '@/components/charts/ops/AnomalyTimeline';
import { AnomalyStatusBadge, SeverityBadge } from '@/components/charts/ops/status';
import { EmptyState } from '@/components/common/EmptyState';
import { ChartSkeleton, TableSkeleton } from '@/components/common/Skeletons';
import { SourceTooltip } from '@/components/common/SourceTooltip';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { baseConfig } from '@/data/config';
import type { AnomalyRule, AnomalyStatus, Severity } from '@/data/types';
import type { Analysis } from '@/domain/analysis';
import {
  anomalyChartScope,
  anomalySummary,
  filterAnomalies,
  SEVERITY_ORDER,
  sortAnomalies,
  STATUS_ORDER,
  timelineLayout,
  type AnomalySortKey,
} from '@/domain/ops';
import type { AnomalyVM, RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDateTime,
  formatHours,
  formatKgCo2,
  formatKwh,
  formatM3,
  formatNumber,
  UNITS,
} from '@/lib/format';
import { useIsMobile } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import { useAnomalyStore } from '@/stores/anomalies';
import {
  useActualVsOptimal,
  useAnalysis,
  useAnomalies,
  useRates,
  useRecommendations,
} from '@/stores/derived';
import { useAnomalyText } from './useAnomalyText';

const RULES: AnomalyRule[] = [
  'idle_load',
  'baseload_trend',
  'spike',
  'peak_power',
  'weather_mismatch',
  'enpi_degradation',
];
const ALL = 'all';
const PEOPLE = ['p1', 'p2', 'p3', 'p4'] as const;

const csv = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  (v ?? '').split(',').filter((x): x is T => (allowed as readonly string[]).includes(x));

/** Route "/anomalies": timeline + table, filters, detail panel (spec 7.7). */
export default function AnomaliesPage() {
  const { t, tx } = useT('anomalies');
  const { data } = useAnalysis();
  const list = useAnomalies();
  const recs = useRecommendations();
  const text = useAnomalyText();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();

  const view = params.get('view') === 'timeline' ? 'timeline' : 'table';
  const selectedId = params.get('id');
  const sevStr = params.get('severity');
  const statusStr = params.get('status');
  const severity = useMemo(() => csv<Severity>(sevStr, SEVERITY_ORDER), [sevStr]);
  const status = useMemo(() => csv<AnomalyStatus>(statusStr, STATUS_ORDER), [statusStr]);
  const ruleParam = params.get('rule') as AnomalyRule | null;
  const rule = ruleParam && RULES.includes(ruleParam) ? ruleParam : null;
  const equipmentId = params.get('equipment');
  const sortParam = params.get('sort') as AnomalySortKey | null;
  const sort: AnomalySortKey =
    sortParam && ['start', 'severity', 'loss', 'status'].includes(sortParam) ? sortParam : 'start';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '' || v === ALL) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  const toggleIn = <T extends string>(key: string, cur: T[], v: T) =>
    set({ [key]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',') });

  const filtered = useMemo(
    () =>
      list
        ? sortAnomalies(
            filterAnomalies(list, {
              severity,
              status,
              rules: rule ? [rule] : [],
              equipmentId,
            }),
            sort,
            dir,
          )
        : undefined,
    [list, severity, status, rule, equipmentId, sort, dir],
  );
  const summary = useMemo(() => (filtered ? anomalySummary(filtered) : undefined), [filtered]);
  const feedback = list?.filter((a) => a.status === 'false_alarm').length ?? 0;
  const win = useMemo(
    () =>
      data
        ? { from: data.ds.timeline.hourStarts[data.windowStart], to: data.ds.timeline.nowMs }
        : undefined,
    [data],
  );
  const lanes = useMemo(
    () =>
      data && filtered && win
        ? timelineLayout(filtered, win.from, win.to, [...data.ds.groups.map((g) => g.id), 'plant'])
        : undefined,
    [data, filtered, win],
  );
  const byId = useMemo(() => new Map((list ?? []).map((a) => [a.id, a])), [list]);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const anyFilter = severity.length || status.length || rule || equipmentId;
  const resetFilters = () => set({ severity: null, status: null, rule: null, equipment: null });

  const columns: { key?: AnomalySortKey; label: string; align?: 'right'; wide?: boolean }[] = [
    { key: 'severity', label: t('col.severity') },
    { label: t('col.anomaly') },
    { label: t('col.type'), wide: true },
    { label: t('col.equipment'), wide: true },
    { key: 'start', label: t('col.period') },
    { key: 'loss', label: t('col.loss'), align: 'right' },
    { key: 'status', label: t('col.status') },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Tabs value={view} onValueChange={(v) => set({ view: v === 'table' ? null : v })}>
            <TabsList aria-label={t('views.label')}>
              <TabsTrigger value="table">{t('views.table')}</TabsTrigger>
              <TabsTrigger value="timeline">{t('views.timeline')}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {summary && (
        <section
          aria-label={t('summary.loss')}
          className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status.includes(s)}
              onClick={() => toggleIn('status', status, s)}
              className={cn(
                'card flex flex-col items-start px-4 py-3 text-left transition-[border-color,box-shadow] duration-180 hover:border-violet-200',
                status.includes(s) && 'border-violet-400 shadow-md',
              )}
            >
              <span className="text-xs text-ink-2">{tx(`common:anomalyStatus.${s}`)}</span>
              <span className="text-2xl font-semibold tabular-nums text-ink">
                {summary.byStatus[s]}
              </span>
            </button>
          ))}
          <div className="card col-span-2 flex flex-col px-4 py-3">
            <span className="text-xs text-ink-2">{t('summary.loss')}</span>
            <span className="text-2xl font-semibold tabular-nums text-ink">
              {formatAzn(summary.lossAzn)}
            </span>
            <span className="text-xs text-ink-3">
              {formatKwh(summary.lossKwh)}
              {summary.lossM3 > 0 && ` · ${formatM3(summary.lossM3)}`} ·{' '}
              {formatKgCo2(summary.lossKgCo2)}
            </span>
          </div>
        </section>
      )}

      <div
        role="search"
        aria-label={t('filters.label')}
        className="mb-4 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center"
      >
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">{t('filters.severity')}</legend>
          <span className="mr-1 text-13 text-ink-2" aria-hidden="true">
            {t('filters.severity')}
          </span>
          {SEVERITY_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={severity.includes(s)}
              onClick={() => toggleIn('severity', severity, s)}
              className={cn(
                'h-8 rounded-sm border px-2.5 text-13 font-medium transition-colors duration-180',
                severity.includes(s)
                  ? 'border-violet-400 bg-violet-50 text-violet-800'
                  : 'border-border-strong bg-surface text-ink-2 hover:border-violet-300',
              )}
            >
              {tx(`common:severity.${s}`)}
            </button>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex">
          <Select value={rule ?? ALL} onValueChange={(v) => set({ rule: v })}>
            <SelectTrigger aria-label={t('filters.type')} className="xl:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allTypes')}</SelectItem>
              {RULES.map((r) => (
                <SelectItem key={r} value={r}>
                  {tx(`common:rule.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={equipmentId ?? ALL} onValueChange={(v) => set({ equipment: v })}>
            <SelectTrigger aria-label={t('filters.equipment')} className="xl:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allEquipment')}</SelectItem>
              {(data?.ds.equipment ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 xl:ml-auto">
          <p className="text-13 text-ink-3" aria-live="polite">
            {filtered && t('summary.count', { count: filtered.length })}
          </p>
          {anyFilter ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X aria-hidden="true" />
              {t('filters.reset')}
            </Button>
          ) : null}
        </div>
      </div>

      {feedback > 0 && (
        <p className="mb-4 flex items-center gap-2 text-13 text-ink-2">
          <AiBadge variant="soft" />
          {t('summary.feedback', { count: feedback })}
        </p>
      )}

      {!filtered || !data ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title={t('empty')}
            body={t('emptyBody')}
            action={{ label: t('filters.reset'), onClick: resetFilters }}
          />
        </Card>
      ) : view === 'timeline' && lanes && win ? (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-13 text-ink-2">{t('timeline.tableHint')}</p>
              <Button variant="ghost" size="sm" onClick={() => set({ view: null })}>
                <Table2 aria-hidden="true" />
                {t('common:chart.viewTable')}
              </Button>
            </div>
            <AnomalyTimeline
              lanes={lanes}
              from={win.from}
              to={win.to}
              laneLabel={(k) => (k === 'plant' ? t('plant') : tx(`common:group.${k}`))}
              itemLabel={(id) => {
                const a = byId.get(id);
                return a
                  ? t('timeline.itemAria', {
                      title: text.title(a),
                      severity: tx(`common:severity.${a.severity}`),
                      status: tx(`common:anomalyStatus.${a.status}`),
                      period: text.period(a),
                    })
                  : id;
              }}
              onOpen={(id) => set({ id })}
              selectedId={selectedId}
              ariaLabel={t('timeline.aria', { count: filtered.length })}
            />
          </CardContent>
        </Card>
      ) : isMobile ? (
        <ul className="space-y-3" aria-label={t('tableCaption')}>
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => set({ id: a.id })}
                className="card block w-full p-4 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <SeverityBadge severity={a.severity} />
                  <AnomalyStatusBadge status={a.status} />
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{text.title(a)}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {tx(`common:rule.${a.rule}`)} · {text.period(a)}
                </p>
                <p className="mt-2 text-13 font-semibold tabular-nums text-ink">
                  {formatAzn(a.lossAzn)}{' '}
                  <span className="font-normal text-ink-3">{text.loss(a)}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <caption className="sr-only">{t('tableCaption')}</caption>
            <TableHeader className="bg-bg-subtle">
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => {
                  const active = c.key && sort === c.key;
                  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <TableHead
                      key={c.label}
                      aria-sort={
                        c.key
                          ? active
                            ? dir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                          : undefined
                      }
                      className={cn(
                        c.align === 'right' && 'text-right',
                        c.wide && 'hidden xl:table-cell',
                        'first:pl-5',
                      )}
                    >
                      {c.key ? (
                        <button
                          type="button"
                          onClick={() =>
                            set({
                              sort: c.key!,
                              dir: active && dir === 'desc' ? 'asc' : 'desc',
                            })
                          }
                          aria-label={t('sortBy', { column: c.label })}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-sm py-1 hover:text-ink',
                            active && 'text-ink',
                          )}
                        >
                          {c.label}
                          <Icon
                            className={cn('size-3.5', !active && 'opacity-50')}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        c.label
                      )}
                    </TableHead>
                  );
                })}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className={cn('cursor-pointer', a.id === selectedId && 'bg-violet-50')}
                  onClick={() => set({ id: a.id })}
                >
                  <TableCell className="pl-5">
                    <SeverityBadge severity={a.severity} />
                  </TableCell>
                  <TableCell className="min-w-[240px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        set({ id: a.id });
                      }}
                      className="text-left font-medium text-ink hover:text-violet-700"
                    >
                      {text.title(a)}
                    </button>
                    <span className="block text-xs text-ink-3">
                      <span className="xl:hidden">{tx(`common:rule.${a.rule}`)} · </span>
                      {t('occurrences', {
                        count: a.occurrences.length,
                        hours: formatHours(a.metrics.totalHours ?? 0),
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-13 text-ink-2 xl:table-cell">
                    {tx(`common:rule.${a.rule}`)}
                  </TableCell>
                  <TableCell className="hidden max-w-[160px] truncate text-13 text-ink-2 xl:table-cell">
                    {a.equipmentNames.join(', ') || t('plant')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-13 text-ink-2">
                    {text.period(a)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <span className="block font-semibold">{formatAzn(a.lossAzn)}</span>
                    <span className="block text-xs text-ink-3">{text.loss(a)}</span>
                  </TableCell>
                  <TableCell>
                    <AnomalyStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-ink-3">
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && set({ id: null })}>
        <SheetContent
          side="right"
          closeLabel={tx('common:actions.close')}
          className="overflow-y-auto sm:!w-[640px]"
        >
          {selected && data ? (
            <AnomalyDetail
              key={selected.id}
              a={selected}
              analysis={data}
              recs={recs?.items ?? []}
            />
          ) : (
            <div className="p-6">
              <SheetTitle className="text-lg font-semibold">{t('detail.notFound')}</SheetTitle>
              <SheetDescription className="mt-1 text-13 text-ink-2">
                {list ? t('detail.notFoundBody') : tx('common:states.loading')}
              </SheetDescription>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AnomalyDetail({
  a,
  analysis,
  recs,
}: {
  a: AnomalyVM;
  analysis: Analysis;
  recs: RecommendationVM[];
}) {
  const { t, tx } = useT('anomalies');
  const text = useAnomalyText();
  const rates = useRates();
  const setStatus = useAnomalyStore((s) => s.setStatus);
  const assign = useAnomalyStore((s) => s.assign);
  const addComment = useAnomalyStore((s) => s.addComment);
  const assignee = useAnomalyStore((s) => s.assignee[a.id]);
  const comments = useAnomalyStore((s) => s.comments[a.id]);
  const [draft, setDraft] = useState('');
  const scope = useMemo(() => anomalyChartScope(analysis, a), [analysis, a]);
  const chart = useActualVsOptimal({ eqIds: scope.eqIds, range: scope.range, withBudget: false });
  const rec = recs.find((r) => a.recommendationIds.includes(r.id));
  const gas = a.energy === 'gas';
  const factor = gas ? baseConfig.emissions.scope1 : baseConfig.emissions.scope2;
  const factorValue = gas ? rates.scope1KgCo2PerKwh : rates.scope2KgCo2PerKwh;
  const title = text.title(a);
  const author = tx('layout:sidebar.user');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addComment(a.id, draft.trim(), author);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-6 p-6 pt-5">
      <header className="pr-8">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={a.severity} />
          <AnomalyStatusBadge status={a.status} />
          <Badge variant="outline">{tx(`common:rule.${a.rule}`)}</Badge>
        </div>
        <SheetTitle className="text-xl font-semibold leading-7 text-ink">{title}</SheetTitle>
        <SheetDescription className="mt-1 text-13 text-ink-2">
          {text.period(a)} · {a.equipmentNames.join(', ') || t('plant')}
        </SheetDescription>
      </header>

      <section aria-label={t('detail.status')} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs text-ink-2">
          {t('detail.status')}
          <Select value={a.status} onValueChange={(v) => setStatus(a.id, v as AnomalyStatus)}>
            <SelectTrigger aria-label={t('detail.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {tx(`common:anomalyStatus.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-2">
          {t('detail.assignee')}
          <Select value={assignee ?? ALL} onValueChange={(v) => assign(a.id, v === ALL ? '' : v)}>
            <SelectTrigger aria-label={t('detail.assignee')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('detail.unassigned')}</SelectItem>
              {PEOPLE.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`people.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="sm:col-span-2">
          {a.status === 'false_alarm' ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-13 text-ink-2"
            >
              <AiBadge variant="soft" />
              <p className="flex-1">{t('detail.falseNote')}</p>
              <Button variant="ghost" size="sm" onClick={() => setStatus(a.id, 'open')}>
                <RotateCcw aria-hidden="true" />
                {t('detail.undoFalse')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button variant="secondary" size="sm" onClick={() => setStatus(a.id, 'false_alarm')}>
                <ThumbsDown aria-hidden="true" />
                {t('detail.markFalseLong')}
              </Button>
              <p className="text-xs text-ink-3 sm:flex-1">{t('detail.falseHint')}</p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby={`${a.id}-chart`}>
        <h3 id={`${a.id}-chart`} className="mb-2 text-sm font-semibold text-ink">
          {t('detail.chartTitle')}
        </h3>
        {chart ? (
          <ActualVsOptimalChart
            points={chart.points}
            title={`${title}. ${t('detail.chartTitle')}`}
            unit={chart.unit}
            resolution={chart.range.resolution}
            height={220}
            showBudget={false}
            showForecast={false}
            allowCumulative={false}
          />
        ) : (
          <ChartSkeleton height={220} className="border-0 p-0 shadow-none" />
        )}
      </section>

      <section
        aria-labelledby={`${a.id}-ai`}
        className="rounded-md border border-violet-100 bg-violet-50/50 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <AiBadge />
          <h3 id={`${a.id}-ai`} className="text-sm font-semibold text-ink">
            {t('detail.explanation')}
          </h3>
        </div>
        <p className="text-sm leading-6 text-ink">{text.explain(a)}</p>
        <WhyPanel
          className="mt-2"
          data={t('detail.whyData')}
          rule={text.rule(a, analysis.cfg)}
          compare={text.compare(a)}
        />
      </section>

      <section aria-labelledby={`${a.id}-loss`}>
        <h3 id={`${a.id}-loss`} className="mb-2 text-sm font-semibold text-ink">
          {t('detail.loss')}
        </h3>
        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-ink-3">{t('detail.lossEnergy')}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">{text.loss(a)}</dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-ink-3">{t('detail.lossMoney')}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
              {formatAzn(a.lossAzn)}
            </dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="flex items-center gap-1 text-xs text-ink-3">
              {t('detail.lossCo2')}
              <SourceTooltip
                label={gas ? 'Scope 1' : 'Scope 2'}
                value={`${formatNumber(factorValue, 3)} ${UNITS.kgCo2}/${UNITS.kwh}`}
                source={factor.source}
                date={factor.date}
                lastChecked={factor.lastChecked}
                verify={factor.verify}
              />
            </dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
              {formatKgCo2(a.lossKgCo2)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={`${a.id}-rec`}>
        <h3 id={`${a.id}-rec`} className="mb-2 text-sm font-semibold text-ink">
          {t('detail.relatedRec')}
        </h3>
        {rec ? (
          <div className="relative overflow-hidden rounded-md border border-border p-4 pl-5">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] bg-violet-600 bg-ai"
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{tx(`common:rec.title.${rec.id}`)}</p>
              <AiBadge variant="soft" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="success">
                {formatAzn(rec.aznPerMonth)}
                {tx('common:units.perMonth')}
              </Badge>
              <Badge variant="violet">{tx(`common:effort.${rec.effort}`)}</Badge>
              <Badge>{tx(`common:recStatus.${rec.status}`)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <ConfidenceMeter value={rec.confidence} size="sm" />
              <Button asChild variant="subtle" size="sm">
                <Link to="/decisions">{t('detail.openDecisions')}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-13 text-ink-2">{t('detail.noRec')}</p>
        )}
      </section>

      <section aria-labelledby={`${a.id}-comments`}>
        <h3
          id={`${a.id}-comments`}
          className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <MessageSquareText className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
          {t('detail.comments')}
        </h3>
        {comments?.length ? (
          <ul className="mb-3 space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md bg-bg-subtle px-3 py-2">
                <p className="text-xs text-ink-3">
                  <span className="font-medium text-ink-2">{c.author}</span> ·{' '}
                  {formatDateTime(c.at)}
                </p>
                <p className="text-13 text-ink">{c.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-13 text-ink-3">{t('detail.commentsEmpty')}</p>
        )}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={`${a.id}-draft`} className="sr-only">
            {t('detail.commentLabel')}
          </label>
          <textarea
            id={`${a.id}-draft`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={t('detail.commentPlaceholder')}
            className="w-full resize-y rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-3 hover:border-violet-300 focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
          />
          <div className="flex items-center justify-between gap-2">
            {a.equipmentIds[0] ? (
              <Link
                to={`/equipment/${a.equipmentIds[0]}`}
                className="inline-flex items-center gap-1 text-13 font-medium text-violet-700 hover:underline"
              >
                <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('detail.openEquipment')}
              </Link>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" variant="default" disabled={!draft.trim()}>
              {t('detail.addComment')}
            </Button>
          </div>
        </form>
      </section>
      <p className="text-xs text-ink-3">{tx('common:ai.suggestionNote')}</p>
    </div>
  );
}
