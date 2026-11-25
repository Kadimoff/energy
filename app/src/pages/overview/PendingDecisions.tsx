import { ArrowUpRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { DecisionActions } from '@/components/ai/decision/DecisionActions';
import { EmptyState } from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/Skeletons';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatAzn } from '@/lib/format';

/** Top pending AI decisions with actions (spec 7.3). */
export function PendingDecisions({
  items,
  total,
  actions,
}: {
  items?: RecommendationVM[];
  total: number;
  actions: boolean;
}) {
  const { t, tx } = useT('overview');
  if (!items) return <TableSkeleton rows={3} cols={2} />;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            {t('decisions.title')}
            <AiBadge variant="soft" />
          </CardTitle>
          <CardDescription>{t('decisions.subtitle')}</CardDescription>
        </div>
        {total > 0 && (
          <Link
            to="/decisions"
            className="shrink-0 text-13 font-medium text-violet-700 hover:underline"
          >
            {t('decisions.all', { count: total })}
          </Link>
        )}
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState
          compact
          title={t('decisions.empty')}
          action={{ label: t('decisions.emptyAction'), to: '/decisions' }}
        />
      ) : (
        <ul className="mt-3 flex-1 divide-y divide-border">
          {items.map((v) => (
            <li key={v.id} className="relative px-5 py-4 sm:px-6">
              <span
                aria-hidden="true"
                className="absolute left-0 top-4 h-[calc(100%-2rem)] w-[3px] rounded-r bg-ai"
              />
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/decisions?rec=${v.id}`}
                  className="group text-sm font-semibold leading-snug text-ink hover:text-violet-700"
                >
                  {tx(`common:rec.title.${v.id}`)}
                  <ArrowUpRight
                    className="ml-0.5 inline size-3.5 text-ink-3 group-hover:text-violet-700"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Link>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-semibold tabular-nums text-success-text">
                    {t('decisions.perMonth', { azn: formatAzn(v.aznPerMonth) })}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                <span>{tx(`common:effort.${v.effort}`)}</span>
                <ConfidenceMeter value={v.confidence} size="sm" showLabel={false} />
              </div>
              {actions && <DecisionActions rec={v} className="mt-3" />}
            </li>
          ))}
        </ul>
      )}
      {!actions && items.length > 0 && (
        <p className="flex gap-2 border-t border-border px-5 py-3 text-xs text-ink-3 sm:px-6">
          <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {t('decisions.operatorNote')}
        </p>
      )}
    </Card>
  );
}
