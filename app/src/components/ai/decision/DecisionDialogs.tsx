import { Info } from 'lucide-react';
import { useId, useState } from 'react';
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
import type { RejectReason } from '@/data/types';
import { validateReject, validateSchedule } from '@/domain/decisions';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

const REASONS: RejectReason[] = ['not_feasible', 'production_risk', 'already_done', 'other'];

function toInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  /** current time (data source "now") */
  nowMs: number;
  initial?: number;
  onConfirm: (dateMs: number) => void;
}

/** Date picker for "Planla" (spec 7.6). */
export function ScheduleDialog({
  open,
  onOpenChange,
  title,
  nowMs,
  initial,
  onConfirm,
}: ScheduleDialogProps) {
  const { t, tx } = useT('decisions');
  const [value, setValue] = useState(() => toInput(initial ?? nowMs + 86_400_000));
  const [touched, setTouched] = useState(false);
  const id = useId();
  const ms = value ? new Date(`${value}T00:00:00`).getTime() : null;
  const error = validateSchedule(ms, nowMs);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('scheduleDialog.title')}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!error && ms !== null) {
              onConfirm(ms);
              onOpenChange(false);
            }
          }}
        >
          <div>
            <label htmlFor={id} className="text-13 font-medium text-ink">
              {t('scheduleDialog.date')}
            </label>
            <Input
              id={id}
              type="date"
              value={value}
              min={toInput(nowMs)}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={touched && !!error}
              aria-describedby={`${id}-hint`}
              className="mt-1.5"
            />
            <p
              id={`${id}-hint`}
              className={cn('mt-1.5 text-xs', touched && error ? 'text-danger-text' : 'text-ink-3')}
            >
              {touched && error ? tx(`scheduleDialog.errors.${error}`) : t('scheduleDialog.body')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" variant="default">
              {t('scheduleDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface RejectDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onConfirm: (reason: RejectReason, note: string) => void;
}

/** Reject with a mandatory reason; "Digər" also needs a note (spec 7.6). */
export function RejectDialog({ open, onOpenChange, title, onConfirm }: RejectDialogProps) {
  const { t, tx } = useT('decisions');
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const id = useId();
  const error = validateReject(reason, note);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rejectDialog.title')}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!error && reason) {
              onConfirm(reason, note.trim());
              onOpenChange(false);
            }
          }}
        >
          <fieldset aria-describedby={`${id}-err`}>
            <legend className="text-13 font-medium text-ink">
              {t('rejectDialog.reason')}
              <span className="text-danger-text" aria-hidden="true">
                {' '}
                *
              </span>
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-13 transition-colors duration-180',
                    reason === r
                      ? 'border-violet-400 bg-violet-50 text-ink'
                      : 'border-border text-ink-2 hover:border-border-strong',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-4 accent-violet-600"
                  />
                  {tx(`common:rejectReason.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${id}-note`} className="text-13 font-medium text-ink">
              {reason === 'other' ? t('rejectDialog.note') : t('rejectDialog.noteOptional')}
            </label>
            <textarea
              id={`${id}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('rejectDialog.notePlaceholder')}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:border-violet-400"
            />
          </div>
          <p
            id={`${id}-err`}
            role={touched && error ? 'alert' : undefined}
            className="min-h-[18px] text-xs text-danger-text"
          >
            {touched && error ? tx(`rejectDialog.errors.${error}`) : ''}
          </p>
          <p className="flex gap-2 rounded-md bg-violet-50 px-3 py-2.5 text-xs text-ink-2">
            <Info
              className="mt-0.5 size-3.5 shrink-0 text-violet-600"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {t('rejectDialog.learning')}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" variant="danger">
              {t('rejectDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
