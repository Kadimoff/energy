import { useT } from '@/i18n';
import { confidenceLevel } from '@/lib/confidence';
import { cn } from '@/lib/utils';

export interface ConfidenceMeterProps {
  /** 0..100 */
  value: number;
  size?: 'sm' | 'md';
  /** show the level text next to the bar */
  showLabel?: boolean;
  /** show the numeric percentage */
  showValue?: boolean;
  className?: string;
}

/** 5-segment AI confidence bar with level text (never colour only). */
export function ConfidenceMeter({
  value,
  size = 'md',
  showLabel = true,
  showValue = true,
  className,
}: ConfidenceMeterProps) {
  const { t } = useT();
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const level = confidenceLevel(v);
  const filled = Math.max(1, Math.ceil(v / 20));
  const label =
    level === 'high'
      ? t('ai.confidenceHigh')
      : level === 'medium'
        ? t('ai.confidenceMedium')
        : t('ai.confidenceLow');
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={t('ai.confidenceAria', { value: v, level: label })}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <span className="flex items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'rounded-[2px]',
              size === 'sm' ? 'h-2 w-2.5' : 'h-2.5 w-4',
              i < filled
                ? level === 'low'
                  ? 'bg-warning'
                  : 'bg-violet-600 bg-ai'
                : 'bg-violet-100',
            )}
            style={
              i < filled && level !== 'low'
                ? { backgroundSize: '500% 100%', backgroundPosition: `${i * 25}% 0` }
                : undefined
            }
          />
        ))}
      </span>
      {(showValue || showLabel) && (
        <span
          className={cn(
            'whitespace-nowrap tabular-nums',
            size === 'sm' ? 'text-xs' : 'text-13',
            'text-ink-2',
          )}
        >
          {showValue && <span className="font-semibold text-ink">{v}%</span>}
          {showValue && showLabel && ' · '}
          {showLabel && (
            <span className={level === 'low' ? 'text-warning-text' : undefined}>{label}</span>
          )}
        </span>
      )}
    </div>
  );
}
