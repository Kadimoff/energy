import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { BudgetState } from '@/services/ReportService';

/** Small building blocks for the A4 report sheets (print friendly, no gradients). */

export function SheetSection({
  title,
  children,
  className,
  aside,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <section className={cn('report-block', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-border pb-1">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {aside && <div className="text-xs text-ink-3">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Figure({
  label,
  value,
  hint,
  tone = 'neutral',
  strong,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[8px] border border-border px-3 py-1.5',
        strong && 'bg-bg-subtle',
      )}
    >
      <p className="truncate text-xs text-ink-2">{label}</p>
      <p className="text-[17px] font-semibold leading-6 tabular-nums tracking-[-0.01em] text-ink">
        {value}
      </p>
      {hint && (
        <p
          className={cn(
            'text-xs leading-4',
            tone === 'success' && 'text-success-text',
            tone === 'warning' && 'text-warning-text',
            tone === 'danger' && 'text-danger-text',
            tone === 'neutral' && 'text-ink-3',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function SheetTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  empty?: string;
}) {
  return (
    <table className="w-full border-collapse text-xs tabular-nums">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="border-b border-border-strong text-left text-ink-2">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                'py-1 pr-2 font-medium last:pr-0',
                c.align === 'right' && 'text-right',
                c.className,
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty && (
          <tr>
            <td colSpan={columns.length} className="py-2 text-ink-3">
              {empty}
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={rowKey(r)} className="border-b border-border last:border-b-0">
            {columns.map((c) => (
              <td
                key={c.key}
                className={cn(
                  'py-1 pr-2 align-top text-ink last:pr-0',
                  c.align === 'right' && 'whitespace-nowrap text-right',
                  c.className,
                )}
              >
                {c.cell(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const stateVariant: Record<BudgetState, 'success' | 'warning' | 'danger'> = {
  within: 'success',
  risk: 'warning',
  overrun_expected: 'danger',
  overrun: 'danger',
};

export function BudgetStateBadge({ state }: { state: BudgetState }) {
  const { tx } = useT('reports');
  return <Badge variant={stateVariant[state]}>{tx(`budgetState.${state}`)}</Badge>;
}

/** Horizontal budget bar: projected cost vs budget, P10–P90 whisker. */
export function BudgetBar({
  projected,
  p10,
  p90,
  budget,
  state,
  label,
}: {
  projected: number;
  p10: number;
  p90: number;
  budget: number;
  state: BudgetState;
  label: string;
}) {
  const max = Math.max(budget, p90, projected) * 1.08 || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const fill = state === 'within' ? 'bg-success' : state === 'risk' ? 'bg-warning' : 'bg-danger';
  return (
    <div
      className="relative h-3 rounded-full bg-bg-subtle ring-1 ring-inset ring-border"
      role="img"
      aria-label={label}
    >
      <div
        className={cn('absolute inset-y-0 left-0 rounded-full opacity-80', fill)}
        style={{ width: pct(projected) }}
      />
      {p90 > p10 && (
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink/25"
          style={{ left: pct(p10), width: `calc(${pct(p90)} - ${pct(p10)})` }}
        />
      )}
      <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: pct(budget) }} />
    </div>
  );
}
