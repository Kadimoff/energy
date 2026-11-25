import { useReducedMotion } from 'framer-motion';
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
import { minuteLabel, type PlanResult } from '@/domain/analytics/peak';
import { formatKw, formatNumber } from '@/lib/format';
import { ChartFrame, ChartTooltipBox } from './ChartFrame';
import { axisTick, swatch } from './chartStyle';

export interface PeakProfileLabels {
  title: string;
  summary: string;
  time: string;
  base: string;
  total: string;
  current: string;
  limit: string;
}

const LINE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

/**
 * Typical workday load profile at 15-minute resolution: other equipment
 * (grey) plus each extrusion line stacked, the current schedule as a dashed
 * line and the plant peak limit.
 */
export function PeakProfileChart({
  plan,
  current,
  lines,
  limitKw,
  labels,
  height = 300,
}: {
  plan: PlanResult;
  current: PlanResult;
  lines: { id: string; label: string }[];
  limitKw: number;
  labels: PeakProfileLabels;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const rows = plan.slots.map((s, i) => ({
    minute: s.minute,
    base: s.base,
    ...s.lines,
    total: s.total,
    current: current.slots[i]?.total ?? null,
  }));
  const max = Math.max(limitKw, current.peakKw, plan.peakKw);
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={height}
      legend={[
        { key: 'base', label: labels.base, swatch: swatch.box('var(--chart-6)', 0.6) },
        ...lines.map((l, i) => ({
          key: l.id,
          label: l.label,
          swatch: swatch.box(LINE_COLORS[i % LINE_COLORS.length], 0.7),
        })),
        { key: 'cur', label: labels.current, swatch: swatch.line('var(--text)', true) },
        { key: 'lim', label: labels.limit, swatch: swatch.dotted('var(--danger)') },
      ]}
      table={{
        columns: [
          { key: 't', label: labels.time },
          { key: 'base', label: labels.base, align: 'right' },
          ...lines.map((l) => ({ key: l.id, label: l.label, align: 'right' as const })),
          { key: 'total', label: labels.total, align: 'right' },
          { key: 'cur', label: labels.current, align: 'right' },
        ],
        rows: plan.slots.map((s, i) => ({
          id: s.minute,
          cells: {
            t: minuteLabel(s.minute),
            base: formatKw(s.base),
            ...Object.fromEntries(lines.map((l) => [l.id, formatKw(s.lines[l.id] ?? 0)])),
            total: formatKw(s.total),
            cur: formatKw(current.slots[i]?.total ?? 0),
          },
        })),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="minute"
            type="number"
            domain={[0, 1425]}
            ticks={[0, 180, 360, 480, 600, 720, 900, 1080, 1260, 1425]}
            tickFormatter={(v: number) => minuteLabel(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-strong)' }}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v: number) => formatNumber(v)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={[0, Math.ceil((max * 1.08) / 100) * 100]}
          />
          <Tooltip
            cursor={{ stroke: 'var(--violet-300)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Record<string, number>;
              return (
                <ChartTooltipBox
                  title={minuteLabel(r.minute)}
                  rows={[
                    { label: labels.total, value: formatKw(r.total) },
                    { label: labels.current, value: formatKw(r.current), tone: 'muted' },
                    { label: labels.base, value: formatKw(r.base), tone: 'muted' },
                    ...lines.map((l) => ({
                      label: l.label,
                      value: formatKw(r[l.id] ?? 0),
                      tone: 'muted' as const,
                    })),
                  ]}
                />
              );
            }}
          />
          <Area
            dataKey="base"
            stackId="load"
            type="stepAfter"
            stroke="var(--chart-6)"
            fill="var(--chart-6)"
            fillOpacity={0.45}
            isAnimationActive={false}
          />
          {lines.map((l, i) => (
            <Area
              key={l.id}
              dataKey={l.id}
              stackId="load"
              type="stepAfter"
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              fill={LINE_COLORS[i % LINE_COLORS.length]}
              fillOpacity={0.55}
              isAnimationActive={!reduce}
              animationDuration={180}
            />
          ))}
          <Line
            dataKey="current"
            type="stepAfter"
            stroke="var(--text)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <ReferenceLine
            y={limitKw}
            stroke="var(--danger)"
            strokeWidth={1.5}
            strokeDasharray="2 4"
            label={{
              value: labels.limit,
              position: 'insideTopLeft',
              fill: 'var(--danger-text)',
              fontSize: 12,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
