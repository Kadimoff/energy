import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** CSS colour, default violet-600 */
  color?: string;
  /** fill the area under the line */
  area?: boolean;
  /** highlight the last point */
  showLast?: boolean;
  /** optional horizontal reference value (e.g. target) */
  reference?: number;
  ariaLabel?: string;
  /** stretch to the container width (fixed height, no end dot) */
  responsive?: boolean;
  className?: string;
}

/** Lightweight SVG sparkline (no chart library, safe to render many times). */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = 'var(--violet-600)',
  area = true,
  showLast = true,
  reference,
  ariaLabel,
  responsive = false,
  className,
}: SparklineProps) {
  const id = useId();
  const geo = useMemo(() => {
    const vals = data.filter((v) => Number.isFinite(v));
    if (vals.length < 2) return null;
    const all = reference !== undefined ? [...vals, reference] : vals;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const pad = 2;
    const x = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
    let d = '';
    let started = false;
    data.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      started = true;
    });
    const firstIdx = data.findIndex((v) => Number.isFinite(v));
    let lastIdx = data.length - 1;
    while (lastIdx > 0 && !Number.isFinite(data[lastIdx])) lastIdx--;
    const areaD = `${d}L${x(lastIdx).toFixed(1)},${height}L${x(firstIdx).toFixed(1)},${height}Z`;
    return {
      d,
      areaD,
      last: { x: x(lastIdx), y: y(data[lastIdx]) },
      ref: reference !== undefined ? y(reference) : null,
    };
  }, [data, width, height, reference]);

  if (!geo) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  return (
    <svg
      width={responsive ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? 'none' : undefined}
      className={cn('block overflow-visible', className)}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {geo.ref !== null && (
        <line
          x1={0}
          x2={width}
          y1={geo.ref}
          y2={geo.ref}
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {area && <path d={geo.areaD} fill={`url(#${id}-g)`} />}
      <path
        d={geo.d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {showLast && !responsive && (
        <circle
          cx={geo.last.x}
          cy={geo.last.y}
          r={2.5}
          fill="var(--surface)"
          stroke={color}
          strokeWidth={1.75}
        />
      )}
    </svg>
  );
}
