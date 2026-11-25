/* Shared chart styling helpers (no components here). */

/** Legend swatches shared by the analytics charts (colour is always paired with a label). */
export const swatch = {
  line: (color: string, dashed = false) => (
    <span
      className="w-4 border-t-2"
      style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
    />
  ),
  dotted: (color: string) => (
    <span className="w-4 border-t-2 border-dotted" style={{ borderColor: color }} />
  ),
  box: (color: string, opacity = 1) => (
    <span
      className="h-3 w-3 rounded-[3px]"
      style={{ background: color, opacity, border: `1px solid ${color}` }}
    />
  ),
};

export const axisTick = { fontSize: 12, fill: 'var(--text-3)' };
