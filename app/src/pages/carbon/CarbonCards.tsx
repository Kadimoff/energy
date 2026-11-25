import { ArrowRight, ExternalLink, Flame, Settings2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { WaterfallChart } from '@/components/charts/analytics/WaterfallChart';
import { Badge } from '@/components/ui/badge';
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
import { baseConfig } from '@/data/config';
import type { CarbonSource, FactorRow, reductionRoadmap } from '@/domain/analytics/carbonView';
import { useT } from '@/i18n';
import {
  formatDate,
  formatEnergy,
  formatM3,
  formatNumber,
  formatShare,
  formatSigned,
  formatTCo2,
  NBSP,
  UNITS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { FactorNote, FactorTooltip } from './FactorNote';
import { factorText } from './hooks';

const groupColor = Object.fromEntries(baseConfig.groups.map((g) => [g.id, g.color]));

/** Emissions by source (electricity groups = Scope 2, gas users = Scope 1). */
export function SourcesCard({ sources, year }: { sources: CarbonSource[]; year: number }) {
  const { t, tx } = useT('carbon');
  const max = Math.max(...sources.map((s) => s.tCo2), 1);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>{t('sources.title')}</CardTitle>
          <CardDescription>{t('sources.subtitle', { year })}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul aria-label={t('sources.aria')} className="space-y-3">
          {sources.map((s) => (
            <li key={s.group}>
              <div className="flex items-baseline justify-between gap-2 text-13">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
                  {s.scope === 1 ? (
                    <Flame
                      className="size-3.5 shrink-0 text-ink-3"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : (
                    <Zap
                      className="size-3.5 shrink-0 text-ink-3"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{tx(`common:group.${s.group}`)}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {t('sources.scope', { n: s.scope })}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                  <span className="font-semibold text-ink">{formatTCo2(s.tCo2, 0)}</span>
                  <span className="ml-1 text-xs text-ink-3">{formatShare(s.share)}</span>
                  <FactorTooltip kind={s.scope === 1 ? 'scope1' : 'scope2'} />
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-bg-subtle" aria-hidden="true">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(s.tCo2 / max) * 100}%`, background: groupColor[s.group] }}
                />
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-ink-3">
                {s.energy === 'gas' ? formatM3(s.amount) : formatEnergy(s.amount)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type Roadmap = ReturnType<typeof reductionRoadmap>;

/** Reduction roadmap waterfall: current → each recommendation → target (spec 7.9). */
export function RoadmapCard({
  roadmap,
  period,
}: {
  roadmap: Roadmap;
  period: { from: number; to: number };
}) {
  const { t, tx } = useT('carbon');
  const label = (id: string) =>
    id === 'start'
      ? t('roadmap.start', {
          from: formatDate(period.from),
          to: formatDate(period.to - 1),
        })
      : id === 'result'
        ? t('roadmap.result')
        : id === 'target'
          ? t('roadmap.target')
          : tx(`common:rec.title.${id}`);
  const rows = roadmap.steps.map((s) => ({
    id: s.id,
    kind: s.kind,
    from: s.from,
    to: s.to,
    label: label(s.id),
    meta:
      s.kind === 'step' && s.status ? (
        <Badge
          variant={s.status === 'proposed' ? 'neutral' : 'violet'}
          className="px-1.5 py-0 text-[11px]"
        >
          {tx(`common:recStatus.${s.status}`)}
        </Badge>
      ) : undefined,
    valueText:
      s.kind === 'step' ? formatSigned(s.value, (v) => formatTCo2(v, 0)) : formatTCo2(s.value, 0),
  }));
  const reachable = roadmap.gapT <= 0;
  return (
    <Card>
      <CardHeader className="flex-col sm:flex-row">
        <div>
          <CardTitle className="flex items-center gap-2">
            {t('roadmap.title')}
            <AiBadge variant="soft" />
          </CardTitle>
          <CardDescription>{t('roadmap.subtitle')}</CardDescription>
        </div>
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <Link to="/decisions">
            {t('roadmap.openDecisions')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            'mb-4 inline-flex flex-wrap gap-x-2 rounded-sm px-2.5 py-1.5 text-13 font-medium',
            reachable
              ? 'bg-success-surface text-success-text'
              : 'bg-warning-surface text-warning-text',
          )}
        >
          <span>
            {reachable
              ? t('roadmap.reachable', { value: formatTCo2(-roadmap.gapT, 0) })
              : t('roadmap.gap', { value: formatTCo2(roadmap.gapT, 0) })}
          </span>
          <span className="font-normal">
            {t('roadmap.totalReduction', { value: formatTCo2(roadmap.reductionT, 0) })}
          </span>
        </p>
        <WaterfallChart
          rows={rows}
          min={roadmap.axisMin}
          max={roadmap.axisMax}
          minText={formatTCo2(roadmap.axisMin, 0)}
          maxText={formatTCo2(roadmap.axisMax, 0)}
          labels={{
            title: t('roadmap.title'),
            summary: t('roadmap.summary', {
              current: formatTCo2(roadmap.steps[0].value, 0),
              after: formatTCo2(roadmap.afterT, 0),
              target: formatTCo2(roadmap.targetT, 0),
            }),
            level: t('roadmap.level'),
            reduction: t('roadmap.reduction'),
            target: t('roadmap.target'),
            axisNote:
              roadmap.axisMin > 0
                ? t('roadmap.axisNote', { value: formatTCo2(roadmap.axisMin, 0) })
                : undefined,
          }}
          table={{
            columns: [
              { key: 's', label: t('roadmap.step') },
              { key: 'st', label: t('roadmap.status') },
              { key: 'c', label: t('roadmap.change'), align: 'right' },
              { key: 'l', label: t('roadmap.levelAfter'), align: 'right' },
            ],
            rows: roadmap.steps.map((s) => ({
              id: s.id,
              cells: {
                s: label(s.id),
                st: s.status ? tx(`common:recStatus.${s.status}`) : '–',
                c: s.kind === 'step' ? formatSigned(s.value, (v) => formatTCo2(v, 1)) : '–',
                l: formatTCo2(s.to, 0),
              },
            })),
          }}
        />
        <FactorNote kinds={['scope1', 'scope2']} short className="mt-3 text-xs" />
      </CardContent>
    </Card>
  );
}

function factorValue(r: FactorRow) {
  switch (r.id) {
    case 'scope1':
    case 'scope2':
      return factorText(r.value);
    case 'gasKwhPerM3':
      return `${formatNumber(r.value, 1)}${NBSP}${UNITS.kwh}/${UNITS.m3}`;
    case 'euEtsPrice':
      return `${formatNumber(r.value, 0)}${NBSP}avro/t${NBSP}CO₂`;
    case 'eurToAzn':
      return `1 avro = ${formatNumber(r.value, 2)}${NBSP}AZN`;
  }
}

/** Emission factors with source, date and a link to Settings (spec 7.9, 11). */
export function FactorsTable({ rows }: { rows: FactorRow[] }) {
  const { t, tx } = useT('carbon');
  return (
    <Card>
      <CardHeader className="flex-col sm:flex-row">
        <div>
          <CardTitle>{t('factors.title')}</CardTitle>
          <CardDescription>{t('factors.subtitle')}</CardDescription>
        </div>
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <Link to="/settings">
            <Settings2 aria-hidden="true" />
            {t('factors.edit')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0 sm:px-0">
        <ul className="divide-y divide-border border-t border-border md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1.5 px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-ink">{tx(`factor.${r.id}`)}</p>
                <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
                  {factorValue(r)}
                </p>
              </div>
              {r.overridden && (
                <p className="text-xs text-info-text">
                  {t('factors.overridden', {
                    value:
                      r.id === 'scope1' || r.id === 'scope2'
                        ? factorText(r.defaultValue)
                        : formatNumber(r.defaultValue, 2),
                  })}
                </p>
              )}
              <p className="text-13 text-ink-2">{r.source}</p>
              <p className="text-xs text-ink-3">
                {t('factors.date')}: {r.date ?? '–'} · {t('factors.lastChecked')}:{' '}
                {r.lastChecked ? formatDate(new Date(r.lastChecked)) : '–'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {r.verify && <Badge variant="warning">{t('factors.verify')}</Badge>}
                <Button asChild size="sm" variant="link">
                  <Link to="/settings">{t('factors.edit')}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Table className="hidden md:table">
          <caption className="sr-only">{t('factors.title')}</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 sm:pl-6">{t('factors.name')}</TableHead>
              <TableHead className="text-right">{t('factors.value')}</TableHead>
              <TableHead>{t('factors.source')}</TableHead>
              <TableHead>{t('factors.date')}</TableHead>
              <TableHead>{t('factors.lastChecked')}</TableHead>
              <TableHead className="pr-5 sm:pr-6">
                <span className="sr-only">{t('factors.edit')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-5 align-top font-medium sm:pl-6">
                  {tx(`factor.${r.id}`)}
                  {r.overridden && (
                    <span className="mt-0.5 block text-xs font-normal text-info-text">
                      {t('factors.overridden', {
                        value:
                          r.id === 'scope1' || r.id === 'scope2'
                            ? factorText(r.defaultValue)
                            : formatNumber(r.defaultValue, 2),
                      })}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right align-top font-semibold">
                  {factorValue(r)}
                </TableCell>
                <TableCell className="min-w-[240px] max-w-[420px] align-top text-13 text-ink-2">
                  {r.source}
                  {r.basis && <span className="block text-xs text-ink-3">{r.basis}</span>}
                  {r.verify && (
                    <Badge variant="warning" className="mt-1">
                      {t('factors.verify')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top text-13 text-ink-2">
                  {r.date ?? '–'}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top text-13 text-ink-2">
                  {r.lastChecked ? formatDate(new Date(r.lastChecked)) : '–'}
                </TableCell>
                <TableCell className="whitespace-nowrap pr-5 align-top sm:pr-6">
                  <div className="flex justify-end gap-1">
                    {r.sourceUrl && (
                      <Button asChild size="icon-sm" variant="ghost">
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`${t('factors.openSource')}: ${tx(`factor.${r.id}`)}`}
                        >
                          <ExternalLink aria-hidden="true" />
                        </a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="link">
                      <Link to="/settings">{t('factors.edit')}</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
