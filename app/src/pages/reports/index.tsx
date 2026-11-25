import { Download, FileDown, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { downloadText } from '@/components/reports/download';
import { ReportDocument } from '@/components/reports/ReportDocument';
import { ScaledPreview } from '@/components/reports/ScaledPreview';
import { SchedulePanel } from '@/components/reports/SchedulePanel';
import { TemplatePicker } from '@/components/reports/TemplatePicker';
import { useReport } from '@/components/reports/useReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n';
import { formatMonthYear } from '@/lib/format';
import { reportCsv } from '@/services/ReportService.csv';
import { REPORT_TEMPLATES, type ReportTemplateId } from '@/services/ReportService.schedule';
import '@/styles/print.css';

const isTemplate = (v: string | null): v is ReportTemplateId =>
  !!v && (REPORT_TEMPLATES as readonly string[]).includes(v);

/** Route "/reports": templates, A4 preview, PDF (browser print), CSV, auto-send plan (spec 7.11). */
export default function ReportsPage() {
  const { t, tx } = useT('reports');
  const [params, setParams] = useSearchParams();
  const raw = params.get('t');
  const template: ReportTemplateId = isTemplate(raw) ? raw : 'director';
  const month = params.get('m');
  const [fit, setFit] = useState(true);
  const { report, periods, nowMs, isError, refetch } = useReport(template, month);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  const title = report
    ? `${tx(`template.${report.template}.title`)}, ${formatMonthYear(report.period.start)}`
    : '';

  const printPdf = () => {
    const prev = document.title;
    document.title = title;
    window.print();
    document.title = prev;
  };

  const exportCsv = () => {
    if (!report) return;
    downloadText(`sie-${report.template}-${report.period.key}.csv`, reportCsv(report, tx));
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={!report}>
              <Download aria-hidden="true" />
              {t('actions.csv')}
            </Button>
            <Button variant="primary" onClick={printPdf} disabled={!report}>
              <FileDown aria-hidden="true" />
              {t('actions.pdf')}
            </Button>
          </div>
        }
      />

      {isError ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-5">
                <TemplatePicker value={template} onChange={(v) => setParam('t', v)} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 pt-5">
                <div className="grid gap-1.5">
                  <label htmlFor="report-period" className="text-13 font-semibold text-ink">
                    {t('picker.period')}
                  </label>
                  {periods && report ? (
                    <Select value={report.period.key} onValueChange={(v) => setParam('m', v)}>
                      <SelectTrigger id="report-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.isCurrent
                              ? t('picker.current', { month: formatMonthYear(p.start) })
                              : formatMonthYear(p.start)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Skeleton className="h-9 w-full" />
                  )}
                </div>
                <p className="text-xs leading-5 text-ink-3">{t('picker.periodHint')}</p>
                <p className="text-xs leading-5 text-ink-3">{t('actions.csvHint')}</p>
              </CardContent>
            </Card>
          </div>

          <section
            aria-label={t('preview.label')}
            className="min-w-0 rounded-panel border border-border bg-bg-subtle p-3 sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-13 font-semibold text-ink">
                {t('preview.label')}
                {report && <span className="ml-2 font-normal text-ink-3">{title}</span>}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFit((f) => !f)}
                aria-pressed={!fit}
              >
                {fit ? <Maximize2 aria-hidden="true" /> : <Minimize2 aria-hidden="true" />}
                {fit ? t('preview.actualSize') : t('preview.fit')}
              </Button>
            </div>
            {report ? (
              <ScaledPreview fit={fit}>
                <ReportDocument report={report} />
              </ScaledPreview>
            ) : (
              <div
                aria-busy="true"
                className="mx-auto aspect-[210/297] w-full max-w-[794px] rounded-sm bg-white p-8 shadow-sm"
              >
                <span className="sr-only">{t('common:states.loading')}</span>
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="mt-6 h-20 w-full" />
                <div className="mt-6 grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
                <Skeleton className="mt-6 h-40 w-full" />
              </div>
            )}
          </section>
        </div>
      )}

      {nowMs !== undefined && <SchedulePanel nowMs={nowMs} />}

      {report &&
        createPortal(
          <div className="report-print-host" aria-hidden="true">
            <ReportDocument report={report} />
          </div>,
          document.body,
        )}
    </>
  );
}
