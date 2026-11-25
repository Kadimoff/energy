import { AlertTriangle, CalendarClock, ShieldCheck, Wrench, XCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { WhyPanel } from '@/components/ai/WhyPanel';
import { DecisionActions } from '@/components/ai/decision/DecisionActions';
import { DecisionStatusBadge } from '@/components/ai/decision/DecisionStatusBadge';
import { ActualVsOptimalChart } from '@/components/charts/ActualVsOptimalChart';
import { ChartSkeleton } from '@/components/common/Skeletons';
import type { RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDate,
  formatEnergy,
  formatKw,
  formatM3,
  formatNumber,
  formatPct,
  formatTCo2,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvidence } from '@/stores/coreViews';

function Evidence({ rec }: { rec: RecommendationVM }) {
  const { t } = useT('decisions');
  const ev = useEvidence(rec);
  const names = rec.equipmentNames.join(', ');
  if (!ev) return <ChartSkeleton height={180} className="border-0 p-0 shadow-none" />;
  return (
    <div className="mt-1 rounded-md border border-border bg-surface p-3">
      <p className="mb-1 text-xs text-ink-3">
        {ev.range.resolution === 'hour'
          ? t('why.hourly')
          : t('why.daily', { days: ev.range.toDay - ev.range.fromDay })}
      </p>
      <ActualVsOptimalChart
        points={ev.points}
        title={t('why.compare', { equipment: names })}
        unit={ev.unit}
        resolution={ev.range.resolution}
        height={180}
        allowCumulative={false}
        showForecast={false}
        showBudget={false}
      />
    </div>
  );
}

const RISK_ICON = { none: ShieldCheck, low: AlertTriangle, medium: AlertTriangle } as const;

export interface DecisionCardProps {
  rec: RecommendationVM;
  highlighted?: boolean;
  defaultWhyOpen?: boolean;
}

/** AI decision card (spec 7.6): impact, effort, risk, confidence, "Niyə?", actions. */
export function DecisionCard({ rec, highlighted, defaultWhyOpen }: DecisionCardProps) {
  const { t, tx } = useT('decisions');
  const title = tx(`common:rec.title.${rec.id}`);
  const gas = rec.energy === 'gas';
  const RiskIcon = RISK_ICON[rec.riskLevel];
  const dim = rec.status === 'rejected';
  return (
    <article
      id={`rec-${rec.id}`}
      aria-labelledby={`rec-${rec.id}-title`}
      className={cn(
        'card relative scroll-mt-24 overflow-hidden transition-[box-shadow,border-color] duration-180',
        highlighted && 'border-violet-300 shadow-md ring-2 ring-violet-200',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-[3px]', dim ? 'bg-border-strong' : 'bg-ai')}
      />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <div className="flex flex-wrap items-center gap-2">
          <AiBadge variant="soft" />
          <span className="text-xs text-ink-3">
            {tx(`common:category.${rec.category}`)} · {tx(`common:group.${rec.group}`)}
          </span>
          <span className="ml-auto">
            <DecisionStatusBadge status={rec.status} />
          </span>
        </div>
        <h3
          id={`rec-${rec.id}-title`}
          className={cn('mt-3 text-base font-semibold leading-snug text-ink', dim && 'text-ink-2')}
        >
          {title}
        </h3>
        <p className="mt-1.5 max-w-3xl text-sm text-ink-2">{tx(`common:rec.desc.${rec.id}`)}</p>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span>{t('card.equipment')}:</span>
          {rec.equipmentIds.map((id, i) => (
            <Link
              key={id}
              to={`/equipment/${id}`}
              className="rounded-[6px] bg-bg-subtle px-1.5 py-0.5 font-medium text-ink-2 hover:bg-violet-50 hover:text-violet-700"
            >
              {rec.equipmentNames[i]}
            </Link>
          ))}
          {rec.status === 'scheduled' && rec.state.scheduledFor && (
            <span className="flex items-center gap-1 text-info-text">
              <CalendarClock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('card.scheduledFor', { date: formatDate(rec.state.scheduledFor) })}
            </span>
          )}
          {rec.status === 'rejected' && rec.state.rejectReason && (
            <span className="flex items-center gap-1 text-ink-2">
              <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('card.rejectedReason', {
                reason: tx(`common:rejectReason.${rec.state.rejectReason}`),
              })}
              {rec.state.rejectNote ? `: ${rec.state.rejectNote}` : ''}
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-4 md:grid-cols-[1.3fr_1fr_1fr_auto]">
          <div className="col-span-2 md:col-span-1">
            <dt className="text-xs text-ink-3">{t('card.impact')}</dt>
            <dd className="mt-1">
              <span className="text-xl font-semibold tabular-nums text-ink">
                {formatAzn(rec.aznPerMonth)}
              </span>
              <span className="ml-1 text-13 text-ink-3">{t('card.perMonth')}</span>
              <span className="mt-0.5 block text-xs tabular-nums text-ink-2">
                {gas ? formatM3(rec.m3PerMonth) : formatEnergy(rec.kwhPerMonth)}/
                {tx('common:units.months')} · {formatTCo2(rec.tCo2PerYear)}
                {tx('common:units.perYear')}
              </span>
              {rec.peakKwReduction > 0 && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
                  <Zap className="size-3" strokeWidth={1.75} aria-hidden="true" />
                  {t('card.peak', { kw: formatKw(rec.peakKwReduction) })}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{t('card.effort')}</dt>
            <dd className="mt-1 text-13">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <Wrench className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
                {tx(`common:effort.${rec.effort}`)}
              </span>
              <span className="mt-0.5 block text-xs text-ink-2">
                {rec.investmentAzn > 0
                  ? `${t('card.investment', { azn: formatAzn(rec.investmentAzn) })} · ${t(
                      'card.payback',
                      {
                        months: formatNumber(rec.paybackMonths, rec.paybackMonths < 10 ? 1 : 0),
                      },
                    )}`
                  : t('card.paybackNow')}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{t('card.risk')}</dt>
            <dd className="mt-1 flex items-start gap-1.5 text-13 text-ink-2">
              <RiskIcon
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  rec.riskLevel === 'none' ? 'text-success' : 'text-warning',
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {tx(`common:${rec.riskKey}`)}
            </dd>
          </div>
          <div className="col-span-2 md:col-span-1">
            <dt className="text-xs text-ink-3">{t('card.confidence')}</dt>
            <dd className="mt-1.5">
              <ConfidenceMeter value={rec.confidence} size="sm" />
            </dd>
          </div>
        </dl>

        <div className="relative mt-4">
          <DecisionActions rec={rec} className="mb-3 sm:absolute sm:right-0 sm:top-0 sm:mb-0" />
          <WhyPanel
            defaultOpen={defaultWhyOpen}
            data={t('why.data', { equipment: rec.equipmentNames.join(', '), days: rec.windowDays })}
            rule={
              <>
                {t('why.rule', {
                  rules: rec.rules.map((r) => tx(`common:rule.${r}`)).join(', '),
                  capture: formatPct(rec.capture * 100),
                  pool: gas ? formatM3(rec.wastePoolPerMonth) : formatEnergy(rec.wastePoolPerMonth),
                })}
                {rec.anomalyIds.length > 0 && (
                  <Link
                    to="/anomalies"
                    className="ml-1 font-medium text-violet-700 hover:underline"
                  >
                    {t('card.linkedAnomalies', { count: rec.anomalyIds.length })}
                  </Link>
                )}
              </>
            }
            compare={<Evidence rec={rec} />}
          />
        </div>
      </div>
    </article>
  );
}
