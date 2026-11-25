import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DeferredSectionProps {
  children: ReactNode;
  /** placeholder height while the section is not rendered (keeps the scroll length) */
  minHeight: number;
  className?: string;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Renders below-the-fold content after the first paint: when the browser is
 * idle or when the placeholder comes near the viewport, whichever is first.
 * The reveal is a transition (time-sliced render), so a large page does not
 * block input as one long task. Without IntersectionObserver (tests, old
 * browsers) the children render immediately.
 */
export function DeferredSection({ children, minHeight, className }: DeferredSectionProps) {
  const [show, setShow] = useState(
    () => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined',
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) return;
    const reveal = () => startTransition(() => setShow(true));
    const w = window as IdleWindow;
    const idle = w.requestIdleCallback
      ? w.requestIdleCallback(reveal, { timeout: 1500 })
      : window.setTimeout(reveal, 300);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      { rootMargin: '300px 0px' },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [show]);

  if (show) return <>{children}</>;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('skeleton rounded-card', className)}
      style={{ minHeight }}
    />
  );
}
