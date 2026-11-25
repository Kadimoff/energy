import { useId } from 'react';
import { useT } from '@/i18n';
import { formatCompact, formatDayShort, formatMonthShort } from '@/lib/format';
import type { DailyPoint } from '@/services/ReportService';
import type { CarbonMonth } from '@/domain/viewmodels';

/**
 * Static SVG charts for the A4 sheets. Fixed viewBox (no ResizeObserver), so
 * they render identically on screen, in the hidden print copy and in PDF.
 */

export function ReportBandChart({
  points,
  height = 150,
  width = 714,
  label,
}: {
  points: DailyPoint[];
  height?: number;
  /** viewBox width = rendered width in CSS px, so 10 px labels stay 10 px */
  width?: number;
  label: string;
}) {
  const W = width;
  const { t } = useT('common');
  const gid = useId().replace(/:/g, '');
  const H = height;
  const padL = 40;
  const padB = 18;
  const padT = 6;
  const n = points.length;
  if (!n) return null;
  const max =
    Math.max(...points.map((p) => Math.max(p.actual ?? 0, p.upper, p.forecast ?? 0))) * 1.08 || 1;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - 4);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const band =
    points.map((p, i) => `${x(i)},${y(p.upper)}`).join(' ') +
    ' ' +
    points
      .map((p, i) => `${x(i)},${y(p.lower)}`)
      .reverse()
      .join(' ');
  const line = (key: 'actual' | 'forecast') => {
    const segs: string[] = [];
    points.forEach((p, i) => {
      const v = p[key];
      if (v !== null) segs.push(`${segs.length ? 'L' : 'M'}${x(i)},${y(v)}`);
    });
    return segs.join(' ');
  };
  const lastActual = points.reduce((k, p, i) => (p.actual !== null ? i : k), -1);
  const fcStart =
    lastActual >= 0 && points[lastActual + 1]?.forecast != null
      ? `M${x(lastActual)},${y(points[lastActual].actual ?? 0)} L${x(lastActual + 1)},${y(points[lastActual + 1].forecast ?? 0)}`
      : '';
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const labelIdx = [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`band-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#DDD3FE" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#ECEAF5" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6E6A86">
              {formatCompact(v)}
            </text>
          </g>
        ))}
        <polygon points={band} fill={`url(#band-${gid})`} stroke="#A78BFA" strokeWidth={0.75} />
        <path
          d={line('actual')}
          fill="none"
          stroke="#1B1830"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        <path
          d={fcStart + ' ' + line('forecast').replace(/^M/, fcStart ? 'L' : 'M')}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 4}
            fontSize="10"
            fill="#6E6A86"
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          >
            {formatDayShort(points[i].t)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-ink" aria-hidden="true" />
          {t('chart.actual')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-[2px] border border-violet-400 bg-violet-200"
            aria-hidden="true"
          />
          {t('chart.optimalBand')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-violet-600" aria-hidden="true" />
          {t('chart.forecast')}
        </span>
      </figcaption>
    </figure>
  );
}

export function ReportScopeBars({
  months,
  height = 150,
  width = 714,
  label,
}: {
  months: CarbonMonth[];
  height?: number;
  width?: number;
  label: string;
}) {
  const W = width;
  const { t } = useT('reports');
  const hatch = `scope1-hatch-${useId().replace(/:/g, '')}`;
  const H = height;
  const padL = 36;
  const padB = 18;
  const padT = 6;
  const n = months.length;
  if (!n) return null;
  const max = Math.max(...months.map((m) => m.totalT)) * 1.1 || 1;
  const slot = (W - padL) / n;
  const bw = Math.min(28, slot * 0.6);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        <defs>
          <pattern
            id={hatch}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="4" height="4" fill="#B45309" />
            <line x1="0" y1="0" x2="0" y2="4" stroke="#FDF4E3" strokeWidth="1.2" />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W} y1={y(f * max)} y2={y(f * max)} stroke="#ECEAF5" />
            <text x={padL - 6} y={y(f * max) + 3} fontSize="10" textAnchor="end" fill="#6E6A86">
              {formatCompact(f * max)}
            </text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = padL + slot * i + slot / 2;
          return (
            <g key={m.key} opacity={m.complete ? 1 : 0.55}>
              <rect
                x={cx - bw / 2}
                y={y(m.scope2T)}
                width={bw}
                height={y(0) - y(m.scope2T)}
                fill="#7C3AED"
              />
              <rect
                x={cx - bw / 2}
                y={y(m.scope2T + m.scope1T)}
                width={bw}
                height={y(m.scope2T) - y(m.scope2T + m.scope1T)}
                fill={`url(#${hatch})`}
              />
              <text x={cx} y={H - 4} fontSize="10" textAnchor="middle" fill="#6E6A86">
                {formatMonthShort(m.start)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-violet-600" aria-hidden="true" />
          {t('carbonReport.scope2Legend')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#B45309]" aria-hidden="true" />
          {t('carbonReport.scope1Legend')}
        </span>
        <span>{t('carbonReport.partialLegend')}</span>
      </figcaption>
    </figure>
  );
}
