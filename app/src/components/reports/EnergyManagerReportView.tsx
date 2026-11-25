import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDayMonth,
  formatEnergy,
  formatEnpi,
  formatKw,
  formatKwh,
  formatM3,
  formatMonthYear,
  formatNumber,
  formatPct,
  formatTCo2,
} from '@/lib/format';
import type { EnergyManagerReport } from '@/services/ReportService';
import type { RecommendationStatus, Severity } from '@/data/types';
import { ReportBandChart } from './ReportCharts';
import { ReportSheet } from './ReportSheet';
import { Figure, SheetSection, SheetTable } from './sheet-ui';
import { SavingsTable } from './SavingsTable';

const sevVariant: Record<Severity, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

const PIPE: RecommendationStatus[] = [
  'proposed',
  'approved',
  'scheduled',
  'in_progress',
  'measuring',
  'verified',
  'rejected',
];

/** Energy manager report: two A4 pages. */
export function EnergyManagerReportView({ report: r }: { report: EnergyManagerReport }) {
  const { t, tx } = useT('reports');
  const f = r.figures;
  const perMonth = t('common:units.perMonth');
  const fmtQty = (v: number, gas: boolean) => (gas ? formatM3(v) : formatEnergy(v));
  return (
    <>
      <ReportSheet report={r} page={1} pages={2}>
        <SheetSection title={t('director.keyFigures')}>
          <div className="grid grid-cols-3 gap-2">
            <Figure
              label={t('em.actual')}
              value={formatEnergy(f.kwh)}
              hint={t('em.optimalHint', { v: formatEnergy(f.optimalKwh) })}
            />
            <Figure
              label={t('em.waste')}
              value={formatEnergy(f.wasteKwh)}
              hint={t('em.wasteHint', {
                share: formatPct(f.wasteSharePct, 1),
                azn: formatAzn(f.wasteAzn),
              })}
              tone="warning"
            />
            <Figure
              label={t('director.enpi')}
              value={formatEnpi(f.enpi)}
              hint={t('director.target', { v: formatEnpi(f.enpiTarget) })}
              tone={f.enpi <= f.enpiTarget ? 'success' : 'warning'}
            />
            <Figure
              label={t('em.peak')}
              value={formatKw(r.peakKw)}
              hint={t('em.peakHint', { v: formatKw(r.peakLimitKw) })}
              tone={r.peakKw > r.peakLimitKw ? 'danger' : 'success'}
            />
            <Figure
              label={t('em.anomalies')}
              value={formatNumber(r.anomalies.total)}
              hint={t('em.anomaliesHint', {
                open: r.anomalies.open,
                azn: formatAzn(r.anomalies.lossAzn),
              })}
            />
            <Figure
              label={t('em.gas')}
              value={formatM3(f.m3)}
              hint={t('em.gasHint', { v: formatM3(f.wasteM3) })}
            />
          </div>
        </SheetSection>
        <SheetSection title={t('director.dailyChart')}>
          <ReportBandChart
            points={r.daily}
            height={200}
            label={t('director.dailyChartAria', { month: formatMonthYear(r.period.start) })}
          />
        </SheetSection>
        <SheetSection title={t('em.groups')}>
          <SheetTable
            caption={t('em.groups')}
            rows={r.groups}
            rowKey={(g) => g.group}
            columns={[
              { key: 'g', header: t('em.colGroup'), cell: (g) => tx(`common:group.${g.group}`) },
              {
                key: 'a',
                header: t('em.colActual'),
                align: 'right',
                cell: (g) => fmtQty(g.actual, g.energy === 'gas'),
              },
              {
                key: 'o',
                header: t('em.colOptimal'),
                align: 'right',
                cell: (g) => fmtQty(g.optimal, g.energy === 'gas'),
              },
              {
                key: 'w',
                header: t('em.colWaste'),
                align: 'right',
                cell: (g) => fmtQty(g.waste, g.energy === 'gas'),
              },
              {
                key: 'p',
                header: t('em.colWastePct'),
                align: 'right',
                cell: (g) => formatPct(g.wastePct, 1),
              },
              {
                key: 'z',
                header: t('em.colWasteAzn'),
                align: 'right',
                cell: (g) => formatAzn(g.wasteAzn),
              },
            ]}
          />
        </SheetSection>
        <SheetSection title={t('em.topWaste')}>
          <SheetTable
            caption={t('em.topWaste')}
            rows={r.topWaste}
            rowKey={(w) => w.eqId}
            columns={[
              {
                key: 'eq',
                header: t('director.colEquipment'),
                cell: (w) => `${w.code} · ${w.name}`,
              },
              {
                key: 'r',
                header: t('em.colReason'),
                cell: (w) => (w.rule ? tx(`common:rule.${w.rule}`) : t('director.reasonBand')),
              },
              {
                key: 'w',
                header: t('em.colWaste'),
                align: 'right',
                cell: (w) => fmtQty(w.waste, w.energy === 'gas'),
              },
              {
                key: 'z',
                header: t('director.colLoss'),
                align: 'right',
                cell: (w) => formatAzn(w.wasteAzn),
              },
            ]}
          />
        </SheetSection>
      </ReportSheet>

      <ReportSheet report={r} page={2} pages={2}>
        <SheetSection
          title={t('em.anomalyList')}
          aside={t('em.severityCounts', {
            c: r.anomalies.bySeverity.critical,
            h: r.anomalies.bySeverity.high,
            m: r.anomalies.bySeverity.medium,
            l: r.anomalies.bySeverity.low,
          })}
        >
          <SheetTable
            caption={t('em.anomalyList')}
            rows={r.anomalies.items}
            rowKey={(x) => x.id}
            empty={t('em.noAnomalies')}
            columns={[
              { key: 'd', header: t('em.colDate'), cell: (x) => formatDayMonth(x.start) },
              { key: 'r', header: t('em.colRule'), cell: (x) => tx(`common:rule.${x.rule}`) },
              {
                key: 'e',
                header: t('director.colEquipment'),
                cell: (x) => x.equipmentNames.join(', '),
              },
              {
                key: 's',
                header: t('em.colSeverity'),
                cell: (x) => (
                  <Badge variant={sevVariant[x.severity]} className="px-1.5 py-0 text-[11px]">
                    {tx(`common:severity.${x.severity}`)}
                  </Badge>
                ),
              },
              {
                key: 'l',
                header: t('director.colLoss'),
                align: 'right',
                cell: (x) => formatAzn(x.lossAzn),
              },
              {
                key: 'st',
                header: t('director.colStatus'),
                cell: (x) => tx(`common:anomalyStatus.${x.status}`),
              },
            ]}
          />
        </SheetSection>
        <SheetSection title={t('em.pipeline')}>
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={t('em.pipeline')}>
            {PIPE.map((s) => (
              <li
                key={s}
                className="rounded-[6px] border border-border px-2 py-0.5 text-xs text-ink-2"
              >
                {tx(`common:recStatus.${s}`)}:{' '}
                <strong className="font-semibold text-ink">{r.pipeline.counts[s]}</strong>
              </li>
            ))}
          </ul>
          <SheetTable
            caption={t('em.pipeline')}
            rows={[...r.pipeline.active, ...r.pipeline.proposed]}
            rowKey={(x) => x.id}
            columns={[
              {
                key: 't',
                header: t('director.colRec'),
                cell: (x) => tx(`common:rec.title.${x.id}`),
              },
              {
                key: 's',
                header: t('director.colStatus'),
                cell: (x) => tx(`common:recStatus.${x.status}`),
              },
              {
                key: 'k',
                header: t('em.colSaving'),
                align: 'right',
                cell: (x) =>
                  (x.m3PerMonth > 0 ? formatM3(x.m3PerMonth) : formatKwh(x.kwhPerMonth)) + perMonth,
              },
              {
                key: 'z',
                header: t('director.colAznMonth'),
                align: 'right',
                cell: (x) => formatAzn(x.aznPerMonth),
              },
              {
                key: 'c',
                header: t('director.colCo2Year'),
                align: 'right',
                cell: (x) => formatTCo2(x.tCo2PerYear),
              },
            ]}
          />
        </SheetSection>
        <SheetSection title={t('em.mv')}>
          <SavingsTable savings={r.savings} />
        </SheetSection>
        <SheetSection title={t('em.model')}>
          <p className="text-xs leading-5 text-ink-2">
            {t('em.modelText', {
              r2: formatNumber(r.model.r2, 2),
              cv: formatPct(r.model.cvRmsePct, 1),
              n: r.model.n,
              warn: formatPct(r.model.cvWarnPct, 0),
            })}{' '}
            {r.model.lowReliability ? (
              <strong className="font-semibold text-warning-text">{t('em.modelLow')}</strong>
            ) : (
              <span className="text-success-text">{t('em.modelOk')}</span>
            )}
          </p>
        </SheetSection>
      </ReportSheet>
    </>
  );
}
