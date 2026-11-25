import { CalendarClock, Check, ChevronRight, MoreHorizontal, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RecommendationStatus } from '@/data/types';
import { availableActions, nextStatus } from '@/domain/decisions';
import type { RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAnalysis } from '@/stores/derived';
import { useRecommendationStore } from '@/stores/recommendations';
import { RejectDialog, ScheduleDialog } from './DecisionDialogs';
import { useDecisionNotice } from './notice';

export interface DecisionActionsProps {
  rec: Pick<RecommendationVM, 'id' | 'status' | 'state'>;
  /** compact = icon-light buttons for dense lists */
  size?: 'sm' | 'md';
  /** narrow columns: schedule / reject move into the "more" menu */
  compact?: boolean;
  className?: string;
}

/**
 * Human-in-the-loop actions (spec 7.6): approve, schedule (date), reject
 * (mandatory reason), and the manual steps of the status flow. Writes go to
 * the recommendation store, so forecasts, savings and CO₂ update everywhere.
 */
export function DecisionActions({ rec, size = 'sm', compact, className }: DecisionActionsProps) {
  const { t, tx } = useT('decisions');
  const store = useRecommendationStore();
  const push = useDecisionNotice((s) => s.push);
  const nowMs = useAnalysis().data?.ds.timeline.nowMs;
  const [dialog, setDialog] = useState<'schedule' | 'reject' | null>(null);
  const a = availableActions(rec.status);
  const next = nextStatus(rec.status);
  const title = tx(`common:rec.title.${rec.id}`);
  const done = (status: RecommendationStatus) => push(rec.id, status);
  const btn = size === 'sm' ? 'sm' : 'md';

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label={`${t('actions.label')}: ${title}`}
    >
      {a.approve && (
        <Button
          size={btn}
          variant="default"
          onClick={() => {
            store.approve(rec.id);
            done('approved');
          }}
        >
          <Check aria-hidden="true" />
          {t('actions.approve')}
        </Button>
      )}
      {rec.status === 'proposed' && !compact && (
        <Button size={btn} variant="secondary" onClick={() => setDialog('schedule')}>
          <CalendarClock aria-hidden="true" />
          {t('actions.schedule')}
        </Button>
      )}
      {rec.status === 'proposed' && !compact && (
        <Button size={btn} variant="ghost" onClick={() => setDialog('reject')}>
          <X aria-hidden="true" />
          {t('actions.reject')}
        </Button>
      )}
      {a.advance && next && (
        <Button
          size={btn}
          variant="secondary"
          onClick={() => {
            store.setStatus(
              rec.id,
              next,
              rec.state.scheduledFor ? { scheduledFor: rec.state.scheduledFor } : undefined,
            );
            done(next);
          }}
        >
          <ChevronRight aria-hidden="true" />
          {tx(`actions.${next}`)}
        </Button>
      )}
      {a.reopen && (
        <Button
          size={btn}
          variant="ghost"
          onClick={() => {
            store.setStatus(rec.id, 'proposed');
            done('proposed');
          }}
        >
          <Undo2 aria-hidden="true" />
          {t('actions.reopen')}
        </Button>
      )}
      {(compact || rec.status !== 'proposed') && (a.schedule || a.reject) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`${t('actions.more')}: ${title}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {a.schedule && (
              <DropdownMenuItem onSelect={() => setDialog('schedule')}>
                <CalendarClock aria-hidden="true" />
                {t('actions.schedule')}
              </DropdownMenuItem>
            )}
            {a.reject && (
              <DropdownMenuItem onSelect={() => setDialog('reject')}>
                <X aria-hidden="true" />
                {t('actions.reject')}
              </DropdownMenuItem>
            )}
            {rec.status !== 'proposed' && (
              <DropdownMenuItem
                onSelect={() => {
                  store.setStatus(rec.id, 'proposed');
                  done('proposed');
                }}
              >
                <Undo2 aria-hidden="true" />
                {t('actions.reopen')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {dialog === 'schedule' && nowMs !== undefined && (
        <ScheduleDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={title}
          nowMs={nowMs}
          initial={rec.state.scheduledFor}
          onConfirm={(ms) => {
            store.schedule(rec.id, ms);
            done('scheduled');
          }}
        />
      )}
      {dialog === 'reject' && (
        <RejectDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={title}
          onConfirm={(reason, note) => {
            store.reject(rec.id, reason, note || undefined);
            done('rejected');
          }}
        />
      )}
    </div>
  );
}
