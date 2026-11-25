import { ClipboardList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ChartSkeleton, KpiRowSkeleton, TableSkeleton } from '@/components/common/Skeletons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { useT } from '@/i18n';
import { useMvPage } from './hooks';
import { MeasureDetail, MeasuresTable } from './MeasureParts';
import { CumulativeCard, MvKpis } from './MvOverview';

/** Route "/mv": spec 7.10 Qənaət və yoxlama (IPMVP, spec 5.8). */
export default function MvPage() {
  const { t } = useT('mv');
  const vm = useMvPage();
  const [params, setParams] = useSearchParams();
  const requested = params.get('m');
  const selected =
    vm && (vm.rows.find((r) => r.result.id === requested)?.result.id ?? vm.rows[0]?.result.id);

  const select = (id: string) => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('m', id);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
    requestAnimationFrame(() => {
      const el = document.getElementById('measure-detail');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {!vm ? (
        <div aria-busy="true" className="space-y-6">
          <span className="sr-only">{t('states.loading')}</span>
          <KpiRowSkeleton />
          <ChartSkeleton height={280} />
          <TableSkeleton rows={4} cols={6} />
        </div>
      ) : vm.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={t('table.empty')}
            body={t('table.emptyBody')}
            action={{ label: t('table.emptyAction'), to: '/decisions' }}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <MvKpis s={vm.summary} cumulative={vm.cumulative} />
          <CumulativeCard
            points={vm.cumulative}
            measures={vm.rows.map((r) => r.result)}
            options={vm.options}
          />
          <MeasuresTable
            rows={vm.rows}
            equipment={vm.equipment}
            selected={selected ?? null}
            onSelect={select}
          />
          {selected && (
            <MeasureDetail
              key={selected}
              id={selected}
              equipment={vm.equipment}
              cvLimit={vm.cvLimit}
            />
          )}
        </div>
      )}
    </>
  );
}
