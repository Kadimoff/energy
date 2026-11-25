import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { hourLabel, weekdayName } from './fmt';
import {
  parseRecipients,
  REPORT_TEMPLATES,
  type ReportSchedule,
} from '@/services/ReportService.schedule';

interface Errors {
  day?: string;
  recipients?: string;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ReportSchedule;
  onSave: (s: ReportSchedule) => void;
}) {
  const { t, tx } = useT('reports');
  const [s, setS] = useState<ReportSchedule>(initial);
  const [dayText, setDayText] = useState(String(initial.dayOfMonth));
  const [recText, setRecText] = useState(initial.recipients.join(', '));
  const [errors, setErrors] = useState<Errors>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    const day = Number(dayText);
    if (s.frequency === 'monthly' && (!Number.isInteger(day) || day < 1 || day > 28))
      next.day = t('schedule.errDay');
    const rec = parseRecipients(recText);
    if (rec.invalid.length)
      next.recipients = t('schedule.errEmail', { list: rec.invalid.join(', ') });
    else if (!rec.valid.length) next.recipients = t('schedule.errNoRecipients');
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({
      ...s,
      dayOfMonth: s.frequency === 'monthly' ? day : s.dayOfMonth,
      recipients: rec.valid,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" closeLabel={t('common:actions.close')}>
        <DialogHeader>
          <DialogTitle>{initial.id ? t('schedule.editTitle') : t('schedule.newTitle')}</DialogTitle>
          <DialogDescription>{t('schedule.dialogDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="sch-template" className="text-13 font-medium text-ink">
              {t('picker.template')}
            </label>
            <Select
              value={s.template}
              onValueChange={(v) => setS({ ...s, template: v as ReportSchedule['template'] })}
            >
              <SelectTrigger id="sch-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TEMPLATES.map((id) => (
                  <SelectItem key={id} value={id}>
                    {tx(`template.${id}.title`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-13 font-medium text-ink">
              {t('schedule.frequency')}
            </legend>
            <div className="inline-flex w-fit rounded-sm border border-border bg-bg-subtle p-0.5">
              {(['weekly', 'monthly'] as const).map((fq) => (
                <label
                  key={fq}
                  className={cn(
                    'cursor-pointer rounded-[6px] px-3 py-1.5 text-13 font-medium text-ink-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-600',
                    s.frequency === fq && 'bg-surface text-ink shadow-sm',
                  )}
                >
                  <input
                    type="radio"
                    name="sch-frequency"
                    className="sr-only"
                    checked={s.frequency === fq}
                    onChange={() => setS({ ...s, frequency: fq })}
                  />
                  {t(`schedule.${fq}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {s.frequency === 'weekly' ? (
              <div className="grid gap-1.5">
                <label htmlFor="sch-weekday" className="text-13 font-medium text-ink">
                  {t('schedule.weekday')}
                </label>
                <Select
                  value={String(s.weekday)}
                  onValueChange={(v) => setS({ ...s, weekday: Number(v) })}
                >
                  <SelectTrigger id="sch-weekday">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {weekdayName(i)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <label htmlFor="sch-day" className="text-13 font-medium text-ink">
                  {t('schedule.dayOfMonth')}
                </label>
                <Input
                  id="sch-day"
                  inputMode="numeric"
                  value={dayText}
                  onChange={(e) => setDayText(e.target.value)}
                  aria-invalid={!!errors.day}
                  aria-describedby="sch-day-hint"
                  className={cn(errors.day && 'border-danger')}
                />
                <p
                  id="sch-day-hint"
                  className={cn('text-xs', errors.day ? 'text-danger-text' : 'text-ink-3')}
                >
                  {errors.day ?? t('schedule.dayHint')}
                </p>
              </div>
            )}
            <div className="grid gap-1.5">
              <label htmlFor="sch-hour" className="text-13 font-medium text-ink">
                {t('schedule.time')}
              </label>
              <Select value={String(s.hour)} onValueChange={(v) => setS({ ...s, hour: Number(v) })}>
                <SelectTrigger id="sch-hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>
                      {hourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="sch-recipients" className="text-13 font-medium text-ink">
              {t('schedule.recipients')}
            </label>
            <textarea
              id="sch-recipients"
              rows={2}
              value={recText}
              onChange={(e) => setRecText(e.target.value)}
              aria-invalid={!!errors.recipients}
              aria-describedby="sch-recipients-hint"
              className={cn(
                'w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink shadow-sm hover:border-violet-300 focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200',
                errors.recipients && 'border-danger',
              )}
            />
            <p
              id="sch-recipients-hint"
              className={cn('text-xs', errors.recipients ? 'text-danger-text' : 'text-ink-3')}
              aria-live="polite"
            >
              {errors.recipients ?? t('schedule.recipientsHint')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <fieldset className="flex items-center gap-3">
              <legend className="sr-only">{t('schedule.format')}</legend>
              <span aria-hidden="true" className="text-13 font-medium text-ink">
                {t('schedule.format')}
              </span>
              {(['pdf', 'csv'] as const).map((fm) => (
                <label key={fm} className="inline-flex items-center gap-1.5 text-13 text-ink">
                  <input
                    type="radio"
                    name="sch-format"
                    checked={s.format === fm}
                    onChange={() => setS({ ...s, format: fm })}
                    className="size-4 accent-violet-600"
                  />
                  {t(`schedule.format_${fm}`)}
                </label>
              ))}
            </fieldset>
            <label className="inline-flex items-center gap-2 text-13 text-ink">
              <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} />
              {t('schedule.enabled')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" variant="default">
              {t('common:actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
