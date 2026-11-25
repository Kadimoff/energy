import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/** Layout-preserving loading patterns (spec 6.9: skeletons, no spinners). */

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('card flex flex-col gap-3 p-5', className)}>
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-8 w-36" />
      <div className="flex items-end justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export function KpiRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({
  height = 320,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="relative" style={{ height }}>
        <Skeleton className="absolute inset-0 rounded-md" />
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('card divide-y divide-border', className)}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className={cn(
                'h-3.5 shrink',
                c === 0 ? 'w-40 min-w-0' : 'w-20 min-w-0',
                c === 1 && 'ml-auto',
                c >= 2 && 'hidden sm:block',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Whole page placeholder used as the route Suspense fallback. */
export function PageSkeleton() {
  const { t } = useT();
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('states.loading')}</span>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <KpiRowSkeleton />
      <ChartSkeleton className="mt-6" />
    </div>
  );
}
