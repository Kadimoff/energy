import { ChevronRight, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { MvBaselineChart } from '@/components/charts/analytics/MvBaselineChart';
import { ChartSkeleton } from '@/components/common/Skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { measureValues } from '@/domain/analytics/mvView';
import type { MeasureResult } from '@/domain/mv';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDate,
  formatDateRange,
  formatEnergy,
  formatNumber,
  formatPct,
  formatSigned,
  formatTCo2,
  formatTemp,
  formatTons,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMeasureDetail } from './hooks';
import { MvStatusBadge, Scope2Tooltip } from './MvOverview';

type Values = ReturnType<typeof measureValues>;

/** Implemented measures: expected vs verified, CI, method, status (spec 7.10). */
export function MeasuresTable({
  rows,
  equipment,
  selected,
  onSelect,
}: {
  rows: { result: MeasureResult; values: Values }[];
  equipment: Record<string, string>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, tx } = useT('mv');
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('table.title')}</CardTitle>
          <CardDescription>{t('table.subtitle')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-0">
        <Table>
          <caption className="sr-only">{t('table.title')}</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 sm:pl-6">{t('table.measure')}</TableHead>
              <TableHead>{t('table.implemented')}</TableHead>
              <TableHead>{t('table.method')}</TableHead>
              <TableHead className="text-right">{t('table.expected')}</TableHead>
              <TableHead className="text-right">{t('table.verified')}</TableHead>
              <TableHead className="text-right">{t('table.ci')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead className="pr-5 sm:pr-6">
                <span className="sr-only">{t('table.details')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ result: r, values: v }) => {
              const name = tx(`common:measure.${r.id}`);
              const isSel = selected === r.id;
              return (
                <TableRow
                  key={r.id}
                  className={cn(isSel && 'bg-violet-50/70 hover:bg-violet-50')}
                  aria-selected={isSel}
                >
                  <TableCell className="min-w-[220px] pl-5 sm:pl-6">
                    <p className="font-medium text-ink">{name}</p>
                    <p className="text-xs text-ink-3">
                      {r.equipmentIds.map((id) => equipment[id] ?? id).join(', ')}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-2">
                    {formatDate(r.implementedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-2">
                    {t('table.option', { value: r.method })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <span className="block">{formatEnergy(r.expectedKwh)}</span>
                    <span className="text-xs text-ink-3">
                      {t('table.pct', { value: formatPct(r.expectedSavingPct, 0) })}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <span className="block font-semibold">{formatEnergy(r.avoidedKwh)}</span>
                    <span className="text-xs text-ink-3">
                      {t('table.pct', { value: formatPct(r.savingPct, 1) })} ·{' '}
                      {formatAzn(v.avoidedAzn)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-ink-2">
                    {t('table.ciValue', { value: formatEnergy(r.ciKwh) })}
                  </TableCell>
                  <TableCell>
                    <MvStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="pr-5 sm:pr-6">
                    <Button
                      size="sm"
                      variant={isSel ? 'subtle' : 'ghost'}
                      aria-pressed={isSel}
                      aria-label={t('table.detailsAria', { name })}
                      onClick={() => onSelect(r.id)}
                    >
                      {t('table.details')}
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</dd>
      {sub && <dd className="text-xs tabular-nums text-ink-3">{sub}</dd>}
    </div>
  );
}

/** Measure detail: periods, adjusted baseline vs actual, adjustments, model quality. */
export function MeasureDetail({
  id,
  equipment,
  cvLimit,
}: {
  id: string;
  equipment: Record<string, string>;
  cvLimit: number;
}) {
  const { t, tx } = useT('mv');
  const [method, setMethod] = useState<'B' | 'C'>('B');
  const [resolution, setResolution] = useState<'day' | 'week'>('week');
  const d = useMeasureDetail(id, method, resolution);
  if (!d) return <ChartSkeleton height={360} />;
  const { result: r, values: v, explain: x } = d;
  const name = tx(`common:measure.${r.id}`);
  const q = r.model;
  const up = x.routineAdjustmentKwh >= 0;
  return (
    <Card
      id="measure-detail"
      role="region"
      aria-label={t('detail.aria')}
      tabIndex={-1}
      className="outline-none"
    >
      <CardHeader className="flex-col gap-3 lg:flex-row">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{name}</CardTitle>
            <MvStatusBadge status={r.status} />
          </div>
          <CardDescription>
            {t('detail.equipment', {
              list: d.def.equipmentIds.map((e) => equipment[e] ?? e).join(', '),
            })}
            {' · '}
            {r.investmentAzn > 0
              ? t('detail.investment', { value: formatAzn(r.investmentAzn) })
              : t('detail.noInvestment')}
          </CardDescription>
        </div>
        <Tabs value={method} onValueChange={(m) => setMethod(m as 'B' | 'C')} className="shrink-0">
          <TabsList aria-label={t('detail.optionLabel')}>
            <TabsTrigger value="B">{t('detail.optionB')}</TabsTrigger>
            <TabsTrigger value="C">{t('detail.optionC')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid grid-cols-1 gap-4 rounded-md border border-border bg-bg-subtle p-4 sm:grid-cols-2">
          <Fact
            label={t('detail.baselinePeriod')}
            value={t('detail.periodValue', {
              range: formatDateRange(r.baselineFrom, r.baselineTo - 1),
              days: r.baselineDays,
            })}
          />
          <Fact
            label={t('detail.reportingPeriod')}
            value={t('detail.periodValue', {
              range: formatDateRange(r.reportFrom, r.reportTo - 1),
              days: r.reportDays,
            })}
            sub={t('detail.settle', { days: d.settleDays })}
          />
        </dl>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <MvBaselineChart
              points={d.series}
              implementedAt={r.implementedAt}
              toolbar={
                <Tabs value={resolution} onValueChange={(v) => setResolution(v as 'day' | 'week')}>
                  <TabsList aria-label={t('detail.chart.title')}>
                    <TabsTrigger value="week">{t('detail.chart.weekly')}</TabsTrigger>
                    <TabsTrigger value="day">{t('detail.chart.daily')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
              labels={{
                title: t('detail.chart.title'),
                summary: t('detail.chart.summary', {
                  adjusted: formatEnergy(r.adjustedBaselineKwh),
                  actual: formatEnergy(r.actualKwh),
                  avoided: formatEnergy(r.avoidedKwh),
                }),
                date: t('detail.chart.date'),
                period: t('detail.chart.period'),
                baselinePeriod: t('detail.baselinePeriod'),
                reportingPeriod: t('detail.reportingPeriod'),
                actual: t('detail.chart.actual'),
                fitted: t('detail.chart.fitted'),
                adjusted: t('detail.chart.adjusted'),
                avoided: t('detail.chart.avoided'),
                implemented: t('detail.chart.implemented'),
                perDay: t('detail.chart.perDay'),
              }}
            />
          </div>
          <div className="space-y-4">
            <section aria-labelledby="mv-result" className="rounded-md border border-border p-4">
              <h3 id="mv-result" className="text-sm font-semibold text-ink">
                {t('detail.result.title')}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-4">
                <Fact
                  label={t('detail.result.avoided')}
                  value={formatEnergy(r.avoidedKwh)}
                  sub={t('detail.result.range', {
                    low: formatEnergy(v.ciLowKwh),
                    high: formatEnergy(v.ciHighKwh),
                  })}
                />
                <Fact
                  label={t('detail.result.saving')}
                  value={formatPct(r.savingPct, 1)}
                  sub={t('detail.result.achieved', { value: formatPct(v.achievedPct, 0) })}
                />
                <Fact
                  label={t('detail.result.money')}
                  value={formatAzn(v.avoidedAzn)}
                  sub={`${t('detail.result.perMonth')}: ${formatAzn(v.perMonthAzn)}`}
                />
                <div className="min-w-0">
                  <dt className="inline-flex items-center gap-0.5 text-xs text-ink-3">
                    {t('detail.result.co2')}
                    <Scope2Tooltip />
                  </dt>
                  <dd className="text-base font-semibold tabular-nums text-ink">
                    {formatTCo2(v.avoidedTCo2, 1)}
                  </dd>
                </div>
              </dl>
              {!x.significant && (
                <p className="mt-3 flex gap-1.5 rounded-sm bg-warning-surface px-2 py-1.5 text-xs text-warning-text">
                  <TriangleAlert
                    className="mt-0.5 size-3.5 shrink-0"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {t('detail.result.notSignificant')}
                </p>
              )}
            </section>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="mv-adjust" className="rounded-md border border-border p-4">
            <h3 id="mv-adjust" className="text-sm font-semibold text-ink">
              {t('detail.adjust.title')}
            </h3>
            <dl className="mt-3 space-y-2 text-13">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-ink-2">{t('detail.adjust.production')}</dt>
                <dd className="tabular-nums text-ink sm:text-right">
                  {t('detail.adjust.productionValue', {
                    pct: formatSigned(x.productionPct, (p) => formatPct(p, 1)),
                    from: formatTons(x.baselineTonsPerDay, 1),
                    to: formatTons(x.reportTonsPerDay, 1),
                  })}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-ink-2">{t('detail.adjust.weather')}</dt>
                <dd className="tabular-nums text-ink sm:text-right">
                  {t('detail.adjust.weatherValue', {
                    delta: formatSigned(x.tempDeltaC, (c) => formatTemp(c, 1)),
                    from: formatTemp(x.baselineMeanTempC, 1),
                    to: formatTemp(x.reportMeanTempC, 1),
                  })}
                </dd>
              </div>
            </dl>
            <dl className="mt-4 divide-y divide-border rounded-md border border-border text-13">
              {[
                [t('detail.adjust.unadjusted'), formatEnergy(x.unadjustedBaselineKwh), ''],
                [
                  t('detail.adjust.routine'),
                  formatSigned(x.routineAdjustmentKwh, (k) => formatEnergy(k)),
                  '',
                ],
                [t('detail.chart.adjusted'), formatEnergy(x.adjustedBaselineKwh), 'font-semibold'],
                [t('detail.chart.actual'), formatEnergy(x.actualKwh), ''],
                [t('detail.adjust.naive'), formatEnergy(x.naiveSavingKwh), 'text-ink-2'],
                [
                  t('detail.adjust.avoided'),
                  formatEnergy(x.avoidedKwh),
                  'font-semibold text-success-text',
                ],
              ].map(([k, val, cls]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className={cn('whitespace-nowrap tabular-nums text-ink', cls)}>{val}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-13 text-ink-2">
              {t(up ? 'detail.adjust.conclusionUp' : 'detail.adjust.conclusionDown', {
                routine: formatEnergy(Math.abs(x.routineAdjustmentKwh)),
                naive: formatEnergy(x.naiveSavingKwh),
                avoided: formatEnergy(x.avoidedKwh),
              })}
            </p>
          </section>

          <section aria-labelledby="mv-model" className="rounded-md border border-border p-4">
            <h3 id="mv-model" className="text-sm font-semibold text-ink">
              {t('detail.model.title')}
            </h3>
            <dl className="mt-3 grid grid-cols-3 gap-4">
              <Fact label={t('detail.model.r2')} value={formatNumber(q.r2, 3)} />
              <Fact label={t('detail.model.cv')} value={formatPct(q.cvRmsePct, 1)} />
              <Fact label={t('detail.model.n')} value={t('detail.model.nValue', { value: q.n })} />
            </dl>
            <p className="mt-3 break-words rounded-sm bg-bg-subtle px-2 py-1.5 font-mono text-xs text-ink-2">
              {t('detail.model.equation', {
                a: formatNumber(q.coef.a, 0),
                b: formatNumber(q.coef.b, 2),
                c: formatNumber(q.coef.c, 2),
                d: formatNumber(q.coef.d, 2),
                e: formatNumber(q.coef.e, 2),
              })}
            </p>
            <p
              className={cn(
                'mt-3 flex gap-1.5 rounded-sm px-2 py-1.5 text-xs',
                q.lowReliability
                  ? 'bg-warning-surface text-warning-text'
                  : 'bg-success-surface text-success-text',
              )}
            >
              {q.lowReliability && (
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
              {q.lowReliability
                ? t('detail.model.low', { limit: formatPct(cvLimit) })
                : t('detail.model.good', { limit: formatPct(cvLimit) })}
            </p>
            {method === 'C' && (
              <p className="mt-3 text-xs text-ink-2">{t('detail.model.optionCNote')}</p>
            )}
            {r.optionCUnsuitable && (
              <p className="mt-2 flex gap-1.5 rounded-sm bg-info-surface px-2 py-1.5 text-xs text-info-text">
                {t('detail.model.boundaryLow', { value: formatPct(r.boundarySharePct, 1) })}
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
