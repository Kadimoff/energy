import { CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
}

/** Error state: what happened and how to fix it, no apology (spec 6.9). */
export function ErrorState({ title, body, onRetry, className }: ErrorStateProps) {
  const { t } = useT();
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 py-12 text-center', className)}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-danger-surface text-danger-text">
        <CloudOff className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-ink">{title ?? t('states.errorTitle')}</p>
      <p className="max-w-sm text-13 text-ink-2">{body ?? t('states.errorBody')}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {t('actions.retry')}
        </Button>
      )}
    </div>
  );
}
