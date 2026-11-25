import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { HistogramBin, LoadClass } from '@/domain/ops';
import type { LoadProfile } from '@/domain/equipment';
import { useT } from '@/i18n';
import { formatNumber, formatShare } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ViewAsTableButton } from './status';

export interface LoadHistogramProps {
  bins: HistogramBin[];
  profile: LoadProfile;
  name: string;
  className?: string;
}

const LOAD_CLASS_COLOR: Record<LoadClass, string> = {
  off: 'var(--chart-6)',
  idle: 'var(--violet-300)',
  partial: 'var(--violet-500)',
  full: 'var(--violet-800)',
};

const CLASSES: LoadClass[] = ['off', 'idle', 'partial', 'full'];

const rangeLabel = (b: HistogramBin) =>
  Number.isFinite(b.to)
    ? `${formatNumber(b.from * 100, 0)}–${formatNumber(b.to * 100, 0)}%`
    : `${formatNumber(b.from * 100, 0)}%+`;

/** Load profile histogram (spec 7.5): hours per % of rated power, grouped idle / partial / full. */
export function LoadHistogram({ bins, profile, name, className }: LoadHistogramProps) {
  const { t } = useT('equipment');
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1e-6, ...bins.map((b) => b.share));
  const aria = t('hist.aria', {
    name,
    off: formatShare(profile.off),
    idle: formatShare(profile.idle),
    partial: formatShare(profile.partial),
    full: formatShare(profile.full),
  });
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
          {CLASSES.map((c) => (
            <div key={c} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-ink-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: LOAD_CLASS_COLOR[c] }}
                />
                {t(`hist.${c}`)}
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-ink">
                {formatShare(profile[c])}
              </dd>
            </div>
          ))}
        </dl>
        <ViewAsTableButton asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
      </div>
      {asTable ? (
        <div className="overflow-auto rounded-md border border-border">
          <Table>
            <caption className="sr-only">{t('hist.caption')}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('hist.rangeHead')}</TableHead>
                <TableHead>{t('hist.class')}</TableHead>
                <TableHead className="text-right">{t('hist.hours')}</TableHead>
                <TableHead className="text-right">{t('hist.share')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bins.map((b) => (
                <TableRow key={b.from}>
                  <TableCell>{rangeLabel(b)}</TableCell>
                  <TableCell>{t(`hist.${b.cls}`)}</TableCell>
                  <TableCell className="text-right">{formatNumber(b.hours)}</TableCell>
                  <TableCell className="text-right">{formatShare(b.share, 1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <figure role="img" aria-label={aria} className="m-0">
          <div
            className="flex h-40 items-end gap-1.5 border-b border-border-strong"
            aria-hidden="true"
          >
            {bins.map((b) => (
              <div key={b.from} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                {b.share >= 0.005 && (
                  <span className="mb-1 text-center text-[11px] tabular-nums text-ink-3">
                    {formatShare(b.share)}
                  </span>
                )}
                <div
                  title={t('hist.binAria', {
                    range: rangeLabel(b),
                    hours: formatNumber(b.hours),
                    share: formatShare(b.share, 1),
                  })}
                  className="w-full rounded-t-[4px]"
                  style={{
                    height: `${Math.max(b.share > 0 ? 2 : 0, (b.share / max) * 78)}%`,
                    background: LOAD_CLASS_COLOR[b.cls],
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5" aria-hidden="true">
            {bins.map((b) => (
              <span
                key={b.from}
                className="min-w-0 flex-1 truncate text-center text-[10.5px] tabular-nums text-ink-3"
              >
                {Number.isFinite(b.to)
                  ? formatNumber(b.from * 100, 0)
                  : `${formatNumber(b.from * 100, 0)}+`}
              </span>
            ))}
          </div>
          <figcaption className="mt-1 text-xs text-ink-3">{t('hist.rangeHead')}, %</figcaption>
        </figure>
      )}
    </div>
  );
}
