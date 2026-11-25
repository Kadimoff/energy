import {
  BadgeCheck,
  Banknote,
  CircleGauge,
  ClipboardList,
  Leaf,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { CumulativeSavingsChart } from '@/components/charts/analytics/CumulativeSavingsChart';
import { SourceTooltip } from '@/components/common/SourceTooltip';
import { KpiCard } from '@/components/kpi/KpiCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { baseConfig } from '@/data/config';
import type { CumulativeMeasurePoint, MvSummary } from '@/domain/analytics/mvView';
import type { MeasureResult, MvOptions, MvStatus } from '@/domain/mv';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatMwh,
  formatNumber,
  formatPct,
  formatShare,
  formatTCo2,
  NBSP,
  UNITS,
} from '@/lib/format';
import { useRates } from '@/stores/derived';

const statusVariant: Record<MvStatus, 'success' | 'warning' | 'info'> = {
  verified: 'success',
  below_expected: 'warning',
  measuring: 'info',
};

/** Status badge with icon (never colour alone). */
export function MvStatusBadge({ status }: { status: MvStatus }) {
  const { tx } = useT('mv');
  const Icon =
    status === 'verified' ? BadgeCheck : status === 'below_expected' ? TriangleAlert : CircleGauge;
  return (
    <Badge variant={statusVariant[status]}>
      <Icon aria-hidden="true" />
      {tx(`common:mvStatus.${status}`)}
    </Badge>
  );
}

/** Scope 2 factor tooltip for avoided CO₂. */
export function Scope2Tooltip() {
  const { t } = useT('mv');
  const rates = useRates();
  const s2 = baseConfig.emissions.scope2;
  return (
    <SourceTooltip
      label={t('kpi.co2Hint')}
      value={`${formatNumber(rates.scope2KgCo2PerKwh, 2)}${NBSP}${UNITS.kgCo2}/${UNITS.kwh}`}
      source={s2.source}
      date={s2.date}
      lastChecked={s2.lastChecked}
      verify={s2.verify}
    />
  );
}

/** KPI row: verified saving (AZN, MWh, CO₂), monthly rate and payback, measure statuses. */
export function MvKpis({ s, cumulative }: { s: MvSummary; cumulative: CumulativeMeasurePoint[] }) {
  const { t } = useT('mv');
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        label={t('kpi.verifiedAzn')}
        value={s.verifiedAzn}
        format={(v) => formatAzn(v)}
        icon={Banknote}
        tone="success"
        hint={t('kpi.verifiedAznHint', { count: s.verifiedCount })}
        sparkline={cumulative.map((c) => c.verifiedAzn)}
        className="sm:col-span-2 xl:col-span-1"
      />
      <KpiCard
        label={t('kpi.verifiedKwh')}
        value={s.verifiedKwh}
        format={(v) => formatMwh(v, 1)}
        icon={CircleGauge}
        hint={t('kpi.verifiedKwhHint', { value: formatPct(s.achievedPct) })}
        sparkline={cumulative.map((c) => c.verifiedKwh)}
      />
      <KpiCard
        label={t('kpi.co2')}
        value={s.verifiedTCo2}
        format={(v) => formatTCo2(v, 1)}
        icon={Leaf}
        hint={
          <span className="inline-flex items-center gap-0.5">
            {t('kpi.co2Hint')}
            <Scope2Tooltip />
          </span>
        }
      />
      <KpiCard
        label={t('kpi.monthly')}
        value={s.monthlyAzn}
        format={(v) => formatAzn(v)}
        icon={Banknote}
        hint={t('kpi.monthlyHint', {
          investment: formatAzn(s.investmentAzn),
          payback:
            s.paybackMonths === 0
              ? t('kpi.paybackNone')
              : t('kpi.paybackMonths', { value: formatNumber(s.paybackMonths, 1) }),
        })}
      />
      <KpiCard
        label={t('kpi.measures')}
        value={s.total}
        format={(v) => formatNumber(v)}
        icon={ClipboardList}
        hint={t('kpi.measuresHint', {
          verified: s.counts.verified,
          below: s.counts.below_expected,
          measuring: s.counts.measuring,
        })}
        footer={
          s.preliminaryKwh !== 0
            ? t('kpi.preliminary', { value: formatMwh(s.preliminaryKwh, 1) })
            : undefined
        }
      />
    </section>
  );
}

/** Cumulative verified savings chart with the IPMVP method explainer. */
export function CumulativeCard({
  points,
  measures,
  options,
}: {
  points: CumulativeMeasurePoint[];
  measures: MeasureResult[];
  options: MvOptions;
}) {
  const { t, tx } = useT('mv');
  const [unit, setUnit] = useState<'azn' | 'mwh'>('azn');
  const last = points[points.length - 1];
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('cumulative.title')}</CardTitle>
            <CardDescription>{t('cumulative.subtitle')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CumulativeSavingsChart
            points={points}
            unit={unit}
            measures={measures.map((m) => ({
              id: m.id,
              label: `${tx(`common:measure.${m.id}`)}${
                m.status === 'measuring' ? ` (${t('cumulative.preliminary')})` : ''
              }`,
              preliminary: m.status === 'measuring',
            }))}
            labels={{
              title: t('cumulative.title'),
              summary: last
                ? t('cumulative.summary', {
                    value: unit === 'azn' ? formatAzn(last.totalAzn) : formatMwh(last.totalKwh),
                  })
                : '',
              month: t('cumulative.month'),
              total: t('cumulative.total'),
            }}
            toolbar={
              <Tabs value={unit} onValueChange={(v) => setUnit(v as 'azn' | 'mwh')}>
                <TabsList aria-label={t('cumulative.unit')}>
                  <TabsTrigger value="azn">{t('cumulative.azn')}</TabsTrigger>
                  <TabsTrigger value="mwh">{t('cumulative.mwh')}</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
        </CardContent>
      </Card>
      <Card className="bg-bg-subtle">
        <CardHeader>
          <CardTitle>{t('method.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-13 text-ink-2">
          <p className="rounded-md border border-border bg-surface px-3 py-2 font-semibold text-ink">
            {t('method.formula')}
          </p>
          <p>{t('method.adjusted', { days: options.baselineDays })}</p>
          <p>{t('method.why')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('method.optionB')}</li>
            <li>{t('method.optionC')}</li>
          </ul>
          <p className="text-xs text-ink-3">
            {t('method.rules', {
              settle: options.settleDays,
              min: options.minReportDays,
              share: formatShare(options.verifiedShare),
              conf: formatShare(options.confidence),
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
