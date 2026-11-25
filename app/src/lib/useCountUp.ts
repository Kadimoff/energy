import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './utils';

/**
 * Count-up animation (spec 6.7: the single orchestrated load moment, 600 ms).
 * Animates only on first mount; later value changes update instantly
 * (user-driven updates should feel immediate).
 */
export function useCountUp(target: number, durationMs = 600, enabled = true): number {
  const [value, setValue] = useState(() => (enabled && !prefersReducedMotion() ? 0 : target));
  const done = useRef(!enabled);
  useEffect(() => {
    if (done.current || prefersReducedMotion() || !Number.isFinite(target)) {
      setValue(target);
      done.current = true;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
