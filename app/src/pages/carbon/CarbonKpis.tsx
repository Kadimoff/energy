import { Factory, Flame, Gauge, Leaf, Target, Zap } from 'lucide-react';
import { KpiCard } from '@/components/kpi/KpiCard';
import type { CarbonYear } from '@/domain/analytics/carbonView';
import type { CarbonMonth } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { formatIntensity, formatPct, formatShare, formatSigned, formatTCo2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FactorNote } from './FactorNote';

const formatCssPct = (share: number) => `${Math.max(0, Math.min(1, share)) * 100}%`;

/** KPI row (spec 7.9): total, Scope 1, Scope 2, intensity, target progress. */
export function CarbonKpis({ year, months }: { year: CarbonYear; months: CarbonMonth[] }) {
  const { t } = useT('carbon');
  const y = year.ytd;
  const thisYear = months.filter((m) => m.key.startsWith(String(year.year)));
  return (
    <section
      aria-label={t('kpi.ytdBasis')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      <KpiCard
        label={t('kpi.total', { year: year.year })}
        value={y.totalT}
        format={(v) => formatTCo2(v, 0)}
        icon={Leaf}
        hint={t('kpi.totalHint', { value: formatTCo2(year.yearEnd.totalT, 0) })}
        sparkline={thisYear.map((m) => m.totalT)}
        footer={<FactorNote kinds={['scope1', 'scope2']} short className="text-xs" />}
        className="sm:col-span-2 xl:col-span-1"
      />
      <KpiCard
        label={t('kpi.scope1')}
        value={y.scope1T}
        format={(v) => formatTCo2(v, 0)}
        icon={Flame}
        hint={t('kpi.share', { value: formatShare(y.scope1Share) })}
        sparkline={thisYear.map((m) => m.scope1T)}
        footer={<FactorNote kinds={['scope1']} short className="text-xs" />}
      />
      <KpiCard
        label={t('kpi.scope2')}
        value={y.scope2T}
        format={(v) => formatTCo2(v, 0)}
        icon={Zap}
        hint={t('kpi.share', { value: formatShare(year.scope2Share) })}
        sparkline={thisYear.map((m) => m.scope2T)}
        footer={<FactorNote kinds={['scope2']} short className="text-xs" />}
      />
      <KpiCard
        label={t('kpi.intensity')}
        value={y.intensityKgPerT}
        format={(v) => formatIntensity(v)}
        icon={Gauge}
        hint={t('kpi.intensityHint', { year: year.year })}
        sparkline={thisYear.filter((m) => m.complete).map((m) => m.intensityKgPerT)}
        footer={<FactorNote kinds={['scope1', 'scope2']} short className="text-xs" />}
      />
      <KpiCard
        label={t('kpi.target')}
        value={year.targetUsed}
        format={(v) => formatShare(v)}
        icon={year.onTrack ? Target : Factory}
        tone={year.onTrack ? 'success' : 'danger'}
        hint={
          year.onTrack
            ? t('kpi.onTrack')
            : t('kpi.offTrack', {
                value: formatSigned(year.yearEndVsTargetPct, (v) => formatPct(v, 1)),
              })
        }
        footer={
          <div className="space-y-1.5">
            <div
              className="relative h-2 overflow-hidden rounded-full bg-violet-100"
              role="img"
              aria-label={t('kpi.targetUsed', { value: formatShare(year.targetUsed) })}
            >
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  year.onTrack ? 'bg-success' : 'bg-danger',
                )}
                style={{ width: formatCssPct(year.targetUsed) }}
              />
              <span
                className="absolute inset-y-[-2px] w-0.5 bg-ink"
                style={{ left: formatCssPct(year.ytdTargetShare) }}
                aria-hidden="true"
              />
            </div>
            <p className="text-ink-3">
              {t('kpi.targetHint', {
                target: formatTCo2(year.targetT, 0),
                forecast: formatTCo2(year.yearEnd.totalT, 0),
              })}
              . {t('kpi.proRata', { value: formatTCo2(year.ytdTargetT, 0) })}
            </p>
          </div>
        }
      />
    </section>
  );
}
