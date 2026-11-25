import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface SourceTooltipProps {
  /** e.g. "Scope 2 şəbəkə əmsalı" */
  label: string;
  /** formatted factor value, e.g. "0,41 kq CO₂/kVt·saat" */
  value: string;
  source: string;
  /** publication date / year of the factor */
  date?: string | null;
  /** ISO date of last manual check */
  lastChecked?: string | null;
  /** show "verify with the official source" note */
  verify?: boolean;
  /** placeholder value that must be replaced */
  placeholder?: boolean;
  /** custom trigger; default is a small info icon */
  children?: ReactNode;
  className?: string;
}

/** Factor + source next to every CO₂ / tariff number (spec 5.6, 11). */
export function SourceTooltip({
  label,
  value,
  source,
  date,
  lastChecked,
  verify,
  placeholder,
  children,
  className,
}: SourceTooltipProps) {
  const { t } = useT();
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={`${label}: ${value}. ${t('source.source')}: ${source}`}
            className={cn(
              'inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-violet-50 hover:text-violet-700',
              className,
            )}
          >
            <Info className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent className="w-72 max-w-none">
        <p className="font-semibold text-ink">{label}</p>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-ink-3">{t('source.factor')}</dt>
          <dd className="font-medium tabular-nums text-ink">{value}</dd>
          <dt className="text-ink-3">{t('source.source')}</dt>
          <dd>{source}</dd>
          {date && (
            <>
              <dt className="text-ink-3">{t('source.date')}</dt>
              <dd>{date}</dd>
            </>
          )}
          {lastChecked && (
            <>
              <dt className="text-ink-3">{t('source.lastChecked')}</dt>
              <dd>{formatDate(new Date(lastChecked))}</dd>
            </>
          )}
        </dl>
        {(verify || placeholder) && (
          <p className="mt-2 rounded-[6px] bg-warning-surface px-2 py-1 text-warning-text">
            {placeholder ? t('source.placeholder') : t('source.verify')}
          </p>
        )}
        <Link
          to="/settings"
          className="mt-2 inline-block font-medium text-violet-700 hover:underline"
        >
          {t('source.openSettings')}
        </Link>
      </TooltipContent>
    </Tooltip>
  );
}
