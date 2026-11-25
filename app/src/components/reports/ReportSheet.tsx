import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { formatDate, formatMonthYear } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Report } from '@/services/ReportService';
import { formatRate } from './fmt';

/**
 * One A4 page (210 × 297 mm). On screen it is a white sheet with a shadow;
 * print.css removes the chrome and breaks pages exactly at sheet borders.
 */
export function ReportSheet({
  report,
  page,
  pages,
  children,
  className,
}: {
  report: Report;
  page: number;
  pages: number;
  children: ReactNode;
  className?: string;
}) {
  const { t, tx } = useT('reports');
  const p = report.period;
  return (
    <article
      className={cn('report-page flex flex-col bg-white text-ink', className)}
      aria-label={t('sheet.pageAria', { n: page, total: pages })}
    >
      <header className="flex items-start justify-between gap-6 border-b border-border-strong pb-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-violet-700">{t('common:app.name')}</p>
          <p className="truncate text-xs text-ink-2">
            {report.plant.name}, {report.plant.location}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">
            {tx(`template.${report.template}.title`)}
          </h2>
          <p className="text-xs text-ink-2">
            {formatMonthYear(p.start)}
            {' · '}
            {p.isCurrent
              ? t('sheet.basisCurrent', { days: report.figures.days })
              : t('sheet.basisClosed')}
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3 pt-3">{children}</div>
      <footer className="mt-3 flex items-end justify-between gap-4 border-t border-border pt-2 text-[11px] leading-4 text-ink-3">
        <p className="max-w-[75%]">
          {t('sheet.sources', {
            tariff: formatRate(report.rates.electricityRateAznPerKwh, 4, 2),
            scope2: formatRate(report.rates.scope2KgCo2PerKwh),
          })}{' '}
          {t('common:footer.demo')}
        </p>
        <p className="shrink-0 text-right">
          {t('sheet.generated', { date: formatDate(report.generatedAt) })}
          <br />
          {t('sheet.page', { n: page, total: pages })}
        </p>
      </footer>
    </article>
  );
}
