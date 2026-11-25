import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  /** call to action: either a route or a click handler */
  action?: { label: string; to?: string; onClick?: () => void };
  compact?: boolean;
  className?: string;
}

/** Empty state: says what to do next and offers the action (spec 6.9). */
export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-12',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-violet-50 text-violet-600">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-13 text-ink-2">{body}</p>}
      {action &&
        (action.to ? (
          <Button asChild variant="subtle" size="sm" className="mt-1">
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="subtle" size="sm" className="mt-1" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
