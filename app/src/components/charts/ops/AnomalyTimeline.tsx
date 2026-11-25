import { useMemo } from 'react';
import type { Severity } from '@/data/types';
import { SEVERITY_ORDER, type TimelineLane } from '@/domain/ops';
import { useT } from '@/i18n';
import { formatDayShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SEVERITY_META } from './statusMeta';
import { useElementWidth } from './useElementWidth';

export interface AnomalyTimelineProps {
  lanes: TimelineLane[];
  from: number;
  to: number;
  /** lane title, e.g. equipment group name */
  laneLabel: (key: TimelineLane['key']) => string;
  /** accessible label of one item */
  itemLabel: (id: string) => string;
  onOpen: (id: string) => void;
  selectedId?: string | null;
  ariaLabel: string;
  className?: string;
}

const LABEL_W = 150;
const ROW_H = 20;
const LANE_PAD = 8;
const AXIS_H = 24;
const DAY = 86_400_000;

/**
 * Anomaly timeline (spec 7.7): one lane per equipment group, a thin line for
 * the anomaly span and thick marks for every occurrence, coloured by
 * severity (legend + accessible labels carry the meaning too).
 */
export function AnomalyTimeline({
  lanes,
  from,
  to,
  laneLabel,
  itemLabel,
  onOpen,
  selectedId,
  ariaLabel,
  className,
}: AnomalyTimelineProps) {
  const { t, tx } = useT('anomalies');
  const { ref, width: measured } = useElementWidth<HTMLDivElement>(960);
  const width = Math.max(640, measured);
  const plotW = width - LABEL_W - 12;
  const x = (f: number) => LABEL_W + f * plotW;
  const { ys, height } = useMemo(() => {
    const ys: number[] = [];
    const end = lanes.reduce((top, l) => {
      ys.push(top);
      return top + LANE_PAD * 2 + l.rows * ROW_H;
    }, AXIS_H);
    return { ys, height: end + 4 };
  }, [lanes]);
  // weekly grid (Mondays) + today
  const ticks = useMemo(() => {
    const out: number[] = [];
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    for (let t0 = d.getTime(); t0 < to; t0 += 7 * DAY) out.push(t0);
    return out;
  }, [from, to]);
  const fx = (t0: number) => (t0 - from) / Math.max(1, to - from);

  return (
    <div className={cn('w-full', className)}>
      <ul
        aria-label={t('timeline.legend')}
        className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2"
      >
        {SEVERITY_ORDER.map((s: Severity) => {
          const Icon = SEVERITY_META[s].icon;
          return (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-4 rounded-full"
                style={{ background: SEVERITY_META[s].color }}
              />
              <Icon className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
              {tx(`common:severity.${s}`)}
            </li>
          );
        })}
      </ul>
      <div ref={ref} className="overflow-x-auto">
        <svg
          role="group"
          aria-label={ariaLabel}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {ticks.map((t0) => (
            <g key={t0}>
              <line
                x1={x(fx(t0))}
                x2={x(fx(t0))}
                y1={AXIS_H - 4}
                y2={height}
                stroke="var(--border)"
              />
              {x(1) - x(fx(t0)) > 90 && (
                <text x={x(fx(t0)) + 4} y={14} fontSize={11.5} fill="var(--text-3)">
                  {formatDayShort(t0)}
                </text>
              )}
            </g>
          ))}
          <line
            x1={x(1)}
            x2={x(1)}
            y1={AXIS_H - 4}
            y2={height}
            stroke="var(--violet-400)"
            strokeDasharray="3 3"
          />
          <text x={x(1) - 4} y={14} fontSize={11.5} textAnchor="end" fill="var(--violet-700)">
            {t('timeline.today')}
          </text>
          {lanes.map((l, li) => (
            <g key={l.key}>
              {li > 0 && <line x1={0} x2={width} y1={ys[li]} y2={ys[li]} stroke="var(--border)" />}
              <text
                x={0}
                y={ys[li] + LANE_PAD + ROW_H / 2 + 4}
                fontSize={12.5}
                fontWeight={600}
                fill="var(--text-2)"
              >
                {laneLabel(l.key)}
              </text>
              {l.items.map((it) => {
                const cy = ys[li] + LANE_PAD + it.row * ROW_H + ROW_H / 2;
                const color = SEVERITY_META[it.severity].color;
                const dim = it.status === 'resolved' || it.status === 'false_alarm';
                const selected = it.id === selectedId;
                const open = () => onOpen(it.id);
                return (
                  <g
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    aria-label={itemLabel(it.id)}
                    aria-pressed={selected}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open();
                      }
                    }}
                    className="group cursor-pointer outline-none"
                    opacity={dim ? 0.45 : 1}
                    data-testid={`tl-${it.id}`}
                  >
                    <title>{itemLabel(it.id)}</title>
                    <rect
                      x={x(it.x0) - 4}
                      y={cy - ROW_H / 2 + 1}
                      width={Math.max(8, x(it.x1) - x(it.x0) + 8)}
                      height={ROW_H - 2}
                      rx={6}
                      fill={selected ? 'var(--violet-50)' : 'transparent'}
                      stroke="var(--violet-600)"
                      strokeWidth={2}
                      strokeOpacity={selected ? 1 : 0}
                      className="transition-[stroke-opacity] duration-180 group-hover:[stroke-opacity:0.4] group-focus-visible:[stroke-opacity:1]"
                    />
                    <line
                      x1={x(it.x0)}
                      x2={x(it.x1)}
                      y1={cy}
                      y2={cy}
                      stroke={color}
                      strokeWidth={2}
                      strokeOpacity={0.55}
                      strokeDasharray={it.status === 'false_alarm' ? '3 3' : undefined}
                    />
                    {it.marks.map((m, mi) => (
                      <rect
                        key={mi}
                        x={x(m.x0) + 0.5}
                        y={cy - 4}
                        width={Math.max(3, x(m.x1) - x(m.x0) - 1)}
                        height={8}
                        rx={2}
                        fill={color}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-2 text-xs text-ink-3">{t('timeline.hint')}</p>
    </div>
  );
}
