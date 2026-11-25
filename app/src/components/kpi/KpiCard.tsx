import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from '@/components/charts/Sparkline';
import { useT } from '@/i18n';
import { formatPct, MINUS } from '@/lib/format';
import { useCountUp } from '@/lib/useCountUp';
import { cn } from '@/lib/utils';

export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface KpiCardProps {
  label: string;
  value: number;
  /** formats the (animated) value, e.g. v => formatMwh(v) */
  format: (v: number) => string;
  /** relative change vs previous period, % */
  deltaPct?: number;
  /** which direction is good: lower consumption is good by default */
  goodWhen?: 'down' | 'up';
  /** text after the delta, default "əvvəlki dövrə görə" */
  deltaLabel?: string;
  sparkline?: number[];
  /** reference line in the sparkline (target/budget) */
  sparkReference?: number;
  /** secondary line under the value, e.g. "Büdcə: 50 000 AZN" */
  hint?: ReactNode;
  /** colours the status dot/hint (always paired with text) */
  tone?: KpiTone;
  icon?: LucideIcon;
  /** whole card links to this route */
  to?: string;
  /** count-up on first mount (default true) */
  animate?: boolean;
  footer?: ReactNode;
  className?: string;
}

/** "54 295 AZN" -> number "54 295" + unit "AZN" (unit follows the last NBSP before a non-digit). */
function splitUnit(text: string): { num: string; unit: string | null } {
  const m = /^(.*?[\d%])\u00A0(\D.*)$/.exec(text);
  return m ? { num: m[1], unit: m[2] } : { num: text, unit: null };
}

const toneText: Record<KpiTone, string> = {
  neutral: 'text-ink-2',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
};

const toneSpark: Record<KpiTone, string> = {
  neutral: 'var(--violet-600)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

/** KPI card: label, animated value, delta vs previous period, sparkline. */
export function KpiCard({
  label,
  value,
  format,
  deltaPct,
  goodWhen = 'down',
  deltaLabel,
  sparkline,
  sparkReference,
  hint,
  tone = 'neutral',
  icon: Icon,
  to,
  animate = true,
  footer,
  className,
}: KpiCardProps) {
  const { t } = useT();
  const shown = useCountUp(value, 600, animate);
  const { num, unit } = splitUnit(format(shown));
  const hasDelta = deltaPct !== undefined && Number.isFinite(deltaPct);
  const flat = hasDelta && Math.abs(deltaPct) < 0.5;
  const up = hasDelta && deltaPct > 0;
  const good = flat ? null : goodWhen === 'down' ? !up : up;
  const DeltaIcon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-13 font-medium text-ink-2">{label}</p>
        {Icon && (
          <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-[30px] font-semibold leading-9 tabular-nums tracking-[-0.015em] text-ink xl:text-[28px] 2xl:text-[30px]">
        <span className="sr-only">{format(value)}</span>
        <span aria-hidden="true">{num}</span>
        {unit && (
          <span aria-hidden="true" className="text-sm font-medium tracking-normal text-ink-3">
            {unit}
          </span>
        )}
      </p>
      {hint && <p className={cn('mt-1 text-xs', toneText[tone])}>{hint}</p>}
      {sparkline && sparkline.length > 1 && (
        <Sparkline
          data={sparkline}
          height={28}
          responsive
          color={toneSpark[tone]}
          reference={sparkReference}
          className="mt-3"
        />
      )}
      {hasDelta && (
        <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-[6px] px-1.5 py-0.5 font-semibold tabular-nums',
              good === null
                ? 'bg-bg-subtle text-ink-2'
                : good
                  ? 'bg-success-surface text-success-text'
                  : 'bg-danger-surface text-danger-text',
            )}
          >
            <DeltaIcon className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {flat ? t('kpi.noChange') : `${up ? '+' : MINUS}${formatPct(Math.abs(deltaPct), 1)}`}
          </span>
          <span className="truncate">{deltaLabel ?? t('kpi.vsPrevious')}</span>
        </p>
      )}
      {footer && (
        <div className="mt-3 border-t border-border pt-3 text-xs text-ink-2">{footer}</div>
      )}
    </>
  );
  const cls = cn(
    'card group relative flex flex-col p-5 transition-[box-shadow,border-color] duration-180 ease-standard',
    to && 'hover:border-violet-200 hover:shadow-md',
    className,
  );
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
