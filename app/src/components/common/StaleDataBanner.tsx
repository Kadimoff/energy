import { WifiOff } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface StaleDataBannerProps {
  /** minutes since the last successful reading */
  minutes: number;
  /** meter / equipment name without connection */
  name?: string;
  className?: string;
}

/** "Son yenilənmə 12 dəqiqə əvvəl" warning when a sensor connection is lost (spec 6.9). */
export function StaleDataBanner({ minutes, name, className }: StaleDataBannerProps) {
  const { t } = useT();
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-md border border-warning/30 bg-warning-surface px-4 py-3 text-13 text-warning-text',
        className,
      )}
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <p>
        <span className="font-semibold">{t('states.staleTitle')}. </span>
        {name ? t('states.staleBody', { minutes, name }) : t('states.staleShort', { minutes })}
      </p>
    </div>
  );
}
