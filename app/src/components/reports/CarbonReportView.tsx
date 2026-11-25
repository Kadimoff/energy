import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import {
  formatDate,
  formatIntensity,
  formatMonthYear,
  formatNumber,
  formatPct,
  formatTCo2,
  formatTons,
} from '@/lib/format';
import type { CarbonReport } from '@/services/ReportService';
import { formatRate } from './fmt';
import { ReportScopeBars } from './ReportCharts';
import { ReportSheet } from './ReportSheet';
import { Figure, SheetSection, SheetTable } from './sheet-ui';

/** Carbon report (GHG Protocol, Scope 1/2): two A4 pages. */
export function CarbonReportView({ report: r }: { report: CarbonReport }) {
  const { t, tx } = useT('reports');
  const f = r.figures;
  const tg = r.target;
  const perYear = t('common:units.perYear');
  const covered = Math.min(100, tg.coveragePct);
  const share = (v: number) => formatPct((v / (r.rolling.totalT || 1)) * 100, 0);
  return (
    <>
      <ReportSheet report={r} page={1} pages={2}>
        <SheetSection
          title={t('carbonReport.monthTitle', { month: formatMonthYear(r.period.start) })}
        >
          <div className="grid grid-cols-4 gap-2">
            <Figure
              label={t('carbonReport.total')}
              value={formatTCo2(f.co2.totalT)}
              hint={t('carbonReport.monthlyTarget', { v: formatTCo2(f.co2MonthlyTargetT, 0) })}
            />
            <Figure
              label={t('carbonReport.scope1')}
              value={formatTCo2(f.co2.scope1T)}
              hint={t('carbonReport.scope1Hint')}
            />
            <Figure
              label={t('carbonReport.scope2')}
              value={formatTCo2(f.co2.scope2T)}
              hint={t('carbonReport.scope2Hint')}
            />
            <Figure
              label={t('carbonReport.intensity')}
              value={formatIntensity(f.co2.intensityKgPerT)}
              hint={t('carbonReport.intensityHint', { t: formatTons(f.tons) })}
            />
          </div>
        </SheetSection>
        <SheetSection title={t('carbonReport.rollingTitle', { n: r.rolling.months })}>
          <div className="grid grid-cols-4 gap-2">
            <Figure
              strong
              label={t('carbonReport.total')}
              value={formatTCo2(r.rolling.totalT, 0)}
            />
            <Figure
              label={t('carbonReport.scope1')}
              value={formatTCo2(r.rolling.scope1T, 0)}
              hint={share(r.rolling.scope1T)}
            />
            <Figure
              label={t('carbonReport.scope2')}
              value={formatTCo2(r.rolling.scope2T, 0)}
              hint={share(r.rolling.scope2T)}
            />
            <Figure
              label={t('carbonReport.intensity')}
              value={formatIntensity(r.rolling.intensityKgPerT)}
              hint={t('carbonReport.intensityHint', { t: formatTons(r.rolling.tons) })}
            />
          </div>
          <div className="mt-3">
            <ReportScopeBars months={r.months} height={190} label={t('carbonReport.chartAria')} />
          </div>
        </SheetSection>
        <div className="grid grid-cols-[1.15fr_1fr] gap-5">
          <SheetSection title={t('carbonReport.targetTitle')}>
            <dl className="text-xs tabular-nums">
              {[
                [t('carbonReport.baseline'), formatTCo2(tg.baselineT, 0)],
                [
                  t('carbonReport.target', { pct: formatPct(tg.reductionPct, 0) }),
                  formatTCo2(tg.targetT, 0),
                ],
                [t('carbonReport.absoluteTarget'), formatTCo2(tg.absoluteTargetT, 0)],
                [t('carbonReport.gap'), formatTCo2(tg.gapT, 0)],
                [t('carbonReport.accepted'), `${formatTCo2(tg.acceptedTPerYear)}${perYear}`],
                [t('carbonReport.potential'), `${formatTCo2(tg.potentialTPerYear)}${perYear}`],
                [t('carbonReport.verified'), `${formatTCo2(tg.verifiedTPerYear)}${perYear}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-border py-1">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="whitespace-nowrap font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-ink-2">
                <span>{t('carbonReport.coverage')}</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatPct(tg.coveragePct, 0)}
                </span>
              </div>
              <div
                className="h-2.5 rounded-full bg-bg-subtle ring-1 ring-inset ring-border"
                role="img"
                aria-label={t('carbonReport.coverageAria', { pct: formatPct(tg.coveragePct, 0) })}
              >
                <div
                  className={`h-full rounded-full ${tg.coveragePct >= 100 ? 'bg-success' : 'bg-warning'}`}
                  style={{ width: `${covered}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {t(
                  tg.coveragePct >= 100 ? 'carbonReport.coverageOk' : 'carbonReport.coverageShort',
                )}
              </p>
            </div>
          </SheetSection>
          <SheetSection title={t('carbonReport.sources')}>
            <SheetTable
              caption={t('carbonReport.sources')}
              rows={r.sources}
              rowKey={(s) => s.group}
              columns={[
                { key: 'g', header: t('em.colGroup'), cell: (s) => tx(`common:group.${s.group}`) },
                { key: 's', header: t('carbonReport.colScope'), cell: (s) => `Scope ${s.scope}` },
                {
                  key: 't',
                  header: t('carbonReport.total'),
                  align: 'right',
                  cell: (s) => formatTCo2(s.t),
                },
                {
                  key: 'p',
                  header: t('director.colShare'),
                  align: 'right',
                  cell: (s) => formatPct(s.sharePct, 0),
                },
              ]}
            />
          </SheetSection>
        </div>
      </ReportSheet>

      <ReportSheet report={r} page={2} pages={2}>
        <SheetSection title={t('carbonReport.monthlyTable')}>
          <SheetTable
            caption={t('carbonReport.monthlyTable')}
            rows={r.months}
            rowKey={(m) => m.key}
            columns={[
              {
                key: 'm',
                header: t('csv.month'),
                cell: (m) =>
                  formatMonthYear(m.start) + (m.complete ? '' : ` ${t('carbonReport.partial')}`),
              },
              {
                key: 'k',
                header: t('carbonReport.colElec'),
                align: 'right',
                cell: (m) => formatNumber(m.kwh / 1000, 1),
              },
              {
                key: 'g',
                header: t('carbonReport.colGas'),
                align: 'right',
                cell: (m) => formatNumber(m.m3),
              },
              {
                key: 's1',
                header: t('carbonReport.colScope1'),
                align: 'right',
                cell: (m) => formatNumber(m.scope1T, 1),
              },
              {
                key: 's2',
                header: t('carbonReport.colScope2'),
                align: 'right',
                cell: (m) => formatNumber(m.scope2T, 1),
              },
              {
                key: 't',
                header: t('carbonReport.colTotal'),
                align: 'right',
                cell: (m) => formatNumber(m.totalT, 1),
              },
              {
                key: 'i',
                header: t('carbonReport.colIntensity'),
                align: 'right',
                cell: (m) => formatNumber(m.intensityKgPerT),
              },
            ]}
          />
        </SheetSection>
        <SheetSection title={t('carbonReport.factors')}>
          <ul className="grid grid-cols-3 gap-3">
            {r.factors.map((x) => (
              <li
                key={x.id}
                className="rounded-[8px] border border-border px-3 py-2 text-xs leading-4"
              >
                <p className="font-medium text-ink">{tx(`carbonReport.factor.${x.id}`)}</p>
                <p className="mt-0.5 text-[15px] font-semibold leading-6 tabular-nums">
                  {formatRate(x.value)}{' '}
                  <span className="text-xs font-normal text-ink-3">
                    {x.id === 'gasKwhPerM3'
                      ? t('carbonReport.unitKwhM3')
                      : t('carbonReport.unitKgKwh')}
                  </span>
                </p>
                <p className="mt-1 text-ink-2">{x.source}</p>
                {x.basis && <p className="mt-0.5 text-ink-3">{x.basis}</p>}
                {x.lastChecked && (
                  <p className="mt-1 text-ink-3">
                    {t('carbonReport.lastChecked', { d: formatDate(new Date(x.lastChecked)) })}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {x.overridden && (
                    <Badge variant="violet" className="px-1.5 py-0 text-[11px]">
                      {t('carbonReport.overridden', { d: formatRate(x.defaultValue) })}
                    </Badge>
                  )}
                  {x.verify && (
                    <Badge variant="warning" className="px-1.5 py-0 text-[11px]">
                      {t('common:source.verify')}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SheetSection>
        <section className="report-block flex gap-2 rounded-[8px] border border-warning/40 bg-warning-surface px-3 py-2 text-xs leading-5 text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <p>{t('carbonReport.disclaimer')}</p>
        </section>
      </ReportSheet>
    </>
  );
}
