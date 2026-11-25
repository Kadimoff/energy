import { AiBadge } from '@/components/ai/AiBadge';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatEnpi,
  formatMonthYear,
  formatMwh,
  formatPct,
  formatShare,
  formatSigned,
  formatTCo2,
  formatTons,
} from '@/lib/format';
import type { BudgetLine, DirectorReport } from '@/services/ReportService';
import { ReportBandChart } from './ReportCharts';
import { ReportSheet } from './ReportSheet';
import { BudgetBar, BudgetStateBadge, Figure, SheetSection, SheetTable } from './sheet-ui';

const pctDelta = (v: number, p: number) => (p > 0 ? (v / p - 1) * 100 : 0);

/** Monthly director report: exactly one A4 page (spec 7.11). */
export function DirectorReportView({ report: r }: { report: DirectorReport }) {
  const { t, tx } = useT('reports');
  const f = r.figures;
  const e = f.electricity;
  const perMonth = t('common:units.perMonth');
  const top = r.topWaste[0];
  const cur = r.period.isCurrent;

  const summary: string[] = [];
  if (cur) {
    summary.push(
      e.state === 'within'
        ? t('director.sumWithin', {
            projected: formatAzn(e.projectedAzn),
            reserve: formatAzn(-e.overrunAzn),
          })
        : t('director.sumRisk', {
            projected: formatAzn(e.projectedAzn),
            budget: formatAzn(e.budgetAzn),
            prob: formatShare(e.probability ?? 0),
          }),
    );
  } else {
    summary.push(
      t(e.overrunAzn > 0 ? 'director.sumClosedOver' : 'director.sumClosedWithin', {
        month: formatMonthYear(r.period.start),
        cost: formatAzn(e.projectedAzn),
        budget: formatAzn(e.budgetAzn),
        delta: formatAzn(Math.abs(e.overrunAzn)),
      }),
    );
  }
  if (top)
    summary.push(
      t('director.sumWaste', {
        waste: formatAzn(f.wasteAzn),
        share: formatPct(f.wasteSharePct, 1),
        eq: top.code,
        eqAzn: formatAzn(top.wasteAzn),
      }),
    );
  if (r.next.items.length)
    summary.push(
      t('director.sumRecs', {
        n: r.next.items.length,
        azn: formatAzn(r.next.combinedAznPerMonth),
      }),
    );

  const budgetRow = (b: BudgetLine) => (
    <div key={b.energy} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink">{t(`common:energy.${b.energy}`)}</span>
        <BudgetStateBadge state={b.state} />
      </div>
      <BudgetBar
        projected={b.projectedAzn}
        p10={b.p10Azn}
        p90={b.p90Azn}
        budget={b.budgetAzn}
        state={b.state}
        label={t('director.budgetBarAria', {
          energy: t(`common:energy.${b.energy}`),
          projected: formatAzn(b.projectedAzn),
          budget: formatAzn(b.budgetAzn),
        })}
      />
      <p className="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-ink-2">
        <span>
          {cur ? t('director.projected') : t('director.actualCost')}:{' '}
          <strong className="font-semibold text-ink">{formatAzn(b.projectedAzn)}</strong>
          {' / '}
          {formatAzn(b.budgetAzn)}
        </span>
        {b.probability !== null && (
          <span>{t('director.probability', { p: formatShare(b.probability) })}</span>
        )}
      </p>
    </div>
  );

  return (
    <ReportSheet report={r} page={1} pages={1}>
      <section className="rounded-[10px] border border-violet-100 bg-violet-50/60 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <AiBadge label={t('director.summaryBadge')} />
          <h3 className="text-[13px] font-semibold">{t('director.summary')}</h3>
        </div>
        <p className="text-[13px] leading-5 text-ink">{summary.join(' ')}</p>
      </section>

      <SheetSection title={t('director.keyFigures')}>
        <div className="grid grid-cols-4 gap-2">
          <Figure
            label={t('director.consumption')}
            value={formatMwh(f.kwh)}
            hint={t('director.vsPrev', {
              d: formatSigned(pctDelta(f.kwh, f.prev.kwh), (v) => formatPct(v, 1)),
            })}
          />
          <Figure
            label={t('director.costToDate')}
            value={formatAzn(f.totalCostToDateAzn)}
            hint={t('director.costSplit', { g: formatAzn(f.gas.costToDateAzn) })}
          />
          <Figure
            strong
            label={cur ? t('director.costProjected') : t('director.costMonth')}
            value={formatAzn(f.totalProjectedAzn)}
            hint={t('director.budgetOf', { budget: formatAzn(f.totalBudgetAzn) })}
            tone={f.totalProjectedAzn > f.totalBudgetAzn ? 'danger' : 'success'}
          />
          <Figure
            label={t('director.enpi')}
            value={formatEnpi(f.enpi)}
            hint={t('director.target', { v: formatEnpi(f.enpiTarget) })}
            tone={f.enpi <= f.enpiTarget ? 'success' : 'warning'}
          />
          <Figure
            label={cur ? t('director.co2Forecast') : t('director.co2')}
            value={formatTCo2(cur ? f.co2ForecastT : f.co2.totalT)}
            hint={t('director.co2Target', { target: formatTCo2(f.co2MonthlyTargetT, 0) })}
            tone={
              (cur ? f.co2ForecastT : f.co2.totalT) <= f.co2MonthlyTargetT ? 'success' : 'warning'
            }
          />
          <Figure
            label={t('director.waste')}
            value={formatAzn(f.wasteAzn)}
            hint={t('director.wasteShare', { share: formatPct(f.wasteSharePct, 1) })}
            tone="warning"
          />
          <Figure
            label={t('director.production')}
            value={formatTons(f.tons)}
            hint={t('director.productionHint', { days: f.days })}
          />
          <Figure
            label={t('director.verified')}
            value={`${formatAzn(r.savings.verifiedPerMonthAzn)}${perMonth}`}
            hint={t('director.verifiedHint', { n: r.savings.verifiedCount })}
            tone="success"
          />
        </div>
      </SheetSection>

      <div className="grid grid-cols-2 gap-5">
        <SheetSection title={t('director.budget')}>
          <div className="space-y-3">
            {budgetRow(e)}
            {budgetRow(f.gas)}
            <p className="text-[11px] leading-4 text-ink-3">{t('director.budgetLegend')}</p>
          </div>
        </SheetSection>
        <SheetSection title={t('director.dailyChart')}>
          <ReportBandChart
            points={r.daily}
            width={347}
            height={150}
            label={t('director.dailyChartAria', { month: formatMonthYear(r.period.start) })}
          />
        </SheetSection>
      </div>

      <div className="grid grid-cols-[0.85fr_1.15fr] gap-5">
        <SheetSection title={t('director.topWaste')}>
          <SheetTable
            caption={t('director.topWaste')}
            rows={r.topWaste}
            rowKey={(w) => w.eqId}
            empty={t('director.noWaste')}
            columns={[
              {
                key: 'eq',
                header: t('director.colEquipment'),
                cell: (w) => (
                  <>
                    <span className="font-medium">{w.code}</span>
                    <span className="block text-[11px] leading-4 text-ink-3">
                      {w.rule ? tx(`common:rule.${w.rule}`) : t('director.reasonBand')}
                    </span>
                  </>
                ),
              },
              {
                key: 'azn',
                header: t('director.colLoss'),
                align: 'right',
                cell: (w) => formatAzn(w.wasteAzn),
              },
              {
                key: 'share',
                header: t('director.colShare'),
                align: 'right',
                cell: (w) => formatPct(w.sharePct, 0),
              },
            ]}
          />
        </SheetSection>
        <SheetSection
          title={t('director.savings')}
          aside={t('director.cumulative', { v: formatAzn(r.savings.cumulativeAzn) })}
        >
          <SheetTable
            caption={t('director.savings')}
            rows={r.savings.items}
            rowKey={(m) => m.id}
            columns={[
              {
                key: 'm',
                header: t('director.colMeasure'),
                cell: (m) => <span className="line-clamp-1">{tx(`common:measure.${m.id}`)}</span>,
              },
              {
                key: 'st',
                header: t('director.colStatus'),
                cell: (m) => (
                  <Badge
                    variant={
                      m.status === 'verified'
                        ? 'success'
                        : m.status === 'below_expected'
                          ? 'warning'
                          : 'neutral'
                    }
                    className="px-1.5 py-0 text-[11px]"
                  >
                    {tx(`common:mvStatus.${m.status}`)}
                  </Badge>
                ),
              },
              {
                key: 'azn',
                header: t('director.colPerMonth'),
                align: 'right',
                cell: (m) => formatAzn(m.avoidedPerMonthAzn),
              },
            ]}
          />
        </SheetSection>
      </div>

      <SheetSection title={t('director.nextMonth')} aside={<AiBadge variant="soft" />}>
        <SheetTable
          caption={t('director.nextMonth')}
          rows={r.next.items}
          rowKey={(x) => x.id}
          empty={t('director.noRecs')}
          columns={[
            {
              key: 'title',
              header: t('director.colRec'),
              cell: (x) => tx(`common:rec.title.${x.id}`),
            },
            {
              key: 'effort',
              header: t('director.colEffort'),
              cell: (x) => tx(`common:effort.${x.effort}`),
            },
            {
              key: 'azn',
              header: t('director.colAznMonth'),
              align: 'right',
              cell: (x) => formatAzn(x.aznPerMonth),
            },
            {
              key: 'co2',
              header: t('director.colCo2Year'),
              align: 'right',
              cell: (x) => formatTCo2(x.tCo2PerYear),
            },
          ]}
        />
        {r.next.forecast && (
          <p className="mt-2 text-xs leading-5 text-ink-2">
            {t('director.nextForecast', {
              month: formatMonthYear(r.next.forecast.start),
              cost: formatAzn(r.next.forecast.costAzn),
              budget: formatAzn(r.next.forecast.budgetAzn),
              prob: formatShare(r.next.forecast.probability),
              costWith: formatAzn(r.next.forecast.costWithRecsAzn),
              probWith: formatShare(r.next.forecast.probabilityWithRecs),
            })}
          </p>
        )}
      </SheetSection>
    </ReportSheet>
  );
}
