import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search, X } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EquipmentStatusBadge, HealthScore } from '@/components/charts/ops/status';
import { EmptyState } from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/Skeletons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EquipmentGroupId } from '@/data/types';
import { queryEquipment, type EquipmentSortKey } from '@/domain/ops';
import type { EquipmentRow } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatDayShort, formatEnergy, formatKw, formatM3, formatPct, NBSP } from '@/lib/format';
import { useIsMobile } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import { useAnalysis, useEquipmentRows } from '@/stores/derived';

const ALL = 'all';
const SORT_KEYS: EquipmentSortKey[] = [
  'name',
  'group',
  'workshop',
  'nominal',
  'monthActual',
  'wastePct',
  'health',
  'lastAnomaly',
  'status',
];
const STATUSES: EquipmentRow['status'][] = ['waste', 'attention', 'normal'];

/** Route "/equipment": searchable, filterable, sortable equipment table (spec 7.5). */
export default function EquipmentPage() {
  const { t, tx } = useT('equipment');
  const { data } = useAnalysis();
  const rows = useEquipmentRows();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();

  const query = params.get('q') ?? '';
  const group = (params.get('group') as EquipmentGroupId | null) ?? null;
  const workshop = params.get('workshop');
  const status = (params.get('status') as EquipmentRow['status'] | null) ?? null;
  const sortParam = params.get('sort') as EquipmentSortKey | null;
  const sort: EquipmentSortKey =
    sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'wastePct';
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

  const workshopNames = useMemo(
    () => Object.fromEntries((data?.ds.plant.workshops ?? []).map((w) => [w.id, w.name])),
    [data],
  );
  const list = useMemo(
    () =>
      rows
        ? queryEquipment(rows, { query, group, workshop, status, sort, dir, workshopNames })
        : undefined,
    [rows, query, group, workshop, status, sort, dir, workshopNames],
  );
  const counts = useMemo(
    () =>
      rows && {
        total: rows.length,
        waste: rows.filter((r) => r.status === 'waste').length,
        attention: rows.filter((r) => r.status === 'attention').length,
      },
    [rows],
  );

  const filtered = !!(query || group || workshop || status);
  const toggleSort = (k: EquipmentSortKey) =>
    set({
      sort: k,
      dir:
        sort === k
          ? dir === 'asc'
            ? 'desc'
            : 'asc'
          : k === 'name' || k === 'group' || k === 'workshop'
            ? 'asc'
            : 'desc',
    });

  const monthValue = (r: EquipmentRow) =>
    r.equipment.energy === 'gas' ? formatM3(r.monthActual) : formatEnergy(r.monthActual);
  const nominal = (r: EquipmentRow) =>
    r.equipment.energy === 'gas'
      ? `${r.equipment.nominal}${NBSP}${t('live:schematic.gasUnit')}`
      : formatKw(r.equipment.nominal);
  const lastAnomaly = (r: EquipmentRow) =>
    r.lastAnomaly
      ? `${tx(`common:rule.${r.lastAnomaly.rule}`)}, ${formatDayShort(r.lastAnomaly.end)}`
      : t('noAnomaly');

  const columns: { key: EquipmentSortKey; label: string; align?: 'right'; wide?: boolean }[] = [
    { key: 'name', label: t('col.name') },
    { key: 'group', label: t('col.group'), wide: true },
    { key: 'workshop', label: t('col.workshop'), wide: true },
    { key: 'nominal', label: t('col.nominal'), align: 'right', wide: true },
    { key: 'monthActual', label: t('col.month'), align: 'right' },
    { key: 'wastePct', label: t('col.wastePct'), align: 'right' },
    { key: 'health', label: t('col.health') },
    { key: 'lastAnomaly', label: t('col.lastAnomaly'), wide: true },
    { key: 'status', label: t('col.status') },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        meta={
          counts && (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span>{t('summary.total', { count: counts.total })}</span>
              <span className="text-warning-text">
                {t('summary.waste', { count: counts.waste })}
              </span>
              <span className="text-info-text">
                {t('summary.attention', { count: counts.attention })}
              </span>
            </span>
          )
        }
      />

      <div
        role="search"
        aria-label={t('filters.label')}
        className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center"
      >
        <div className="relative xl:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={t('filters.search')}
            aria-label={t('filters.searchLabel')}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:flex xl:flex-1">
          <Select value={group ?? ALL} onValueChange={(v) => set({ group: v })}>
            <SelectTrigger aria-label={t('filters.group')} className="xl:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allGroups')}</SelectItem>
              {(data?.ds.groups ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {tx(`common:group.${g.id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={workshop ?? ALL} onValueChange={(v) => set({ workshop: v })}>
            <SelectTrigger aria-label={t('filters.workshop')} className="xl:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allWorkshops')}</SelectItem>
              {(data?.ds.plant.workshops ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status ?? ALL} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger aria-label={t('filters.status')} className="xl:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allStatuses')}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 xl:justify-end">
          <p className="text-13 text-ink-3" aria-live="polite">
            {list && t('filters.results', { count: list.length })}
          </p>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set({ q: null, group: null, workshop: null, status: null })}
            >
              <X aria-hidden="true" />
              {t('filters.reset')}
            </Button>
          )}
        </div>
      </div>

      {!list ? (
        <TableSkeleton rows={10} cols={7} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={t('empty')}
            body={t('emptyBody')}
            action={{
              label: t('filters.reset'),
              onClick: () => set({ q: null, group: null, workshop: null, status: null }),
            }}
          />
        </Card>
      ) : isMobile ? (
        <ul className="space-y-3" aria-label={t('tableCaption')}>
          {list.map((r) => (
            <li key={r.equipment.id}>
              <Link
                to={`/equipment/${r.equipment.id}`}
                className="card block p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{r.equipment.name}</p>
                    <p className="truncate text-xs text-ink-3">
                      {tx(`common:group.${r.equipment.group}`)} ·{' '}
                      {workshopNames[r.equipment.workshop]}
                    </p>
                  </div>
                  <EquipmentStatusBadge status={r.status} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-3">{t('col.month')}</dt>
                    <dd className="font-semibold tabular-nums text-ink">{monthValue(r)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">{t('col.wastePct')}</dt>
                    <dd
                      className={cn(
                        'font-semibold tabular-nums',
                        r.wastePct >= 10 ? 'text-warning-text' : 'text-ink',
                      )}
                    >
                      {formatPct(r.wastePct, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">{t('col.health')}</dt>
                    <dd>
                      <HealthScore value={r.health} compact />
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 truncate text-xs text-ink-2">
                  {t('col.lastAnomaly')}: {lastAnomaly(r)}
                </p>
              </Link>
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
                  const active = sort === c.key;
                  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <TableHead
                      key={c.key}
                      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn(
                        c.align === 'right' && 'text-right',
                        c.wide && 'hidden xl:table-cell',
                        'first:pl-5',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
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
                    </TableHead>
                  );
                })}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow
                  key={r.equipment.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/equipment/${r.equipment.id}`)}
                >
                  <TableCell className="pl-5">
                    <Link
                      to={`/equipment/${r.equipment.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block font-semibold text-ink hover:text-violet-700"
                    >
                      {r.equipment.code}
                    </Link>
                    {r.equipment.name !== r.equipment.code && (
                      <span className="hidden max-w-[180px] truncate text-xs text-ink-3 xl:block">
                        {r.equipment.name}
                      </span>
                    )}
                    <span className="block max-w-[260px] truncate text-xs text-ink-3 xl:hidden">
                      {tx(`common:group.${r.equipment.group}`)} ·{' '}
                      {workshopNames[r.equipment.workshop]} · {nominal(r)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-ink-2 xl:table-cell">
                    {tx(`common:group.${r.equipment.group}`)}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-ink-2 xl:table-cell">
                    {workshopNames[r.equipment.workshop]}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right xl:table-cell">
                    {nominal(r)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">{monthValue(r)}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-bg-subtle ring-1 ring-inset ring-border 2xl:block">
                        <span
                          className="block h-full rounded-full bg-warning"
                          style={{ width: `${Math.min(100, r.wastePct * 2)}%` }}
                        />
                      </span>
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          r.wastePct >= 10 && 'text-warning-text',
                        )}
                      >
                        {formatPct(r.wastePct, 1)}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <HealthScore value={r.health} compact />
                  </TableCell>
                  <TableCell className="hidden max-w-[190px] text-13 text-ink-2 xl:table-cell">
                    {r.lastAnomaly ? (
                      <>
                        <span className="block truncate">
                          {tx(`common:rule.${r.lastAnomaly.rule}`)}
                        </span>
                        <span className="block text-xs text-ink-3">
                          {formatDayShort(r.lastAnomaly.end)}
                        </span>
                      </>
                    ) : (
                      t('noAnomaly')
                    )}
                  </TableCell>
                  <TableCell>
                    <EquipmentStatusBadge status={r.status} />
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
    </>
  );
}
