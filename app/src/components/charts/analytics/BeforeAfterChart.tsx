import { useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BeforeAfterPoint } from '@/domain/analytics/forecastView';
import { formatCompact, formatDate, formatDayShort, formatEnergy, formatKwh } from '@/lib/format';
import { ChartFrame, ChartTooltipBox } from './ChartFrame';
import { axisTick, swatch } from './chartStyle';

export interface BeforeAfterLabels {
  title: string;
  summary: string;
  date: string;
  before: string;
  after: string;
  daily: string;
  cumulative: string;
  remaining: string;
  difference: string;
}

/** "Əvvəl / Sonra": base forecast vs scenario per day or cumulative (spec 7.8). */
export function BeforeAfterChart({
  points,
  labels,
  height = 260,
}: {
  points: BeforeAfterPoint[];
  labels: BeforeAfterLabels;
  height?: number;
}) {
  const [cum, setCum] = useState(false);
  const reduce = useReducedMotion();
  const first = points.find((p) => p.isFuture);
  const last = points[points.length - 1];
  const fmt = cum ? formatEnergy : (v: number) => formatKwh(v);
  const val = (p: BeforeAfterPoint, k: 'base' | 'scenario' | 'diff') =>
    cum ? (k === 'base' ? p.cumBase : k === 'scenario' ? p.cumScenario : p.cumDiff) : p[k];
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={height}
      toolbar={
        <Tabs value={cum ? 'cum' : 'day'} onValueChange={(v) => setCum(v === 'cum')}>
          <TabsList aria-label={labels.title}>
            <TabsTrigger value="day">{labels.daily}</TabsTrigger>
            <TabsTrigger value="cum">{labels.cumulative}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      legend={[
        { key: 'b', label: labels.before, swatch: swatch.line('var(--violet-600)', true) },
        { key: 's', label: labels.after, swatch: swatch.line('var(--success)') },
        { key: 'r', label: labels.remaining, swatch: swatch.box('var(--violet-100)') },
      ]}
      table={{
        columns: [
          { key: 'd', label: labels.date },
          { key: 'b', label: labels.before, align: 'right' },
          { key: 's', label: labels.after, align: 'right' },
          { key: 'x', label: labels.difference, align: 'right' },
        ],
        rows: points.map((p) => ({
          id: p.t,
          cells: {
            d: formatDate(p.t),
            b: fmt(val(p, 'base')),
            s: fmt(val(p, 'scenario')),
            x: fmt(val(p, 'diff')),
          },
        })),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          // remount when the simulated month changes so the time axis is rebuilt
          key={points[0]?.t ?? 0}
          data={points.map((p) => ({
            t: p.t,
            base: val(p, 'base'),
            scenario: val(p, 'scenario'),
            diff: val(p, 'diff'),
          }))}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          {first && last && (
            <ReferenceArea x1={first.t} x2={last.t} fill="var(--violet-100)" fillOpacity={0.5} />
          )}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[points[0]?.t ?? 0, last?.t ?? 1]}
            allowDataOverflow
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
          />
          <Tooltip
            cursor={{ stroke: 'var(--violet-300)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as {
                t: number;
                base: number;
                scenario: number;
                diff: number;
              };
              return (
                <ChartTooltipBox
                  title={formatDate(r.t)}
                  rows={[
                    { label: labels.before, value: fmt(r.base), tone: 'violet' },
                    { label: labels.after, value: fmt(r.scenario), tone: 'success' },
                    { label: labels.difference, value: fmt(r.diff), tone: 'muted' },
                  ]}
                />
              );
            }}
          />
          <Line
            dataKey="base"
            type="monotone"
            stroke="var(--violet-600)"
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="scenario"
            type="monotone"
            stroke="var(--success)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reduce}
            animationDuration={180}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
