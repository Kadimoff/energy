import { useState } from 'react';
import type { PriorityMatrix as Matrix } from '@/domain/decisions';
import type { RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatAzn, formatCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

const W = 330;
const H = 250;
const PAD = { l: 44, r: 12, t: 12, b: 34 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;
const sx = (x: number) => PAD.l + (x / 3) * IW;
/** top 14 % stays free for the quadrant labels */
const sy = (y: number) => PAD.t + (1 - y * 0.86) * IH;

export interface PriorityMatrixProps {
  matrix: Matrix;
  items: RecommendationVM[];
  onSelect: (id: string) => void;
  className?: string;
}

/** Impact (y) vs effort (x) scatter; the quick wins quadrant is highlighted (spec 7.6). */
export function PriorityMatrix({ matrix, items, onSelect, className }: PriorityMatrixProps) {
  const { t, tx } = useT('decisions');
  const [active, setActive] = useState<string | null>(null);
  const byId = new Map(items.map((v) => [v.id, v]));
  const act = active ? byId.get(active) : undefined;
  const actPt = matrix.points.find((p) => p.id === active);
  const xs = sx(matrix.xSplit);
  const ys = sy(matrix.ySplit);
  const yTicks = [0, matrix.splitAzn, matrix.maxAzn];
  return (
    <div
      className={cn(
        'grid gap-x-8 md:grid-cols-[minmax(0,1fr)_240px] md:items-center xl:grid-cols-1',
        className,
      )}
    >
      <div className="min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          role="group"
          aria-label={t('matrix.aria', { count: matrix.points.length })}
        >
          {/* quick wins quadrant: high impact, low effort */}
          <rect
            x={PAD.l}
            y={PAD.t}
            width={xs - PAD.l}
            height={ys - PAD.t}
            rx={8}
            fill="var(--success-surface)"
          />
          <rect
            x={xs}
            y={PAD.t}
            width={PAD.l + IW - xs}
            height={ys - PAD.t}
            rx={8}
            fill="var(--bg-subtle)"
          />
          <line
            x1={xs}
            x2={xs}
            y1={PAD.t}
            y2={PAD.t + IH}
            stroke="var(--border-strong)"
            strokeDasharray="3 4"
          />
          <line
            x1={PAD.l}
            x2={PAD.l + IW}
            y1={ys}
            y2={ys}
            stroke="var(--border-strong)"
            strokeDasharray="3 4"
          />
          <line
            x1={PAD.l}
            x2={PAD.l + IW}
            y1={PAD.t + IH}
            y2={PAD.t + IH}
            stroke="var(--border-strong)"
          />
          <text
            x={PAD.l + 8}
            y={PAD.t + 16}
            className="fill-success-text text-[11px] font-semibold"
          >
            {t('matrix.quadrant.quick_win')}
          </text>
          <text
            x={PAD.l + IW - 8}
            y={PAD.t + 16}
            textAnchor="end"
            className="fill-ink-3 text-[11px] font-medium"
          >
            {t('matrix.quadrant.strategic')}
          </text>
          <text x={PAD.l + 8} y={PAD.t + IH - 8} className="fill-ink-3 text-[11px] font-medium">
            {t('matrix.quadrant.fill_in')}
          </text>
          <text
            x={PAD.l + IW - 8}
            y={PAD.t + IH - 8}
            textAnchor="end"
            className="fill-ink-3 text-[11px] font-medium"
          >
            {t('matrix.quadrant.later')}
          </text>
          {yTicks.map((v, i) => (
            <text
              key={i}
              x={PAD.l - 6}
              y={sy(Math.sqrt(v / matrix.maxAzn)) + 4}
              textAnchor="end"
              className="fill-ink-3 text-[10px] tabular-nums"
            >
              {formatCompact(v)}
            </text>
          ))}
          {(['zero', 'low', 'invest'] as const).map((e, i) => (
            <text
              key={e}
              x={sx(i + 0.5)}
              y={H - 14}
              textAnchor="middle"
              className="fill-ink-3 text-[10px]"
            >
              {tx(`common:effort.${e}`)}
            </text>
          ))}
          {matrix.points.map((p) => {
            const v = byId.get(p.id);
            if (!v) return null;
            const accepted = p.status !== 'proposed' && p.status !== 'rejected';
            const rejected = p.status === 'rejected';
            const label = t('matrix.pointLabel', {
              title: tx(`common:rec.title.${p.id}`),
              azn: formatAzn(p.aznPerMonth),
              effort: tx(`common:effort.${v.effort}`),
              quadrant: tx(`matrix.quadrant.${p.quadrant}`),
              status: tx(`common:recStatus.${p.status}`),
            });
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-violet-600"
                onMouseEnter={() => setActive(p.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.id)}
                onBlur={() => setActive(null)}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p.id);
                  }
                }}
              >
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={13}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={2}
                />
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={active === p.id ? 8 : 6.5}
                  className="transition-[r] duration-180"
                  fill={
                    rejected ? 'var(--surface)' : accepted ? 'var(--success)' : 'var(--violet-600)'
                  }
                  stroke={rejected ? 'var(--text-3)' : 'var(--surface)'}
                  strokeWidth={rejected ? 1.5 : 2}
                />
              </g>
            );
          })}
          {actPt && (
            <circle
              cx={sx(actPt.x)}
              cy={sy(actPt.y)}
              r={12}
              fill="none"
              stroke="var(--violet-300)"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>
      <div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-violet-600" aria-hidden="true" />
            {t('matrix.legendPending')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-success" aria-hidden="true" />
            {t('matrix.legendAccepted')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border-[1.5px] border-ink-3"
              aria-hidden="true"
            />
            {t('matrix.legendRejected')}
          </span>
          <span className="ml-auto text-ink-3">{t('matrix.yAxis')}</span>
        </div>
        <p
          className={cn(
            'mt-3 min-h-[40px] rounded-md px-3 py-2 text-xs',
            act ? 'bg-violet-50 text-ink' : 'bg-bg-subtle text-ink-2',
          )}
          aria-hidden="true"
        >
          {act ? (
            <>
              <span className="font-semibold">{tx(`common:rec.title.${act.id}`)}</span>
              <span className="block tabular-nums text-ink-2">
                {formatAzn(act.aznPerMonth)}/{tx('common:units.months')} ·{' '}
                {tx(`common:effort.${act.effort}`)}
              </span>
            </>
          ) : (
            t('matrix.quickWins', {
              count: matrix.quickWins.count,
              azn: formatAzn(matrix.quickWins.azn),
            })
          )}
        </p>
      </div>
    </div>
  );
}
