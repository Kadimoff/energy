import { useId, useMemo } from 'react';
import type { BandPoint } from '@/domain/copilotFacts';

/** Tiny actual vs optimal band chart for copilot reference cards (SVG, no library). */
export function MiniBandChart({
  points,
  label,
  height = 84,
}: {
  points: BandPoint[];
  label: string;
  height?: number;
}) {
  const id = useId().replace(/:/g, '');
  const W = 320;
  const geo = useMemo(() => {
    const pts = points.filter((p) => Number.isFinite(p.actual));
    if (pts.length < 2) return null;
    const max = Math.max(...pts.map((p) => Math.max(p.actual, p.upper))) * 1.08 || 1;
    const x = (i: number) => (i / (pts.length - 1)) * W;
    const y = (v: number) => height - 4 - (v / max) * (height - 8);
    const upper = pts.map((p, i) => `${x(i)},${y(p.upper)}`);
    const lower = pts.map((p, i) => `${x(i)},${y(p.lower)}`).reverse();
    return {
      band: `M${upper.join('L')}L${lower.join('L')}Z`,
      upperLine: `M${upper.join('L')}`,
      actual: `M${pts.map((p, i) => `${x(i)},${y(p.actual)}`).join('L')}`,
      waste: pts
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.actual > p.upper)
        .map(({ p, i }) => ({ x: x(i), y1: y(p.upper), y2: y(p.actual) })),
    };
  }, [points, height]);
  if (!geo) return null;
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--violet-200)" stopOpacity={0.7} />
          <stop offset="100%" stopColor="var(--violet-200)" stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <path d={geo.band} fill={`url(#${id}-b)`} />
      <path
        d={geo.upperLine}
        fill="none"
        stroke="var(--violet-400)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {geo.waste.map((w, i) => (
        <line
          key={i}
          x1={w.x}
          x2={w.x}
          y1={w.y1}
          y2={w.y2}
          stroke="var(--warning)"
          strokeWidth={3}
          strokeOpacity={0.55}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        d={geo.actual}
        fill="none"
        stroke="var(--text)"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
