import { useReducedMotion } from 'framer-motion';
import { LineChart as LineIcon, Table2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChartPoint } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import {
  formatCompact,
  formatDate,
  formatDayShort,
  formatEnergy,
  formatKwh,
  formatM3,
  formatTime,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ActualVsOptimalChartProps {
  points: ChartPoint[];
  /** used for aria-label and the table caption */
  title: string;
  unit?: 'kWh' | 'm3';
  resolution?: 'hour' | 'day';
  height?: number;
  /** show budget line when points carry budget values (default true) */
  showBudget?: boolean;
  showForecast?: boolean;
  /** render the Günlük / Toplanan toggle */
  allowCumulative?: boolean;
  /** controlled cumulative mode */
  cumulative?: boolean;
  onCumulativeChange?: (v: boolean) => void;
  /** hide toggle / table button (e.g. small cards) */
  showControls?: boolean;
  /** short text summary read by screen readers in addition to the title */
  ariaSummary?: string;
  /** extra content on the left of the control row (e.g. a scope selector) */
  toolbar?: React.ReactNode;
  className?: string;
}

interface Row {
  t: number;
  actual: number | null;
  optimal: number;
  band: [number, number];
  waste: [number, number] | null;
  wasteValue: number | null;
  forecast: number | null;
  forecastBand: [number, number] | null;
  budget: number | null;
}

function toRows(points: ChartPoint[], cumulative: boolean): Row[] {
  return points.map((p) => {
    const actual = cumulative ? p.cumActual : p.actual;
    const lower = cumulative ? p.cumLower : p.lower;
    const upper = cumulative ? p.cumUpper : p.upper;
    const fc = cumulative ? p.cumForecast : p.forecast;
    const fl = cumulative ? p.cumForecastLower : p.forecastLower;
    const fu = cumulative ? p.cumForecastUpper : p.forecastUpper;
    return {
      t: p.t,
      actual,
      optimal: cumulative ? p.cumOptimal : p.optimal,
      band: [lower, upper],
      // spec 3: where the actual line leaves the band, the area above it is waste
      waste: actual !== null && actual > upper ? [upper, actual] : null,
      wasteValue: p.waste,
      forecast: fc,
      forecastBand: fl !== null && fu !== null ? [fl, fu] : null,
      budget: cumulative ? p.cumBudget : p.budget,
    };
  });
}

/**
 * Signature chart (spec 3): actual consumption over the AI optimal band.
 * Waste (line above the band) is filled with a hatched warning area, the
 * forecast is dashed violet with a P10–P90 band, optional budget line,
 * daily / cumulative toggle and a table alternative.
 */
export function ActualVsOptimalChart({
  points,
  title,
  unit = 'kWh',
  resolution = 'day',
  height = 320,
  showBudget = true,
  showForecast = true,
  allowCumulative = true,
  cumulative: cumulativeProp,
  onCumulativeChange,
  showControls = true,
  ariaSummary,
  toolbar,
  className,
}: ActualVsOptimalChartProps) {
  const { t } = useT();
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const [cumState, setCumState] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const cumulative = cumulativeProp ?? cumState;
  const setCumulative = (v: boolean) =>
    onCumulativeChange ? onCumulativeChange(v) : setCumState(v);
  const rows = useMemo(() => toRows(points, cumulative), [points, cumulative]);
  const hasForecast = showForecast && rows.some((r) => r.forecast !== null);
  const hasBudget = showBudget && rows.some((r) => r.budget !== null);
  const fmtVal =
    unit === 'm3'
      ? (v: number) => formatM3(v)
      : (v: number) => (cumulative ? formatEnergy(v) : formatKwh(v));
  const fmtX = resolution === 'hour' ? formatTime : formatDayShort;
  const fmtFull =
    resolution === 'hour' ? (x: number) => `${formatDate(x)}, ${formatTime(x)}` : formatDate;
  const range = points.length
    ? `${fmtFull(points[0].t)} – ${fmtFull(points[points.length - 1].t)}`
    : '';

  const legend = [
    {
      key: 'actual',
      label: t('chart.actual'),
      swatch: <span className="h-0.5 w-4 rounded bg-ink" />,
    },
    {
      key: 'band',
      label: t('chart.optimalBand'),
      swatch: <span className="h-3 w-4 rounded-[3px] border border-violet-400 bg-violet-200/60" />,
    },
    {
      key: 'waste',
      label: t('chart.waste'),
      swatch: (
        <span
          className="h-3 w-4 rounded-[3px] border border-warning/60"
          style={{
            background:
              'repeating-linear-gradient(135deg, rgb(var(--warning-rgb) / 0.55) 0 2px, rgb(var(--warning-rgb) / 0.2) 2px 5px)',
          }}
        />
      ),
    },
    ...(hasForecast
      ? [
          {
            key: 'fc',
            label: t('chart.forecast'),
            swatch: <span className="w-4 border-t-2 border-dashed border-violet-600" />,
          },
        ]
      : []),
    ...(hasBudget
      ? [
          {
            key: 'budget',
            label: t('chart.budget'),
            swatch: <span className="w-4 border-t-2 border-dotted border-danger" />,
          },
        ]
      : []),
  ];

  return (
    <div className={cn('w-full', className)}>
      {showControls && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          <div className="flex items-center gap-2">
            {allowCumulative && !asTable && (
              <Tabs
                value={cumulative ? 'cum' : 'per'}
                onValueChange={(v) => setCumulative(v === 'cum')}
              >
                <TabsList aria-label={title}>
                  <TabsTrigger value="per">
                    {resolution === 'hour' ? t('chart.hourly') : t('chart.daily')}
                  </TabsTrigger>
                  <TabsTrigger value="cum">{t('chart.cumulative')}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
            >
              {asTable ? <LineIcon aria-hidden="true" /> : <Table2 aria-hidden="true" />}
              {asTable ? t('chart.viewChart') : t('chart.viewTable')}
            </Button>
          </div>
        </div>
      )}

      {asTable ? (
        <div className="max-h-[420px] overflow-auto rounded-md border border-border">
          <Table>
            <caption className="sr-only">
              {title}. {range}
            </caption>
            <TableHeader className="sticky top-0 bg-surface">
              <TableRow>
                <TableHead>{resolution === 'hour' ? t('chart.time') : t('chart.date')}</TableHead>
                <TableHead className="text-right">{t('chart.actual')}</TableHead>
                <TableHead className="text-right">{t('chart.optimal')}</TableHead>
                <TableHead className="text-right">{t('chart.optimalBand')}</TableHead>
                <TableHead className="text-right">{t('chart.waste')}</TableHead>
                {hasForecast && <TableHead className="text-right">{t('chart.forecast')}</TableHead>}
                {hasBudget && <TableHead className="text-right">{t('chart.budget')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.t}>
                  <TableCell className="whitespace-nowrap">{fmtFull(r.t)}</TableCell>
                  <TableCell className="text-right">
                    {r.actual !== null ? fmtVal(r.actual) : '–'}
                  </TableCell>
                  <TableCell className="text-right">{fmtVal(r.optimal)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-ink-2">
                    {fmtVal(r.band[0])} – {fmtVal(r.band[1])}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.wasteValue !== null && !cumulative ? fmtVal(r.wasteValue) : '–'}
                  </TableCell>
                  {hasForecast && (
                    <TableCell className="text-right">
                      {r.forecast !== null ? fmtVal(r.forecast) : '–'}
                    </TableCell>
                  )}
                  {hasBudget && (
                    <TableCell className="text-right">
                      {r.budget !== null ? fmtVal(r.budget) : '–'}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <figure
          role="img"
          aria-label={`${title}. ${range}.${ariaSummary ? ` ${ariaSummary}` : ''}`}
          className="m-0"
          style={{ height }}
        >
          {points.length === 0 ? (
            <div className="flex h-full items-center justify-center text-13 text-ink-3">
              {t('chart.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--violet-200)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--violet-200)" stopOpacity={0.35} />
                  </linearGradient>
                  <pattern
                    id={`${uid}-hatch`}
                    width="6"
                    height="6"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="var(--warning)" fillOpacity={0.22} />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      stroke="var(--warning)"
                      strokeOpacity={0.6}
                      strokeWidth={2.5}
                    />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => fmtX(v)}
                  tick={{ fontSize: 12, fill: 'var(--text-3)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-strong)' }}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCompact(v)}
                  tick={{ fontSize: 12, fill: 'var(--text-3)' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--violet-300)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as Row;
                    return (
                      <div className="min-w-[200px] rounded-md border border-border bg-surface px-3 py-2.5 text-xs shadow-lg">
                        <p className="mb-1.5 font-semibold text-ink">{fmtFull(r.t)}</p>
                        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
                          {r.actual !== null && (
                            <>
                              <dt className="text-ink-2">{t('chart.actual')}</dt>
                              <dd className="text-right font-semibold text-ink">
                                {fmtVal(r.actual)}
                              </dd>
                            </>
                          )}
                          <dt className="text-ink-2">{t('chart.optimal')}</dt>
                          <dd className="text-right text-ink">{fmtVal(r.optimal)}</dd>
                          <dt className="text-ink-2">{t('chart.optimalBand')}</dt>
                          <dd className="text-right text-ink-2">
                            {fmtVal(r.band[0])} – {fmtVal(r.band[1])}
                          </dd>
                          {!cumulative && r.wasteValue !== null && r.wasteValue > 0 && (
                            <>
                              <dt className="text-warning-text">{t('chart.waste')}</dt>
                              <dd className="text-right font-semibold text-warning-text">
                                {fmtVal(r.wasteValue)}
                              </dd>
                            </>
                          )}
                          {hasForecast && r.forecast !== null && r.actual === null && (
                            <>
                              <dt className="text-violet-700">{t('chart.forecast')}</dt>
                              <dd className="text-right font-semibold text-violet-700">
                                {fmtVal(r.forecast)}
                              </dd>
                            </>
                          )}
                          {hasBudget && r.budget !== null && (
                            <>
                              <dt className="text-danger-text">{t('chart.budget')}</dt>
                              <dd className="text-right text-danger-text">{fmtVal(r.budget)}</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    );
                  }}
                />
                <Area
                  dataKey="band"
                  type="monotone"
                  stroke="var(--violet-400)"
                  strokeWidth={1}
                  strokeOpacity={0.7}
                  fill={`url(#${uid}-band)`}
                  isAnimationActive={false}
                  activeDot={false}
                  name={t('chart.optimalBand')}
                />
                {hasForecast && (
                  <Area
                    dataKey="forecastBand"
                    type="monotone"
                    stroke="none"
                    fill="var(--violet-400)"
                    fillOpacity={0.14}
                    isAnimationActive={false}
                    activeDot={false}
                    connectNulls={false}
                    name={t('chart.forecastBand')}
                  />
                )}
                <Area
                  dataKey="waste"
                  type="monotone"
                  stroke="var(--warning)"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  fill={`url(#${uid}-hatch)`}
                  isAnimationActive={false}
                  activeDot={false}
                  connectNulls={false}
                  name={t('chart.waste')}
                />
                {hasBudget && (
                  <Line
                    dataKey="budget"
                    type="monotone"
                    stroke="var(--danger)"
                    strokeWidth={1.5}
                    strokeDasharray="2 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    name={t('chart.budget')}
                  />
                )}
                {hasForecast && (
                  <Line
                    dataKey="forecast"
                    type="monotone"
                    stroke="var(--violet-600)"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                    activeDot={{ r: 3.5, fill: 'var(--violet-600)', stroke: 'var(--surface)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                    name={t('chart.forecast')}
                  />
                )}
                <Line
                  dataKey="actual"
                  type="monotone"
                  stroke="var(--text)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'var(--text)',
                    stroke: 'var(--surface)',
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                  isAnimationActive={!reduce}
                  animationDuration={600}
                  animationEasing="ease-out"
                  name={t('chart.actual')}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </figure>
      )}

      {!asTable && (
        <ul
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2"
          aria-label={t('chart.legend')}
        >
          {legend.map((l) => (
            <li key={l.key} className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center" aria-hidden="true">
                {l.swatch}
              </span>
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
