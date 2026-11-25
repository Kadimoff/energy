import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** A4 width in CSS px (210 mm at 96 dpi). */
const A4_WIDTH_PX = 794;

/**
 * Scales the fixed-width A4 pages down to the available width (tablet,
 * mobile) while keeping the layout identical to print. `fit=false` shows
 * 100 % with horizontal scrolling.
 */
export function ScaledPreview({ children, fit }: { children: ReactNode; fit: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    let raf = 0;
    const update = () => {
      const w = o.getBoundingClientRect().width;
      if (w <= 0) return;
      const scale = fit ? Math.min(1, w / A4_WIDTH_PX) : 1;
      const height = i.offsetHeight * scale;
      setBox((b) =>
        Math.abs(b.scale - scale) < 1e-4 && Math.abs(b.height - height) < 0.5
          ? b
          : { scale, height },
      );
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    // late layout changes (fonts, lazy CSS) are caught by the observer and window resize
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(o);
    ro?.observe(i);
    window.addEventListener('resize', schedule);
    const late = window.setTimeout(schedule, 400);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
      window.clearTimeout(late);
      cancelAnimationFrame(raf);
    };
  }, [fit]);
  return (
    <div ref={outer} className={fit ? 'w-full overflow-hidden' : 'w-full overflow-x-auto'}>
      <div style={{ height: box.height || undefined }} className="relative">
        <div
          ref={inner}
          className="report-preview flex flex-col gap-6"
          style={{
            width: A4_WIDTH_PX,
            transform: box.scale < 1 ? `scale(${box.scale})` : undefined,
            transformOrigin: 'top left',
            marginInline: box.scale >= 1 && fit ? 'auto' : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
