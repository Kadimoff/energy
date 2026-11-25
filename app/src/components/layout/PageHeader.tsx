import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** right side: filters, buttons */
  actions?: ReactNode;
  /** small line under the subtitle, e.g. "Son yenilənmə 14:30" */
  meta?: ReactNode;
  className?: string;
}

/** Page title block (h1, 24–30 px, weight 600). One per page. */
export function PageHeader({ title, subtitle, actions, meta, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-2">{subtitle}</p>}
        {meta && <div className="mt-2 text-xs text-ink-3">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
