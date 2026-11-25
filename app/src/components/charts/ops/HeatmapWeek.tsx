import { useId, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { HeatmapView } from '@/domain/ops';
import { useT } from '@/i18n';
import { formatNumber, NBSP } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ViewAsTableButton } from './status';

export interface HeatmapWeekProps {
  view: HeatmapView;
  /** equipment name for aria-label */
  name: string;
  /** unit label, e.g. "kVt" or "m³/saat" */
  unit: string;
  className?: string;
}

const CW = 26;
const CH = 24;
const LEFT = 44;
const TOP = 22;

const pad2 = (h: number) => String(h).padStart(2, '0');

/**
 * Weekly 7×24 heatmap (spec 7.5): average load per weekday and hour.
 * Non-production hours are framed; excess load in those hours is drawn in
 * the warning colour with a hatch pattern (colour never alone).
 */
export function HeatmapWeek({ view, name, unit, className }: HeatmapWeekProps) {
  const { t, tx } = useT('equipment');
  const uid = useId().replace(/:/g, '');
  const [asTable, setAsTable] = useState(false);
  const fmt = (v: number) => `${formatNumber(v, v < 10 ? 1 : 0)}${NBSP}${unit}`;
  const day = (w: number) => tx(`heatmap.weekdays.${w}`);
  const dayLong = (w: number) => tx(`heatmap.weekdaysLong.${w}`);
  const width = LEFT + 24 * CW;
  const height = TOP + 7 * CH;

  // frames around runs of non-production hours per weekday
  const frames: { w: number; from: number; to: number }[] = [];
  for (let w = 0; w < 7; w++) {
    let start = -1;
    for (let h = 0; h <= 24; h++) {
      const c = h < 24 ? view.cells[w * 24 + h] : null;
      const idle = c ? !c.production : false;
      if (idle && start < 0) start = h;
      if (!idle && start >= 0) {
        frames.push({ w, from: start, to: h });
        start = -1;
      }
    }
  }

  const aria = t('heatmap.aria', {
    name,
    max: fmt(view.maxKw),
    excess: view.excessSlots,
  });

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul
          aria-label={t('common:chart.legend')}
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2"
        >
          <li className="inline-flex items-center gap-1.5">
            <span className="text-ink-3">{t('heatmap.low')}</span>
            <span className="inline-flex" aria-hidden="true">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((l) => (
                <span
                  key={l}
                  className="h-3 w-3.5 first:rounded-l-[3px] last:rounded-r-[3px]"
                  style={{ background: `rgb(var(--violet-600-rgb) / ${0.06 + 0.8 * l})` }}
                />
              ))}
            </span>
            <span className="text-ink-3">{t('heatmap.high')}</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-3 w-4 rounded-[3px] border-[1.5px] border-dashed border-ink-3"
            />
            {t('heatmap.legendIdle')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-3 w-4 rounded-[3px] border border-warning"
              style={{
                background:
                  'repeating-linear-gradient(135deg, rgb(var(--warning-rgb) / 0.85) 0 2px, rgb(var(--warning-rgb) / 0.45) 2px 4px)',
              }}
            />
            {t('heatmap.legendExcess')}
          </li>
        </ul>
        <ViewAsTableButton asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
      </div>

      {asTable ? (
        <div className="max-h-[360px] overflow-auto rounded-md border border-border">
          <Table className="text-xs">
            <caption className="sr-only">
              {t('heatmap.caption')}, {unit}
            </caption>
            <TableHeader className="sticky top-0 bg-surface">
              <TableRow>
                <TableHead className="sticky left-0 bg-surface">{t('heatmap.day')}</TableHead>
                {Array.from({ length: 24 }, (_, h) => (
                  <TableHead key={h} className="px-1.5 text-right">
                    {pad2(h)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }, (_, w) => (
                <TableRow key={w}>
                  <TableHead scope="row" className="sticky left-0 bg-surface text-ink-2">
                    {dayLong(w)}
                  </TableHead>
                  {Array.from({ length: 24 }, (_, h) => {
                    const c = view.cells[w * 24 + h];
                    return (
                      <TableCell
                        key={h}
                        className={cn(
                          'px-1.5 py-1.5 text-right',
                          !c.production && 'bg-bg-subtle text-ink-2',
                          c.excess && 'bg-warning-surface font-semibold text-warning-text',
                        )}
                      >
                        {formatNumber(c.actual, c.actual < 10 ? 1 : 0)}
                        {c.excess && <span className="sr-only">, {t('heatmap.legendExcess')}</span>}
                        {!c.production && !c.excess && (
                          <span className="sr-only">, {t('heatmap.idle')}</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-label={aria}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto w-full min-w-[560px]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <defs>
              <pattern
                id={`${uid}-hatch`}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="5"
                  stroke="var(--surface)"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                />
              </pattern>
            </defs>
            {Array.from({ length: 24 }, (_, h) =>
              h % 3 === 0 ? (
                <text
                  key={h}
                  x={LEFT + h * CW + CW / 2}
                  y={13}
                  fontSize={11}
                  textAnchor="middle"
                  fill="var(--text-3)"
                  className="tabular-nums"
                >
                  {pad2(h)}
                </text>
              ) : null,
            )}
            {Array.from({ length: 7 }, (_, w) => (
              <text
                key={w}
                x={LEFT - 8}
                y={TOP + w * CH + CH / 2 + 4}
                fontSize={11.5}
                textAnchor="end"
                fill="var(--text-2)"
              >
                {day(w)}
              </text>
            ))}
            {view.cells.map((c) => {
              const x = LEFT + c.hour * CW;
              const y = TOP + c.weekday * CH;
              const fill = c.excess
                ? `rgb(var(--warning-rgb) / ${0.45 + 0.5 * Math.min(1, c.level * 1.4)})`
                : `rgb(var(--violet-600-rgb) / ${0.06 + 0.8 * c.level})`;
              const label = c.excess
                ? t('heatmap.cellExcess', {
                    day: dayLong(c.weekday),
                    hour: pad2(c.hour),
                    actual: fmt(c.actual),
                    expected: fmt(c.expected),
                    waste: fmt(c.waste),
                  })
                : t('heatmap.cell', {
                    day: dayLong(c.weekday),
                    hour: pad2(c.hour),
                    actual: fmt(c.actual),
                    expected: fmt(c.expected),
                  });
              return (
                <g key={`${c.weekday}-${c.hour}`} data-excess={c.excess || undefined}>
                  <title>{label}</title>
                  <rect x={x + 1} y={y + 1} width={CW - 2} height={CH - 2} rx={3} fill={fill} />
                  {c.excess && (
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={CW - 2}
                      height={CH - 2}
                      rx={3}
                      fill={`url(#${uid}-hatch)`}
                    />
                  )}
                </g>
              );
            })}
            {frames.map((f) => (
              <rect
                key={`${f.w}-${f.from}`}
                x={LEFT + f.from * CW + 0.5}
                y={TOP + f.w * CH + 0.5}
                width={(f.to - f.from) * CW - 1}
                height={CH - 1}
                rx={4}
                fill="none"
                stroke="var(--text-3)"
                strokeWidth={1.25}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
