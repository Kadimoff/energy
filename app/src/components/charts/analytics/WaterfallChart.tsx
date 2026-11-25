import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChartFrame, type ChartTable } from './ChartFrame';
import { swatch } from './chartStyle';

export interface WaterfallRow {
  id: string;
  label: string;
  /** optional secondary text (status) */
  meta?: ReactNode;
  from: number;
  to: number;
  kind: 'start' | 'step' | 'result' | 'target';
  /** formatted value shown next to the bar */
  valueText: string;
}

export interface WaterfallLabels {
  title: string;
  summary: string;
  level: string;
  reduction: string;
  target: string;
  /** "Ox {min} ilə başlayır" style note for a truncated axis */
  axisNote?: string;
}

const kindClass: Record<WaterfallRow['kind'], string> = {
  start: 'bg-ink/75',
  step: 'bg-success',
  result: 'bg-violet-600',
  target: 'border-2 border-dashed border-violet-600 bg-violet-100',
};

/**
 * Horizontal waterfall (spec 7.9 reduction roadmap): start level, one
 * floating bar per step, result and target. Custom HTML so long labels wrap
 * and the layout works down to 390 px. The axis may start above zero
 * (`min`) to make small steps visible; the note says so.
 */
export function WaterfallChart({
  rows,
  labels,
  table,
  min = 0,
  max,
  minText,
  maxText,
}: {
  rows: WaterfallRow[];
  labels: WaterfallLabels;
  table: ChartTable;
  min?: number;
  max?: number;
  minText?: string;
  maxText?: string;
}) {
  const top = max ?? Math.max(...rows.map((r) => Math.max(r.from, r.to)), 1);
  const span = Math.max(1e-9, top - min);
  const f = (v: number) => Math.max(0, Math.min(1, (v - min) / span));
  const pct = (v: number) => `${(f(v) * 100).toFixed(3)}%`;
  return (
    <ChartFrame
      title={labels.title}
      summary={labels.summary}
      height={rows.length * 44 + 28}
      autoHeight
      legend={[
        { key: 'l', label: labels.level, swatch: swatch.box('var(--text)', 0.75) },
        { key: 'r', label: labels.reduction, swatch: swatch.box('var(--success)') },
        { key: 't', label: labels.target, swatch: swatch.box('var(--violet-100)') },
      ]}
      table={table}
    >
      <div className="flex flex-col">
        <ol className="flex flex-col gap-2 sm:gap-1.5" aria-hidden="true">
          {rows.map((r) => {
            const lo = Math.min(r.from, r.to);
            const hi = Math.max(r.from, r.to);
            const roomRight = f(hi) < 0.8;
            const roomLeft = f(lo) > 0.25;
            const inside = !roomRight && !roomLeft;
            return (
              <li
                key={r.id}
                className="flex min-h-[36px] flex-col gap-1 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center justify-between gap-2 text-13 leading-tight text-ink-2 sm:w-[min(42%,340px)] sm:shrink-0 sm:pr-3">
                  <span
                    className={cn(
                      'min-w-0 sm:line-clamp-2',
                      r.kind !== 'step' && 'font-semibold text-ink',
                    )}
                    title={r.label}
                  >
                    {r.label}
                  </span>
                  {r.meta && <span className="shrink-0">{r.meta}</span>}
                </div>
                <div className="relative h-6 min-w-0 flex-1 rounded-[4px] bg-bg-subtle">
                  <span
                    className={cn(
                      'absolute inset-y-0.5 rounded-[4px] transition-all duration-180 ease-standard',
                      kindClass[r.kind],
                    )}
                    style={{ left: pct(lo), width: `max(3px, calc(${pct(hi)} - ${pct(lo)}))` }}
                  />
                  <span
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-1.5 text-xs font-semibold tabular-nums',
                      inside && r.kind !== 'target' ? 'text-white' : 'text-ink',
                    )}
                    style={
                      roomRight
                        ? { left: pct(hi) }
                        : roomLeft
                          ? { right: `calc(100% - ${pct(lo)})` }
                          : { right: `calc(100% - ${pct(hi)})` }
                    }
                  >
                    {r.valueText}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
        {(minText || maxText) && (
          <div className="mt-1 flex justify-between text-xs text-ink-3 sm:ml-[min(42%,340px)]">
            <span>{minText}</span>
            <span>{maxText}</span>
          </div>
        )}
        {labels.axisNote && <p className="mt-1 text-xs text-ink-3">{labels.axisNote}</p>}
      </div>
    </ChartFrame>
  );
}
