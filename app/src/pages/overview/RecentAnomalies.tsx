import { AlertOctagon, ChevronRight, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/Skeletons';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Severity } from '@/data/types';
import { anomalyTitleParams } from '@/domain/insights';
import type { AnomalyVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatAzn, formatDayMonth, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEV: Record<Severity, { icon: typeof Info; cls: string }> = {
  critical: { icon: AlertOctagon, cls: 'bg-danger-surface text-danger-text' },
  high: { icon: TriangleAlert, cls: 'bg-warning-surface text-warning-text' },
  medium: { icon: CircleAlert, cls: 'bg-info-surface text-info-text' },
  low: { icon: Info, cls: 'bg-bg-subtle text-ink-2' },
};

/** Latest open anomalies (spec 7.3), linking to the anomaly page. */
export function RecentAnomalies({
  items,
  count,
  detail,
}: {
  items?: AnomalyVM[];
  count: number;
  detail: boolean;
}) {
  const { t, tx } = useT('overview');
  if (!items) return <TableSkeleton rows={count} cols={4} />;
  const list = items.slice(0, count);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('anomalies.title')}</CardTitle>
          <CardDescription>{t('anomalies.subtitle')}</CardDescription>
        </div>
        <Link
          to="/anomalies"
          className="shrink-0 text-13 font-medium text-violet-700 hover:underline"
        >
          {t('anomalies.all')}
        </Link>
      </CardHeader>
      {list.length === 0 ? (
        <EmptyState compact title={t('anomalies.empty')} />
      ) : (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {list.map((a) => {
            const s = SEV[a.severity];
            const Icon = s.icon;
            return (
              <li key={a.id}>
                <Link
                  to={`/anomalies?id=${encodeURIComponent(a.id)}`}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors duration-180 hover:bg-bg-subtle sm:px-6 md:grid-cols-[112px_minmax(0,1fr)_140px_110px_16px]"
                >
                  <span
                    className={cn(
                      'inline-flex w-fit items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-xs font-medium',
                      s.cls,
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {tx(`common:severity.${a.severity}`)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-13 font-medium text-ink">
                      {tx(`common:anomaly.title.${a.rule}`, anomalyTitleParams(a))}
                    </span>
                    {detail && (
                      <span className="block truncate text-xs text-ink-3">
                        {tx(`common:rule.${a.rule}`)} · {tx(`common:group.${a.group}`)}
                      </span>
                    )}
                  </span>
                  <span className="text-right text-xs tabular-nums text-ink-2 md:text-left">
                    {formatDayMonth(a.end)}, {formatTime(a.end)}
                  </span>
                  <span className="col-start-2 text-xs tabular-nums text-ink-2 md:col-start-auto md:text-right">
                    {detail
                      ? t('anomalies.loss', { azn: formatAzn(a.lossAzn) })
                      : formatAzn(a.lossAzn)}
                  </span>
                  <ChevronRight
                    className="hidden size-4 text-ink-3 group-hover:text-violet-700 md:block"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
