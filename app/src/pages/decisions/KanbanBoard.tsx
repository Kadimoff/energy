import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { DecisionActions } from '@/components/ai/decision/DecisionActions';
import { FLOW_COLUMNS, groupByColumn, type FlowColumn } from '@/domain/decisions';
import type { RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatAzn, formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

function MiniCard({ rec, onOpen }: { rec: RecommendationVM; onOpen: (id: string) => void }) {
  const { t, tx } = useT('decisions');
  return (
    <li className="relative overflow-hidden rounded-md border border-border bg-surface p-3.5 pl-4 shadow-sm">
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          rec.status === 'rejected' ? 'bg-border-strong' : 'bg-ai',
        )}
      />
      <button
        type="button"
        onClick={() => onOpen(rec.id)}
        className="text-left text-13 font-semibold leading-snug text-ink hover:text-violet-700"
      >
        {tx(`common:rec.title.${rec.id}`)}
      </button>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-ink-2">
        <span className="font-semibold text-ink">
          {formatAzn(rec.aznPerMonth)}/{tx('common:units.months')}
        </span>
        <span>{tx(`common:effort.${rec.effort}`)}</span>
      </p>
      {rec.status === 'scheduled' && rec.state.scheduledFor && (
        <p className="mt-1 text-xs text-info-text">
          {t('card.scheduledFor', { date: formatDayMonth(rec.state.scheduledFor) })}
        </p>
      )}
      {rec.status === 'rejected' && rec.state.rejectReason && (
        <p className="mt-1 text-xs text-ink-3">
          {t('card.rejectedReason', {
            reason: tx(`common:rejectReason.${rec.state.rejectReason}`),
          })}
        </p>
      )}
      <div className="mt-2">
        <ConfidenceMeter value={rec.confidence} size="sm" showLabel={false} />
      </div>
      <DecisionActions rec={rec} compact className="mt-3 gap-1.5" />
    </li>
  );
}

/** Status flow board: Təklif edildi → Təsdiqləndi → Tətbiq olunur → Ölçülür → Təsdiqlənmiş qənaət. */
export function KanbanBoard({
  items,
  onOpen,
}: {
  items: RecommendationVM[];
  onOpen: (id: string) => void;
}) {
  const { t, tx } = useT('decisions');
  const cols = groupByColumn(items);
  const [showRejected, setShowRejected] = useState(false);
  return (
    <section aria-label={t('kanban.label')}>
      <ol className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible">
        {FLOW_COLUMNS.map((c: FlowColumn) => (
          <li
            key={c}
            className="flex w-[270px] shrink-0 snap-start flex-col rounded-card bg-bg-subtle p-2.5 ring-1 ring-inset ring-border xl:w-auto"
          >
            <h2 className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-13 font-semibold text-ink">
              {tx(`common:recStatus.${c}`)}
              <span className="ml-auto rounded-full bg-surface px-1.5 text-xs tabular-nums text-ink-2 ring-1 ring-border">
                {cols[c].length}
              </span>
            </h2>
            {cols[c].length ? (
              <ul className="space-y-2">
                {cols[c].map((v) => (
                  <MiniCard key={v.id} rec={v} onOpen={onOpen} />
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-xs text-ink-3">
                {c === 'verified' ? t('kanban.verifiedNote') : t('kanban.empty')}
              </p>
            )}
          </li>
        ))}
      </ol>
      {cols.rejected.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showRejected}
            onClick={() => setShowRejected((v) => !v)}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-13 font-medium text-ink-2 hover:bg-violet-50"
          >
            {t('kanban.rejected', { count: cols.rejected.length })}
            <ChevronDown
              className={cn('size-4 transition-transform', showRejected && 'rotate-180')}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </button>
          {showRejected && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {cols.rejected.map((v) => (
                <MiniCard key={v.id} rec={v} onOpen={onOpen} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
