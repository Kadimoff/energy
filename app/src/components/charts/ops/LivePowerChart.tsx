import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LivePowerSeries } from '@/domain/ops';
import { useT } from '@/i18n';
import { formatCompact, formatKw, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ViewAsTableButton } from './status';

export interface LivePowerChartProps {
  series: LivePowerSeries;
  height?: number;
  className?: string;
}

/** Last-60-minute total electric power with the peak limit line (spec 7.4). */
export function LivePowerChart({ series, height = 240, className }: LivePowerChartProps) {
  const { t } = useT('live');
  const [asTable, setAsTable] = useState(false);
  const { points, peakLimitKw } = series;
  const top = Math.max(peakLimitKw * 1.08, series.maxKw * 1.05);
  const aria = t('chart.aria', {
    current: formatKw(series.currentKw),
    max: formatKw(series.maxKw),
    limit: formatKw(peakLimitKw),
  });
  // one row per minute in the table (the stream adds a point every 5 s)
  const tableRows = points.filter(
    (p, i) =>
      i === points.length - 1 || Math.floor(p.t / 60_000) !== Math.floor(points[i + 1].t / 60_000),
  );
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2"
          aria-label={t('common:chart.legend')}
        >
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-4 rounded bg-ink" />
            {t('chart.power')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-danger" />
            {t('chart.limit')} {formatKw(peakLimitKw)}
          </li>
          <li className="tabular-nums text-ink-3">
            {t('chart.max', { value: formatKw(series.maxKw), time: formatTime(series.maxT) })}
          </li>
        </ul>
        <ViewAsTableButton asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
      </div>
      {asTable ? (
        <div className="max-h-[320px] overflow-auto rounded-md border border-border">
          <Table>
            <caption className="sr-only">{t('chart.caption')}</caption>
            <TableHeader className="sticky top-0 bg-surface">
              <TableRow>
                <TableHead>{t('common:chart.time')}</TableHead>
                <TableHead className="text-right">{t('chart.power')}</TableHead>
                <TableHead className="text-right">{t('chart.limit')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...tableRows].reverse().map((p) => (
                <TableRow key={p.t}>
                  <TableCell>{formatTime(p.t)}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right',
                      p.kw > peakLimitKw && 'font-semibold text-danger-text',
                    )}
                  >
                    {formatKw(p.kw)}
                  </TableCell>
                  <TableCell className="text-right text-ink-2">{formatKw(peakLimitKw)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div role="img" aria-label={aria} className="m-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => formatTime(v)}
                tick={{ fontSize: 12, fill: 'var(--text-3)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-strong)' }}
                minTickGap={36}
              />
              <YAxis
                domain={[0, Math.ceil(top / 100) * 100]}
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 12, fill: 'var(--text-3)' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: 'var(--violet-300)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { t: number; kw: number };
                  return (
                    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-ink">{formatTime(p.t)}</p>
                      <p className="tabular-nums text-ink-2">
                        {t('chart.power')}:{' '}
                        <span className="font-semibold text-ink">{formatKw(p.kw)}</span>
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                y={peakLimitKw}
                stroke="var(--danger)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
              />
              <Line
                dataKey="kw"
                type="monotone"
                stroke="var(--text)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--text)', stroke: 'var(--surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
