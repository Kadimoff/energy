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
import type { MvChartPoint } from '@/domain/analytics/mvView';
import { formatCompact, formatDate, formatDayShort, formatKwh } from '@/lib/format';
import { ChartFrame, ChartTooltipBox } from './ChartFrame';
import { axisTick, swatch } from './chartStyle';

export interface MvBaselineLabels {
  title: string;
  summary: string;
  date: string;
  period: string;
  baselinePeriod: string;
  reportingPeriod: string;
  actual: string;
  fitted: string;
  adjusted: string;
  avoided: string;
  implemented: string;
  perDay: string;
}

/**
 * Baseline period (model fit) and reporting period (adjusted baseline vs
 * actual). The area between the adjusted baseline and a lower actual is
 * the avoided energy (IPMVP).
 */
export function MvBaselineChart({
  points,
  implementedAt,
  labels,
  toolbar,
  height = 300,
}: {
  points: MvChartPoint[];
  implementedAt: number;
  labels: MvBaselineLabels;
  toolbar?: React.ReactNode;
  height?: number;
}) {
  const rows = points.map((p) => ({
    ...p,
    baseModel: p.period === 'baseline' ? p.model : null,
    adjModel: p.period === 'reporting' ? p.model : null,
  }));
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={height}
      toolbar={toolbar}
      legend={[
        { key: 'a', label: labels.actual, swatch: swatch.line('var(--text)') },
        { key: 'f', label: labels.fitted, swatch: swatch.line('var(--violet-400)') },
        { key: 'j', label: labels.adjusted, swatch: swatch.line('var(--violet-600)', true) },
        { key: 'v', label: labels.avoided, swatch: swatch.box('var(--success)', 0.35) },
        { key: 'i', label: labels.implemented, swatch: swatch.dotted('var(--text-3)') },
      ]}
      table={{
        columns: [
          { key: 'd', label: labels.date },
          { key: 'p', label: labels.period },
          { key: 'a', label: labels.actual, align: 'right' },
          { key: 'm', label: `${labels.fitted} / ${labels.adjusted}`, align: 'right' },
        ],
        rows: points.map((p) => ({
          id: `${p.period}-${p.t}`,
          cells: {
            d: formatDate(p.t),
            p: p.period === 'baseline' ? labels.baselinePeriod : labels.reportingPeriod,
            a: formatKwh(p.actual),
            m: formatKwh(p.model),
          },
        })),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
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
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: 'var(--violet-300)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as MvChartPoint;
              return (
                <ChartTooltipBox
                  title={`${formatDate(r.t)} · ${
                    r.period === 'baseline' ? labels.baselinePeriod : labels.reportingPeriod
                  }`}
                  rows={[
                    { label: `${labels.actual}, ${labels.perDay}`, value: formatKwh(r.actual) },
                    {
                      label: `${r.period === 'baseline' ? labels.fitted : labels.adjusted}, ${labels.perDay}`,
                      value: formatKwh(r.model),
                      tone: 'violet',
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            dataKey="avoided"
            type="monotone"
            stroke="none"
            fill="var(--success)"
            fillOpacity={0.28}
            isAnimationActive={false}
            activeDot={false}
            connectNulls={false}
          />
          <ReferenceLine
            x={implementedAt}
            stroke="var(--text-3)"
            strokeDasharray="2 4"
            label={{
              value: labels.implemented,
              position: 'top',
              fill: 'var(--text-2)',
              fontSize: 12,
            }}
          />
          <Line
            dataKey="baseModel"
            type="monotone"
            stroke="var(--violet-400)"
            strokeWidth={1.75}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="adjModel"
            type="monotone"
            stroke="var(--violet-600)"
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            type="monotone"
            stroke="var(--text)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
