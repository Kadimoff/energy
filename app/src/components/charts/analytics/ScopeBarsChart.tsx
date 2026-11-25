import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CarbonMonth } from '@/domain/viewmodels';
import {
  formatCompact,
  formatIntensity,
  formatMonthShort,
  formatMonthYear,
  formatNumber,
  formatTCo2,
} from '@/lib/format';
import { ChartFrame, ChartTooltipBox } from './ChartFrame';
import { axisTick, swatch } from './chartStyle';

export interface ScopeBarsLabels {
  title: string;
  summary: string;
  month: string;
  scope1: string;
  scope2: string;
  total: string;
  intensity: string;
  partial: string;
}

/** Monthly Scope 1 / 2 stacked bars with the carbon intensity line on a second axis. */
export function ScopeBarsChart({
  months,
  labels,
  height = 300,
}: {
  months: CarbonMonth[];
  labels: ScopeBarsLabels;
  height?: number;
}) {
  const rows = months.map((m) => ({
    ...m,
    intensity: Number.isFinite(m.intensityKgPerT) ? m.intensityKgPerT : null,
  }));
  const label = (m: CarbonMonth) =>
    m.complete ? formatMonthYear(m.start) : `${formatMonthYear(m.start)} (${labels.partial})`;
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={height}
      legend={[
        { key: 's1', label: labels.scope1, swatch: swatch.box('#B45309', 0.85) },
        { key: 's2', label: labels.scope2, swatch: swatch.box('var(--violet-600)', 0.85) },
        { key: 'i', label: labels.intensity, swatch: swatch.line('var(--text)') },
        { key: 'p', label: labels.partial, swatch: swatch.box('var(--violet-600)', 0.35) },
      ]}
      table={{
        columns: [
          { key: 'm', label: labels.month },
          { key: 's1', label: labels.scope1, align: 'right' },
          { key: 's2', label: labels.scope2, align: 'right' },
          { key: 't', label: labels.total, align: 'right' },
          { key: 'i', label: labels.intensity, align: 'right' },
        ],
        rows: months.map((m) => ({
          id: m.key,
          cells: {
            m: label(m),
            s1: formatTCo2(m.scope1T),
            s2: formatTCo2(m.scope2T),
            t: formatTCo2(m.totalT),
            i: formatIntensity(m.intensityKgPerT),
          },
        })),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="start"
            type="category"
            tickFormatter={(v: number) => formatMonthShort(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-strong)' }}
            interval="preserveStartEnd"
            minTickGap={4}
          />
          <YAxis
            yAxisId="t"
            tickFormatter={(v: number) => formatCompact(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <YAxis
            yAxisId="i"
            orientation="right"
            tickFormatter={(v: number) => formatNumber(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={[0, 'auto']}
          />
          <Tooltip
            cursor={{ fill: 'var(--violet-50)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const m = payload[0].payload as CarbonMonth;
              return (
                <ChartTooltipBox
                  title={label(m)}
                  rows={[
                    { label: labels.scope1, value: formatTCo2(m.scope1T), tone: 'muted' },
                    { label: labels.scope2, value: formatTCo2(m.scope2T), tone: 'muted' },
                    { label: labels.total, value: formatTCo2(m.totalT) },
                    { label: labels.intensity, value: formatIntensity(m.intensityKgPerT) },
                  ]}
                />
              );
            }}
          />
          <Bar yAxisId="t" dataKey="scope1T" stackId="s" fill="#B45309" isAnimationActive={false}>
            {rows.map((m) => (
              <Cell key={m.key} fillOpacity={m.complete ? 0.85 : 0.35} />
            ))}
          </Bar>
          <Bar
            yAxisId="t"
            dataKey="scope2T"
            stackId="s"
            fill="var(--violet-600)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {rows.map((m) => (
              <Cell key={m.key} fillOpacity={m.complete ? 0.85 : 0.35} />
            ))}
          </Bar>
          <Line
            yAxisId="i"
            dataKey="intensity"
            type="monotone"
            stroke="var(--text)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: 'var(--text)' }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
