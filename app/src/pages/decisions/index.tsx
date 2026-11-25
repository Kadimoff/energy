import { useReducedMotion } from 'framer-motion';
import { Columns3, List } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { DecisionNotice } from '@/components/ai/decision/DecisionNotice';
import { EmptyState } from '@/components/common/EmptyState';
import { ChartSkeleton, TableSkeleton } from '@/components/common/Skeletons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EMPTY_FILTERS,
  filterDecisions,
  type DecisionFilters as Filters,
} from '@/domain/decisions';
import { useT } from '@/i18n';
import { usePriorityMatrix } from '@/stores/coreViews';
import { useRecommendations } from '@/stores/derived';
import { DecisionCard } from './DecisionCard';
import { DecisionFilters } from './DecisionFilters';
import { DecisionSummary } from './DecisionSummary';
import { KanbanBoard } from './KanbanBoard';
import { PriorityMatrix } from './PriorityMatrix';
import { DeferredSection } from '@/components/common/DeferredSection';

/** cards rendered with the page; the rest follows after the first paint */
const FIRST_CARDS = 3;

type View = 'list' | 'kanban';

/** Route "/decisions": AI Decision Center (spec 7.6). */
export default function DecisionsPage() {
  const { t } = useT('decisions');
  const recs = useRecommendations();
  const matrix = usePriorityMatrix(recs?.items);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'kanban' ? 'kanban' : 'list';
  const focusId = params.get('rec');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const reduce = useReducedMotion();

  const shown = useMemo(() => (recs ? filterDecisions(recs.items, filters) : []), [recs, filters]);
  // a focused decision (from palette, copilot or matrix) must stay visible
  const focusHidden = !!focusId && !!recs && !shown.some((v) => v.id === focusId);
  const effectiveFilters = focusHidden ? EMPTY_FILTERS : filters;
  const list = focusHidden && recs ? recs.items : shown;

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'kanban') next.set('view', 'kanban');
    else next.delete('view');
    setParams(next, { replace: true });
  };
  const open = (id: string) => {
    if (!shown.some((v) => v.id === id)) setFilters(EMPTY_FILTERS);
    const next = new URLSearchParams(params);
    next.delete('view');
    next.set('rec', id);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!focusId || view !== 'list' || !recs) return;
    const el = document.getElementById(`rec-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [focusId, view, recs, reduce]);

  const card = (v: (typeof list)[number]) => (
    <DecisionCard
      key={v.id}
      rec={v}
      highlighted={v.id === focusId}
      defaultWhyOpen={v.id === focusId}
    />
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList aria-label={t('view.label')}>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t('view.list')}
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5">
                <Columns3 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t('view.kanban')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {recs ? (
        <DecisionSummary summary={recs.summary} />
      ) : (
        <Skeleton className="h-[148px] rounded-card" />
      )}

      <div className="mt-8">
        {recs ? (
          <DecisionFilters
            value={effectiveFilters}
            onChange={(f) => {
              if (focusId) {
                const next = new URLSearchParams(params);
                next.delete('rec');
                setParams(next, { replace: true });
              }
              setFilters(f);
            }}
            shown={list.length}
          />
        ) : (
          <Skeleton className="h-16 rounded-md" />
        )}
      </div>

      {view === 'kanban' ? (
        <div className="mt-5 space-y-6">
          {recs ? <KanbanBoard items={list} onOpen={open} /> : <TableSkeleton rows={4} />}
          {recs && matrix && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{t('matrix.title')}</CardTitle>
                  <CardDescription>{t('matrix.subtitle')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <PriorityMatrix matrix={matrix} items={recs.items} onSelect={open} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-labelledby="decisions-list-title" className="min-w-0 space-y-4">
            <h2 id="decisions-list-title" className="sr-only">
              {t('list.title')}
            </h2>
            {!recs ? (
              <TableSkeleton rows={5} />
            ) : list.length === 0 ? (
              <Card>
                <EmptyState
                  title={t('list.emptyTitle')}
                  body={t('list.emptyBody')}
                  action={{ label: t('filters.reset'), onClick: () => setFilters(EMPTY_FILTERS) }}
                />
              </Card>
            ) : (
              <>
                {list.slice(0, focusId ? list.length : FIRST_CARDS).map(card)}
                {!focusId && list.length > FIRST_CARDS && (
                  // the rest is below the fold: rendered after the first paint
                  <DeferredSection minHeight={(list.length - FIRST_CARDS) * 236}>
                    <div className="space-y-4">{list.slice(FIRST_CARDS).map(card)}</div>
                  </DeferredSection>
                )}
              </>
            )}
          </section>
          <aside className="order-first xl:order-none" aria-label={t('matrix.title')}>
            <div className="space-y-3 xl:sticky xl:top-24">
              {recs && matrix ? (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {t('matrix.title')}
                        <AiBadge variant="soft" />
                      </CardTitle>
                      <CardDescription>{t('matrix.subtitle')}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PriorityMatrix matrix={matrix} items={recs.items} onSelect={open} />
                  </CardContent>
                </Card>
              ) : (
                <ChartSkeleton height={260} />
              )}
              <p className="px-1 text-xs text-ink-3">{t('list.rejectedHint')}</p>
            </div>
          </aside>
        </div>
      )}
      <DecisionNotice />
    </>
  );
}
