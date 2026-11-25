import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CumulativeMeasurePoint } from '@/domain/analytics/mvView';
import {
  formatAzn,
  formatCompact,
  formatMonthShort,
  formatMonthYear,
  formatMwh,
} from '@/lib/format';
import { ChartFrame, ChartTooltipBox } from './ChartFrame';
import { swatch, axisTick } from './chartStyle';

export interface CumulativeSavingsLabels {
  title: string;
  summary: string;
  month: string;
  total: string;
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-4)',
  'var(--chart-3)',
  'var(--chart-5)',
  'var(--chart-2)',
];

/**
 * Cumulative avoided energy (M&V, spec 7.10) stacked per measure, in AZN or
 * MVt·saat. Preliminary measures (still in the minimum reporting period)
 * are drawn lighter and marked in the legend.
 */
export function CumulativeSavingsChart({
  points,
  measures,
  unit,
  labels,
  toolbar,
  height = 280,
}: {
  points: CumulativeMeasurePoint[];
  measures: { id: string; label: string; preliminary: boolean }[];
  unit: 'azn' | 'mwh';
  labels: CumulativeSavingsLabels;
  toolbar?: React.ReactNode;
  height?: number;
}) {
  const fmt = unit === 'azn' ? (v: number) => formatAzn(v) : (v: number) => formatMwh(v, 1);
  const val = (p: CumulativeMeasurePoint, id: string) =>
    unit === 'azn' ? p.byMeasureAzn[id] : p.byMeasure[id];
  const rows = points.map((p) => ({
    t: p.start,
    total: unit === 'azn' ? p.totalAzn : p.totalKwh,
    ...Object.fromEntries(
      measures.map((m) => [m.id, unit === 'azn' ? p.byMeasureAzn[m.id] : p.byMeasure[m.id] / 1000]),
    ),
  }));
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={height}
      toolbar={toolbar}
      legend={measures.map((m, i) => ({
        key: m.id,
        label: m.label,
        swatch: swatch.box(COLORS[i % COLORS.length], m.preliminary ? 0.35 : 0.75),
      }))}
      table={{
        columns: [
          { key: 'm', label: labels.month },
          ...measures.map((m) => ({ key: m.id, label: m.label, align: 'right' as const })),
          { key: 't', label: labels.total, align: 'right' },
        ],
        rows: points.map((p) => ({
          id: p.key,
          cells: {
            m: formatMonthYear(p.start),
            ...Object.fromEntries(measures.map((m) => [m.id, fmt(val(p, m.id))])),
            t: fmt(unit === 'azn' ? p.totalAzn : p.totalKwh),
          },
        })),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="category"
            tickFormatter={(v: number) => formatMonthShort(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-strong)' }}
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
              const t = (payload[0].payload as { t: number }).t;
              const p = points.find((x) => x.start === t);
              if (!p) return null;
              return (
                <ChartTooltipBox
                  title={formatMonthYear(t)}
                  rows={[
                    ...measures.map((m) => ({
                      label: m.label,
                      value: fmt(val(p, m.id)),
                      tone: 'muted' as const,
                    })),
                    {
                      label: labels.total,
                      value: fmt(unit === 'azn' ? p.totalAzn : p.totalKwh),
                      tone: 'success' as const,
                    },
                  ]}
                />
              );
            }}
          />
          {measures.map((m, i) => (
            <Area
              key={m.id}
              dataKey={m.id}
              stackId="s"
              type="monotone"
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={m.preliminary ? 0.18 : 0.4}
              strokeDasharray={m.preliminary ? '4 3' : undefined}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
