import { LineChart as LineIcon, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface ChartColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ChartTable {
  columns: ChartColumn[];
  /** already formatted cell values keyed by column */
  rows: { id: string | number; cells: Record<string, ReactNode> }[];
}

export interface LegendItem {
  key: string;
  label: string;
  swatch: ReactNode;
}

export interface ChartFrameProps {
  /** short title, used for aria-label and the table caption */
  title: string;
  /** one sentence read by screen readers after the title */
  summary?: string;
  height: number;
  legend?: LegendItem[];
  table: ChartTable;
  /** controls on the left of the control row */
  toolbar?: ReactNode;
  /** hide the control row (table toggle) */
  showControls?: boolean;
  /** the figure takes the height of its content (HTML charts); `height` only sizes the table view */
  autoHeight?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Frame for the analytics charts: figure with aria-label, "Cədvəl kimi bax"
 * alternative (spec 6.10) and a text legend.
 */
export function ChartFrame({
  title,
  summary,
  height,
  legend,
  table,
  toolbar,
  showControls = true,
  autoHeight = false,
  children,
  className,
}: ChartFrameProps) {
  const { t } = useT();
  const [asTable, setAsTable] = useState(false);
  return (
    <div className={cn('w-full min-w-0', className)}>
      {showControls && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
          >
            {asTable ? <LineIcon aria-hidden="true" /> : <Table2 aria-hidden="true" />}
            {asTable ? t('chart.viewChart') : t('chart.viewTable')}
          </Button>
        </div>
      )}
      {asTable ? (
        <div
          className="overflow-auto rounded-md border border-border"
          style={{ maxHeight: Math.max(height, 320) }}
        >
          <Table>
            <caption className="sr-only">{title}</caption>
            <TableHeader className="sticky top-0 z-[1] bg-surface">
              <TableRow>
                {table.columns.map((c) => (
                  <TableHead key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((r) => (
                <TableRow key={r.id}>
                  {table.columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        'whitespace-nowrap',
                        c.align === 'right' && 'text-right tabular-nums',
                      )}
                    >
                      {r.cells[c.key] ?? '–'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div
          role="img"
          aria-label={summary ? `${title}. ${summary}` : title}
          className="m-0 min-w-0"
          style={autoHeight ? undefined : { height }}
        >
          {children}
        </div>
      )}
      {!asTable && legend && legend.length > 0 && (
        <ul
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2"
          aria-label={t('chart.legend')}
        >
          {legend.map((l) => (
            <li key={l.key} className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center" aria-hidden="true">
                {l.swatch}
              </span>
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tooltip box used by all analytics charts. */
export function ChartTooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: {
    label: string;
    value: string;
    tone?: 'muted' | 'strong' | 'violet' | 'success' | 'danger';
  }[];
}) {
  const tone = {
    muted: 'text-ink-2',
    strong: 'font-semibold text-ink',
    violet: 'font-semibold text-violet-700',
    success: 'font-semibold text-success-text',
    danger: 'text-danger-text',
  } as const;
  return (
    <div className="min-w-[200px] rounded-md border border-border bg-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-ink">{title}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className={cn('text-right', tone[r.tone ?? 'strong'])}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
