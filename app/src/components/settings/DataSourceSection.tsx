import {
  CheckCircle2,
  CircleSlash,
  Download,
  FileSpreadsheet,
  Plug,
  UploadCloud,
  WifiOff,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import adminJson from '@/data/config/admin.json';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadText } from '@/components/reports/download';
import { useT } from '@/i18n';
import { formatDateTime, formatNumber, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { meterCsvTemplate, parseMeterCsv, type MeterCsvResult } from '@/services/ReportService.csv';
import { useAdminStore } from '@/stores/admin';
import { useAnalysis } from '@/stores/derived';
import { SectionCard } from './shared';

type SourceStatus = 'connected' | 'offline' | 'not_configured';
const statusVariant: Record<SourceStatus, 'success' | 'danger' | 'neutral'> = {
  connected: 'success',
  offline: 'danger',
  not_configured: 'neutral',
};
const StatusIcon = { connected: CheckCircle2, offline: WifiOff, not_configured: CircleSlash };

export function DataSourceSection() {
  const { t, tx } = useT('settings');
  const { data } = useAnalysis();
  const uploads = useAdminStore((s) => s.uploads);
  const addUpload = useAdminStore((s) => s.addUpload);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<{
    name: string;
    r: MeterCsvResult | null;
    error?: string;
  } | null>(null);
  const cols = adminJson.meterCsvColumns;
  const codes = data?.ds.equipment.map((e) => e.code) ?? [];
  const offline = new Map(data?.ds.offlineEquipment.map((o) => [o.id, o.since]) ?? []);
  const nowMs = data?.ds.timeline.nowMs ?? 0;

  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setResult({
        name: file.name,
        r: null,
        error: /\.xlsx?$/i.test(file.name) ? t('sources.excelNote') : t('sources.wrongType'),
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResult({ name: file.name, r: null, error: t('sources.tooBig') });
      return;
    }
    const text = await file.text();
    const r = parseMeterCsv(text, cols, codes);
    setResult({ name: file.name, r });
    if (r.headerOk)
      addUpload({ name: file.name, rows: r.rows, errors: r.issues.length, at: Date.now() });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void handle(e.dataTransfer.files[0]);
  };

  const template = () => {
    const ex = data?.ds.equipment[0]?.code ?? 'K-1';
    downloadText(
      'sie-sayğac-şablonu.csv',
      meterCsvTemplate(cols, [
        ['2026-11-24', '08:00', ex, '61,4', 'kVt·saat'],
        ['2026-11-24', '09:00', ex, '63,2', 'kVt·saat'],
      ]),
    );
  };

  const online = data ? data.ds.equipment.length - offline.size : 0;

  return (
    <div className="space-y-6">
      <SectionCard
        title={t('sources.integrationsTitle')}
        description={t('sources.integrationsDesc')}
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {(adminJson.dataSources as { id: string; protocol: string; status: SourceStatus }[]).map(
            (s) => {
              const Icon = StatusIcon[s.status];
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-bg-subtle text-ink-2">
                    <Plug className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {tx(`sources.kind.${s.id}`)}
                      <Badge variant={statusVariant[s.status]}>
                        <Icon aria-hidden="true" />
                        {tx(`sources.status.${s.status}`)}
                      </Badge>
                    </p>
                    <p className="text-xs text-ink-3">
                      {s.protocol}
                      {s.status === 'connected' &&
                        nowMs > 0 &&
                        ` · ${t('sources.lastSync', { time: formatTime(nowMs) })}`}
                    </p>
                  </div>
                </li>
              );
            },
          )}
        </ul>
        <p className="mt-3 text-xs text-ink-3">{t('sources.simulation')}</p>
      </SectionCard>

      <SectionCard
        title={t('sources.metersTitle')}
        description={
          data
            ? t('sources.metersSummary', {
                online,
                total: data.ds.equipment.length,
                offline: offline.size,
              })
            : undefined
        }
      >
        {!data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <div
            className="max-h-[420px] overflow-auto rounded-md border border-border"
            tabIndex={0}
            role="region"
            aria-label={t('sources.metersTitle')}
          >
            <table className="w-full min-w-[560px] text-13">
              <caption className="sr-only">{t('sources.metersTitle')}</caption>
              <thead className="sticky top-0 bg-bg-subtle">
                <tr className="text-left text-xs text-ink-2">
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('sources.colMeter')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('sources.colGroup')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('sources.colEnergy')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('sources.colStatus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data.ds.equipment]
                  .sort((a, b) => Number(offline.has(b.id)) - Number(offline.has(a.id)))
                  .map((e) => {
                    const since = offline.get(e.id);
                    return (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <span className="font-medium text-ink">{e.code}</span>
                          <span className="ml-2 text-ink-3">{e.name !== e.code ? e.name : ''}</span>
                        </td>
                        <td className="px-3 py-2 text-ink-2">{tx(`common:group.${e.group}`)}</td>
                        <td className="px-3 py-2 text-ink-2">{tx(`common:energy.${e.energy}`)}</td>
                        <td className="px-3 py-2">
                          {since ? (
                            <Badge variant="danger">
                              <WifiOff aria-hidden="true" />
                              {t('sources.offlineFor', { n: Math.round((nowMs - since) / 60_000) })}
                            </Badge>
                          ) : (
                            <Badge variant="success">
                              <CheckCircle2 aria-hidden="true" />
                              {t('sources.online')}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t('sources.uploadTitle')}
        description={t('sources.uploadDesc')}
        actions={
          <Button variant="secondary" size="sm" onClick={template}>
            <Download aria-hidden="true" />
            {t('sources.template')}
          </Button>
        }
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors duration-180',
            drag ? 'border-violet-400 bg-violet-50' : 'border-border-strong bg-bg-subtle',
          )}
        >
          <UploadCloud className="size-6 text-violet-600" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm font-medium text-ink">{t('sources.dropTitle')}</p>
          <p className="text-xs text-ink-3">{t('sources.dropHint', { cols: cols.join('; ') })}</p>
          <input
            ref={input}
            id="meter-upload"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="sr-only"
            onChange={(e) => {
              void handle(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            variant="subtle"
            size="sm"
            className="mt-1"
            onClick={() => input.current?.click()}
          >
            <FileSpreadsheet aria-hidden="true" />
            {t('sources.choose')}
          </Button>
        </div>
        <div aria-live="polite" className="mt-3">
          {result && (
            <div
              className={cn(
                'rounded-sm px-3 py-2 text-13',
                result.error || !result.r?.headerOk
                  ? 'bg-danger-surface text-danger-text'
                  : result.r.issues.length
                    ? 'bg-warning-surface text-warning-text'
                    : 'bg-success-surface text-success-text',
              )}
            >
              <p className="font-medium">{result.name}</p>
              {result.error ? (
                <p>{result.error}</p>
              ) : !result.r?.headerOk ? (
                <p>{t('sources.badHeader', { cols: cols.join('; ') })}</p>
              ) : (
                <>
                  <p>
                    {t('sources.parsed', {
                      rows: formatNumber(result.r.rows),
                      ok: formatNumber(result.r.rows - result.r.issues.length),
                      meters: result.r.meters.length,
                    })}
                  </p>
                  {result.r.issues.slice(0, 5).map((i) => (
                    <p key={i.line}>
                      {t('sources.issue', {
                        line: i.line,
                        reason: tx(`sources.reason.${i.reason}`),
                      })}
                    </p>
                  ))}
                  <p className="mt-1 text-xs opacity-90">{t('sources.notImported')}</p>
                </>
              )}
            </div>
          )}
        </div>
        {uploads.length > 0 && (
          <>
            <h3 className="mb-2 mt-4 text-13 font-semibold text-ink">{t('sources.history')}</h3>
            <ul className="space-y-1 text-13 text-ink-2">
              {uploads.map((u) => (
                <li key={u.id}>
                  <span className="text-ink">{u.name}</span> · {formatDateTime(u.at)} ·{' '}
                  {t('sources.historyRow', { rows: u.rows, errors: u.errors })}
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>
    </div>
  );
}
