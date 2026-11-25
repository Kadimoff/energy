import { CalendarClock, Info, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { nextRunAt, type ReportSchedule } from '@/services/ReportService.schedule';
import { useAdminStore } from '@/stores/admin';
import { hourLabel, weekdayName } from './fmt';
import { ScheduleDialog } from './ScheduleDialog';

const blank: ReportSchedule = {
  id: '',
  template: 'director',
  frequency: 'monthly',
  weekday: 0,
  dayOfMonth: 1,
  hour: 9,
  recipients: [],
  format: 'pdf',
  enabled: true,
};

/** Auto-send plan (UI simulation, spec 7.11): weekly/monthly, recipients, send log. */
export function SchedulePanel({ nowMs }: { nowMs: number }) {
  const { t, tx } = useT('reports');
  const schedules = useAdminStore((s) => s.schedules);
  const log = useAdminStore((s) => s.sendLog);
  const upsert = useAdminStore((s) => s.upsertSchedule);
  const remove = useAdminStore((s) => s.removeSchedule);
  const logSend = useAdminStore((s) => s.logSend);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const [announce, setAnnounce] = useState('');

  const when = (s: ReportSchedule) =>
    s.frequency === 'weekly'
      ? t('schedule.whenWeekly', { day: weekdayName(s.weekday), time: hourLabel(s.hour) })
      : t('schedule.whenMonthly', { day: s.dayOfMonth, time: hourLabel(s.hour) });

  const sendNow = (s: ReportSchedule) => {
    logSend({
      scheduleId: s.id,
      template: s.template,
      format: s.format,
      at: Date.now(),
      recipients: s.recipients,
    });
    setAnnounce(
      t('schedule.sentAnnounce', {
        title: tx(`template.${s.template}.title`),
        n: s.recipients.length,
      }),
    );
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t('schedule.title')}</CardTitle>
            <Badge variant="info">{t('schedule.simulation')}</Badge>
          </div>
          <CardDescription className="mt-1">{t('schedule.subtitle')}</CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEditing({ ...blank })}
          className="shrink-0"
        >
          <Plus aria-hidden="true" />
          {t('schedule.add')}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 flex gap-2 rounded-sm border border-info/30 bg-info-surface px-3 py-2 text-13 text-info-text">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {t('schedule.simulationNote')}
        </p>
        {schedules.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarClock}
            title={t('schedule.emptyTitle')}
            body={t('schedule.emptyBody')}
            action={{ label: t('schedule.add'), onClick: () => setEditing({ ...blank }) }}
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {tx(`template.${s.template}.title`)}
                    <Badge variant="neutral">{t(`schedule.format_${s.format}`)}</Badge>
                    {!s.enabled && <Badge variant="outline">{t('schedule.paused')}</Badge>}
                  </p>
                  <p className="mt-0.5 text-13 text-ink-2">
                    {when(s)} · {t('schedule.recipientsCount', { n: s.recipients.length })}
                    <span className="text-ink-3"> ({s.recipients.join(', ')})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {s.enabled
                      ? t('schedule.next', { at: formatDateTime(nextRunAt(s, nowMs)) })
                      : t('schedule.nextPaused')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="mr-2 inline-flex items-center gap-2 text-13 text-ink-2">
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={(v) => upsert({ ...s, enabled: v })}
                      aria-label={t('schedule.toggleAria', {
                        title: tx(`template.${s.template}.title`),
                      })}
                    />
                    <span aria-hidden="true">
                      {s.enabled ? t('schedule.on') : t('schedule.off')}
                    </span>
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => sendNow(s)}>
                    <Send aria-hidden="true" />
                    {t('schedule.sendNow')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing(s)}
                    aria-label={t('schedule.editAria', {
                      title: tx(`template.${s.template}.title`),
                    })}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(s.id)}
                    aria-label={t('schedule.deleteAria', {
                      title: tx(`template.${s.template}.title`),
                    })}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 mt-6 text-13 font-semibold text-ink">{t('schedule.log')}</h3>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        {log.length === 0 ? (
          <p className="text-13 text-ink-3">{t('schedule.logEmpty')}</p>
        ) : (
          <ul className="space-y-1.5 text-13">
            {log.slice(0, 5).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 text-ink-2">
                <span className="tabular-nums text-ink">{formatDateTime(e.at)}</span>
                <span>·</span>
                <span>{tx(`template.${e.template}.title`)}</span>
                <span>·</span>
                <span>{t('schedule.recipientsCount', { n: e.recipients.length })}</span>
                <span>·</span>
                <span>{t(`schedule.format_${e.format}`)}</span>
                <Badge variant="info" className="ml-1">
                  {t('schedule.simulatedSend')}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && (
        <ScheduleDialog
          key={editing.id || 'new'}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          initial={editing}
          onSave={upsert}
        />
      )}
    </Card>
  );
}
