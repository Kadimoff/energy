import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FanPoint } from '@/domain/analytics/forecastView';
import { formatAzn, formatCompact, formatDate, formatDayShort } from '@/lib/format';
import { ChartFrame, ChartTooltipBox } from './ChartFrame';
import { axisTick, swatch } from './chartStyle';

export interface FanChartLabels {
  title: string;
  summary: string;
  date: string;
  actual: string;
  mean: string;
  p10p90: string;
  p25p75: string;
  p10: string;
  p90: string;
  budget: string;
  budgetPace: string;
}

interface Row extends FanPoint {
  band90: [number, number] | null;
  band50: [number, number] | null;
}

/**
 * Cumulative cost forecast fan (spec 5.4 / 7.8): measured cost so far, mean
 * forecast (dashed violet), P25–P75 and P10–P90 bands, budget line.
 */
export function FanChart({
  points,
  labels,
  height = 320,
}: {
  points: FanPoint[];
  labels: FanChartLabels;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const rows: Row[] = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        band90: p.p10 !== null && p.p90 !== null ? [p.p10, p.p90] : null,
        band50: p.p25 !== null && p.p75 !== null ? [p.p25, p.p75] : null,
      })),
    [points],
  );
  const budget = points[0]?.budget ?? 0;
  const max = Math.max(budget, ...points.map((p) => p.p90 ?? p.actual ?? 0));
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={height}
      legend={[
        { key: 'a', label: labels.actual, swatch: swatch.line('var(--text)') },
        { key: 'm', label: labels.mean, swatch: swatch.line('var(--violet-600)', true) },
        { key: 'b50', label: labels.p25p75, swatch: swatch.box('var(--violet-400)', 0.45) },
        { key: 'b90', label: labels.p10p90, swatch: swatch.box('var(--violet-400)', 0.2) },
        { key: 'bud', label: labels.budget, swatch: swatch.dotted('var(--danger)') },
        { key: 'pace', label: labels.budgetPace, swatch: swatch.dotted('var(--text-3)') },
      ]}
      table={{
        columns: [
          { key: 'd', label: labels.date },
          { key: 'a', label: labels.actual, align: 'right' },
          { key: 'p10', label: labels.p10, align: 'right' },
          { key: 'm', label: labels.mean, align: 'right' },
          { key: 'p90', label: labels.p90, align: 'right' },
          { key: 'b', label: labels.budgetPace, align: 'right' },
        ],
        rows: points.map((p) => ({
          id: p.t,
          cells: {
            d: formatDate(p.t),
            a: p.actual !== null ? formatAzn(p.actual) : '–',
            p10: p.p10 !== null ? formatAzn(p.p10) : '–',
            m: p.mean !== null ? formatAzn(p.mean) : '–',
            p90: p.p90 !== null ? formatAzn(p.p90) : '–',
            b: formatAzn(p.budgetPace),
          },
        })),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => formatDayShort(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-strong)' }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={[0, Math.ceil((max * 1.06) / 1000) * 1000]}
          />
          <Tooltip
            cursor={{ stroke: 'var(--violet-300)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Row;
              return (
                <ChartTooltipBox
                  title={formatDate(r.t)}
                  rows={[
                    ...(r.actual !== null && !(r.isFuture && r.mean !== null)
                      ? [{ label: labels.actual, value: formatAzn(r.actual) }]
                      : []),
                    ...(r.mean !== null && r.isFuture
                      ? [
                          { label: labels.mean, value: formatAzn(r.mean), tone: 'violet' as const },
                          {
                            label: labels.p10,
                            value: formatAzn(r.p10 ?? 0),
                            tone: 'muted' as const,
                          },
                          {
                            label: labels.p90,
                            value: formatAzn(r.p90 ?? 0),
                            tone: 'muted' as const,
                          },
                        ]
                      : []),
                    { label: labels.budgetPace, value: formatAzn(r.budgetPace), tone: 'muted' },
                    { label: labels.budget, value: formatAzn(r.budget), tone: 'danger' },
                  ]}
                />
              );
            }}
          />
          <Area
            dataKey="band90"
            type="monotone"
            stroke="none"
            fill="var(--violet-400)"
            fillOpacity={0.16}
            isAnimationActive={false}
            activeDot={false}
            connectNulls={false}
          />
          <Area
            dataKey="band50"
            type="monotone"
            stroke="none"
            fill="var(--violet-400)"
            fillOpacity={0.3}
            isAnimationActive={false}
            activeDot={false}
            connectNulls={false}
          />
          <ReferenceLine
            y={budget}
            stroke="var(--danger)"
            strokeWidth={1.5}
            strokeDasharray="2 4"
            ifOverflow="extendDomain"
            label={{
              value: labels.budget,
              position: 'insideTopLeft',
              fill: 'var(--danger-text)',
              fontSize: 12,
            }}
          />
          <Line
            dataKey="budgetPace"
            type="linear"
            stroke="var(--text-3)"
            strokeWidth={1}
            strokeDasharray="2 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="mean"
            type="monotone"
            stroke="var(--violet-600)"
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={false}
            activeDot={{ r: 3.5, fill: 'var(--violet-600)', stroke: 'var(--surface)' }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            type="monotone"
            stroke="var(--text)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--text)', stroke: 'var(--surface)', strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={!reduce}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
