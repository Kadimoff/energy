import { ScopeBarsChart } from '@/components/charts/analytics/ScopeBarsChart';
import { ChartSkeleton, KpiRowSkeleton, TableSkeleton } from '@/components/common/Skeletons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n';
import { formatIntensity, formatMonthYear, formatTCo2 } from '@/lib/format';
import { CarbonKpis } from './CarbonKpis';
import { FactorsTable, RoadmapCard, SourcesCard } from './CarbonCards';
import { CbamSection } from './CbamSection';
import { FactorNote } from './FactorNote';
import { useCarbonPage } from './hooks';

/** Route "/carbon": spec 7.9 Karbon with the CBAM readiness subsection (5.6, 5.7). */
export default function CarbonPage() {
  const { t } = useT('carbon');
  const vm = useCarbonPage();
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {!vm ? (
        <div aria-busy="true" className="space-y-6">
          <span className="sr-only">{t('states.loading')}</span>
          <KpiRowSkeleton />
          <ChartSkeleton height={300} />
          <TableSkeleton rows={5} />
        </div>
      ) : (
        <div className="space-y-6">
          <CarbonKpis year={vm.year} months={vm.months} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{t('monthly.title')}</CardTitle>
                  <CardDescription>{t('monthly.subtitle')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ScopeBarsChart
                  height={400}
                  months={vm.months}
                  labels={{
                    title: t('monthly.title'),
                    summary: (() => {
                      const last = vm.months.filter((m) => m.complete).at(-1);
                      return last
                        ? t('monthly.summary', {
                            month: formatMonthYear(last.start),
                            total: formatTCo2(last.totalT, 0),
                            intensity: formatIntensity(last.intensityKgPerT),
                          })
                        : '';
                    })(),
                    month: t('monthly.month'),
                    scope1: t('monthly.scope1'),
                    scope2: t('monthly.scope2'),
                    total: t('monthly.total'),
                    intensity: t('monthly.intensity'),
                    partial: t('monthly.partial'),
                  }}
                />
                <FactorNote kinds={['scope1', 'scope2']} short className="mt-3 text-xs" />
              </CardContent>
            </Card>
            <SourcesCard sources={vm.sources} year={vm.year.year} />
          </div>
          <RoadmapCard roadmap={vm.roadmap} period={{ from: vm.l12.from, to: vm.l12.to }} />
          <FactorsTable rows={vm.factors} />
          <CbamSection kwh={vm.last12.kwh} m3={vm.last12.m3} tons={vm.last12.tons} />
        </div>
      )}
    </>
  );
}
