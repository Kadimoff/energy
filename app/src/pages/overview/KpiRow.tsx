import { Banknote, Factory, Gauge, Leaf, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { KpiCard, type KpiTone } from '@/components/kpi/KpiCard';
import { KpiRowSkeleton } from '@/components/common/Skeletons';
import type { BudgetHero } from '@/domain/insights';
import type { MonthOverview } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatAzn, formatEnpi, formatMwh, formatPct, formatTCo2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { KpiKey } from './roleLayout';

interface Def {
  label: string;
  value: number;
  format: (v: number) => string;
  deltaPct: number;
  spark: number[];
  ref?: number;
  hint: ReactNode;
  tone: KpiTone;
  icon: typeof Banknote;
  to: string;
  goodWhen?: 'down' | 'up';
}

const STATE_TONE = { over: 'danger', risk: 'warning', within: 'success' } as const;

/** Five KPI cards (spec 7.3); the first one in the role order is featured (wider). */
export function KpiRow({
  ov,
  hero,
  order,
}: {
  ov?: MonthOverview;
  hero?: BudgetHero;
  order: KpiKey[];
}) {
  const { t } = useT('overview');
  if (!ov || !hero) return <KpiRowSkeleton />;
  const defs: Record<KpiKey, Def> = {
    consumption: {
      label: t('kpi.consumption'),
      value: ov.consumptionKwh.value,
      format: (v) => formatMwh(v),
      deltaPct: ov.consumptionKwh.deltaPct,
      spark: ov.consumptionKwh.spark,
      hint: t('kpi.consumptionHint', { days: ov.daysElapsed }),
      tone: 'neutral',
      icon: Factory,
      to: '/equipment',
    },
    cost: {
      label: t('kpi.cost'),
      value: ov.costAzn.value,
      format: (v) => formatAzn(v),
      deltaPct: ov.costAzn.deltaPct,
      spark: ov.costAzn.spark,
      ref: ov.costAzn.budgetAzn,
      hint: t('kpi.costHint', {
        forecast: formatAzn(ov.costAzn.forecastAzn),
        budget: formatAzn(ov.costAzn.budgetAzn),
      }),
      tone: STATE_TONE[hero.state],
      icon: Banknote,
      to: '/forecast',
    },
    enpi: {
      label: t('kpi.enpi'),
      value: ov.enpi.value,
      format: (v) => formatEnpi(v),
      deltaPct: ov.enpi.deltaPct,
      spark: ov.enpi.spark,
      ref: ov.enpi.targetKwhPerT,
      hint: t('kpi.enpiHint', { target: formatEnpi(ov.enpi.targetKwhPerT) }),
      tone: ov.enpi.value > ov.enpi.targetKwhPerT ? 'warning' : 'success',
      icon: Gauge,
      to: '/mv',
    },
    co2: {
      label: t('kpi.co2'),
      value: ov.co2T.value,
      format: (v) => formatTCo2(v),
      deltaPct: ov.co2T.deltaPct,
      spark: ov.co2T.spark,
      hint: t('kpi.co2Hint', {
        forecast: formatTCo2(ov.co2T.forecastT, 0),
        target: formatTCo2(ov.co2T.monthlyTargetT, 0),
      }),
      tone: ov.co2T.forecastT > ov.co2T.monthlyTargetT ? 'warning' : 'success',
      icon: Leaf,
      to: '/carbon',
    },
    waste: {
      label: t('kpi.waste'),
      value: ov.waste.value,
      format: (v) => formatAzn(v),
      deltaPct: ov.waste.deltaPct,
      spark: ov.waste.spark,
      hint: t('kpi.wasteHint', { pct: formatPct(ov.waste.sharePct, 1) }),
      tone: 'warning',
      icon: TriangleAlert,
      to: '/anomalies',
    },
  };
  return (
    <section
      aria-label={t('title')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]"
    >
      {order.map((k, i) => {
        const d = defs[k];
        return (
          <KpiCard
            key={k}
            label={d.label}
            value={d.value}
            format={d.format}
            deltaPct={d.deltaPct}
            deltaLabel={t('kpi.delta')}
            goodWhen={d.goodWhen}
            sparkline={d.spark}
            sparkReference={d.ref}
            hint={d.hint}
            tone={d.tone}
            icon={d.icon}
            to={d.to}
            className={cn(
              i === 0 && 'sm:col-span-2',
              i < 2 ? 'lg:col-span-3' : 'lg:col-span-2',
              'xl:col-span-1',
            )}
          />
        );
      })}
    </section>
  );
}
