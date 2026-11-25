import { AiBadge } from '@/components/ai/AiBadge';
import { useT } from '@/i18n';
import {
  formatEnergy,
  formatEnpi,
  formatMonthYear,
  formatNumber,
  formatPct,
  formatSigned,
  formatTons,
  formatAzn,
  formatTCo2,
} from '@/lib/format';
import type { IsoReport } from '@/services/ReportService';
import { ReportSheet } from './ReportSheet';
import { Figure, SheetSection, SheetTable } from './sheet-ui';
import { SavingsTable } from './SavingsTable';

/** ISO 50001 energy performance review (management review input): two A4 pages. */
export function IsoReportView({ report: r }: { report: IsoReport }) {
  const { t, tx } = useT('reports');
  const v = r.variables;
  const perMonth = t('common:units.perMonth');
  const improved = r.normalized.improvementPct >= 0;
  const pct1 = (x: number) => formatPct(x, 1);
  const rows: { k: string; base: string; rep: string }[] = [
    {
      k: t('iso.tonsPerDay'),
      base: formatNumber(v.baseTonsPerDay, 1),
      rep: formatNumber(v.days ? v.tons / v.days : 0, 1),
    },
    {
      k: t('iso.hoursPerDay'),
      base: formatNumber(v.baseHoursPerDay, 1),
      rep: formatNumber(v.days ? v.productionHours / v.days : 0, 1),
    },
    {
      k: t('iso.cddPerDay'),
      base: formatNumber(v.baseCddPerDay, 2),
      rep: formatNumber(v.days ? v.cdd / v.days : 0, 2),
    },
    {
      k: t('iso.hddPerDay'),
      base: formatNumber(v.baseHddPerDay, 2),
      rep: formatNumber(v.days ? v.hdd / v.days : 0, 2),
    },
  ];
  return (
    <>
      <ReportSheet report={r} page={1} pages={2}>
        <SheetSection title={t('iso.scope')}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {[
              [t('iso.organisation'), r.plant.name],
              [t('iso.sector'), r.plant.sector],
              [
                t('iso.boundaries'),
                t('iso.boundariesValue', {
                  area: formatNumber(r.staticFactors.areaM2),
                  n: r.staticFactors.equipmentCount,
                }),
              ],
              [t('iso.carriers'), t('iso.carriersValue')],
              [
                t('iso.baselinePeriod'),
                t('iso.periodValue', {
                  from: formatMonthYear(r.baseline.fromStart),
                  to: formatMonthYear(r.baseline.toStart),
                  n: r.baseline.months,
                }),
              ],
              [
                t('iso.reportingPeriod'),
                `${formatMonthYear(r.period.start)} · ${t('iso.days', { n: r.reporting.days })}`,
              ],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border py-1">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-right font-medium text-ink">{val}</dd>
              </div>
            ))}
          </dl>
          {r.staticFactors.changed && (
            <p className="mt-2 rounded-[6px] bg-warning-surface px-2 py-1 text-xs text-warning-text">
              {t('iso.staticChanged')}
            </p>
          )}
        </SheetSection>

        <SheetSection title={t('iso.enpiTitle')}>
          <div className="grid grid-cols-4 gap-2">
            <Figure
              label={t('iso.enpiBaseline')}
              value={formatEnpi(r.baseline.enpi)}
              hint={t('iso.enbHint', {
                kwh: formatEnergy(r.baseline.kwh),
                t: formatTons(r.baseline.tons),
              })}
            />
            <Figure
              label={t('iso.enpiReporting')}
              value={formatEnpi(r.reporting.enpi)}
              hint={t('iso.change', { v: formatSigned(r.enpiChangePct, pct1) })}
              tone={r.enpiChangePct <= 0 ? 'success' : 'warning'}
            />
            <Figure
              label={t('iso.enpiTarget')}
              value={formatEnpi(r.targets.enpiTarget)}
              hint={
                r.reporting.enpi <= r.targets.enpiTarget
                  ? t('iso.targetMet')
                  : t('iso.targetMissed')
              }
              tone={r.reporting.enpi <= r.targets.enpiTarget ? 'success' : 'warning'}
            />
            <Figure
              strong
              label={t('iso.normalized')}
              value={formatSigned(r.normalized.improvementPct, pct1)}
              hint={improved ? t('iso.better') : t('iso.worse')}
              tone={improved ? 'success' : 'warning'}
            />
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-2">
            {t('iso.normalizedText', {
              adjusted: formatEnergy(r.normalized.adjustedBaselineKwh),
              actual: formatEnergy(r.normalized.actualKwh),
            })}
          </p>
        </SheetSection>

        <SheetSection title={t('iso.variables')}>
          <SheetTable
            caption={t('iso.variables')}
            rows={rows}
            rowKey={(x) => x.k}
            columns={[
              { key: 'k', header: t('iso.colVariable'), cell: (x) => x.k },
              { key: 'b', header: t('iso.colBaseline'), align: 'right', cell: (x) => x.base },
              { key: 'r', header: t('iso.colReporting'), align: 'right', cell: (x) => x.rep },
            ]}
          />
        </SheetSection>

        <SheetSection title={t('iso.model')}>
          <p className="font-mono text-xs text-ink">
            E = {formatNumber(r.model.coef.a, 0)} + {formatNumber(r.model.coef.b, 1)}·ton +{' '}
            {formatNumber(r.model.coef.c, 1)}·CDD + {formatNumber(r.model.coef.d, 1)}·HDD +{' '}
            {formatNumber(r.model.coef.e, 1)}·{t('iso.hoursVar')}
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-2">
            {t('iso.modelText', {
              r2: formatNumber(r.model.r2, 2),
              cv: pct1(r.model.cvRmsePct),
              n: r.model.n,
            })}{' '}
            <span
              className={
                r.model.lowReliability ? 'font-semibold text-warning-text' : 'text-success-text'
              }
            >
              {r.model.lowReliability ? t('em.modelLow') : t('em.modelOk')}
            </span>
          </p>
        </SheetSection>
        <SheetSection title={t('iso.seu')} aside={t('iso.seuRule')}>
          <SheetTable
            caption={t('iso.seu')}
            rows={r.seu}
            rowKey={(s) => s.group}
            columns={[
              { key: 'g', header: t('em.colGroup'), cell: (s) => tx(`common:group.${s.group}`) },
              {
                key: 'k',
                header: t('iso.colEnergy'),
                align: 'right',
                cell: (s) => formatEnergy(s.kwh),
              },
              {
                key: 'p',
                header: t('director.colShare'),
                align: 'right',
                cell: (s) => pct1(s.sharePct),
              },
              {
                key: 's',
                header: t('iso.colSeu'),
                cell: (s) => (s.significant ? t('iso.seuYes') : t('iso.seuNo')),
              },
            ]}
          />
        </SheetSection>
      </ReportSheet>

      <ReportSheet report={r} page={2} pages={2}>
        <SheetSection title={t('iso.targets')}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs tabular-nums">
            {[
              [
                t('iso.energyTarget', { pct: formatPct(r.targets.energyReductionPct, 0) }),
                formatEnergy(r.targets.energyTargetKwhPerYear),
              ],
              [t('iso.energyBaseline'), formatEnergy(r.targets.baselineKwhPerYear)],
              [t('iso.enpiTarget'), formatEnpi(r.targets.enpiTarget)],
              [t('iso.enpiReporting'), formatEnpi(r.targets.enpiActual)],
              [t('iso.co2Target'), formatPct(r.targets.co2ReductionPct, 0)],
              [t('iso.co2Month'), formatTCo2(r.figures.co2.totalT)],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border py-1">
                <dt className="text-ink-2">{k}</dt>
                <dd className="font-medium text-ink">{val}</dd>
              </div>
            ))}
          </dl>
        </SheetSection>
        <SheetSection title={t('iso.actions')}>
          <SheetTable
            caption={t('iso.actions')}
            rows={r.actions.active}
            rowKey={(x) => x.id}
            empty={t('iso.noActions')}
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
                key: 'z',
                header: t('director.colAznMonth'),
                align: 'right',
                cell: (x) => `${formatAzn(x.aznPerMonth)}${perMonth}`,
              },
            ]}
          />
          <p className="mt-1.5 text-xs text-ink-2">
            {t('iso.actionsCounts', {
              proposed: r.actions.counts.proposed,
              rejected: r.actions.counts.rejected,
            })}
          </p>
        </SheetSection>
        <SheetSection title={t('iso.mv')}>
          <SavingsTable savings={r.savings} />
        </SheetSection>
        <section className="report-block rounded-[10px] border border-violet-100 bg-violet-50/60 px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <AiBadge label={t('director.summaryBadge')} />
            <h3 className="text-[13px] font-semibold">{t('iso.conclusion')}</h3>
          </div>
          <p className="text-xs leading-5">
            {t(improved ? 'iso.conclusionBetter' : 'iso.conclusionWorse', {
              v: pct1(Math.abs(r.normalized.improvementPct)),
              seu: r.seu.filter((s) => s.significant).length,
              actions: r.actions.active.length,
            })}
          </p>
        </section>
      </ReportSheet>
    </>
  );
}
