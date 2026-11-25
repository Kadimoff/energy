import { Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface AiBadgeProps {
  /** solid = gradient chip (default), soft = tinted chip for dense lists */
  variant?: 'solid' | 'soft';
  /** optional text after "AI", e.g. "xülasə" */
  label?: string;
  className?: string;
}

/** "AI" marker shown next to every AI-generated content (spec 6.4). */
export function AiBadge({ variant = 'solid', label, className }: AiBadgeProps) {
  const { t } = useT();
  return (
    <span
      title={t('ai.badgeLabel')}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[11px] font-semibold leading-none tracking-[0.01em]',
        variant === 'solid'
          ? 'bg-violet-700 bg-ai text-white shadow-sm'
          : 'border border-violet-200 bg-violet-50 text-violet-700',
        className,
      )}
    >
      <Sparkles className="size-3" strokeWidth={2} aria-hidden="true" />
      <span>{t('ai.badge')}</span>
      {label && <span className="font-medium opacity-90">{label}</span>}
      <span className="sr-only">{t('ai.badgeLabel')}</span>
    </span>
  );
}
