import { AlertTriangle, CalendarPlus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DaySchedule, ShiftDef } from '@/data/types';
import { useT } from '@/i18n';
import { formatDate, formatWeekday } from '@/lib/format';
import { cn } from '@/lib/utils';
import { hourLabel } from '@/components/reports/fmt';
import {
  defaultPlantProfile,
  staticFactorsChanged,
  useAdminStore,
  usePlantProfile,
  type PlantProfileEdit,
} from '@/stores/admin';
import { NumberField } from './NumberField';
import { SectionCard } from './shared';
import { validateDaySchedule, validateShifts, validateText } from './validation';

type DayKey = keyof PlantProfileEdit['schedule'];
const cap = (s: string) => s.charAt(0).toLocaleUpperCase('az') + s.slice(1);
const DAYS: DayKey[] = ['weekday', 'saturday', 'sunday'];

function TextField({
  id,
  label,
  value,
  onCommit,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (v: string) => void;
  max: number;
}) {
  const { tx } = useT('settings');
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (value !== text.trim()) setText(value);
  }
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-13 font-medium text-ink">
        {label}
      </label>
      <Input
        id={id}
        value={text}
        aria-invalid={!!error}
        aria-describedby={`${id}-err`}
        className={cn(error && 'border-danger')}
        onChange={(e) => {
          setText(e.target.value);
          const r = validateText(e.target.value, { required: true, max });
          if (r.ok) {
            setError(null);
            onCommit(String(r.value));
          } else setError(tx(r.key, r.params));
        }}
      />
      <p id={`${id}-err`} aria-live="polite" className="text-xs text-danger-text">
        {error}
      </p>
    </div>
  );
}

function HourSelect({
  id,
  value,
  onChange,
  from,
  to,
  label,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  from: number;
  to: number;
  label: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} aria-label={label} className="h-8 w-[108px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => (
          <SelectItem key={h} value={String(h)}>
            {hourLabel(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PlantSection() {
  const { t, tx } = useT('settings');
  const plant = usePlantProfile();
  const setPlant = useAdminStore((s) => s.setPlant);
  const [holiday, setHoliday] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const changed = staticFactorsChanged(plant);
  const dayLabel: Record<DayKey, string> = {
    weekday: t('plant.weekday'),
    saturday: cap(formatWeekday(new Date(2024, 0, 6))),
    sunday: cap(formatWeekday(new Date(2024, 0, 7))),
  };

  const setDay = (k: DayKey, patch: Partial<DaySchedule>) =>
    setPlant({ schedule: { ...plant.schedule, [k]: { ...plant.schedule[k], ...patch } } });
  const setShift = (i: number, patch: Partial<ShiftDef>) =>
    setPlant({ shifts: plant.shifts.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const shiftError = validateShifts(plant.shifts);

  const addHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday)) return setHolidayError(t('validation.date'));
    if (plant.holidays.includes(holiday)) return setHolidayError(t('validation.duplicateDate'));
    setPlant({ holidays: [...plant.holidays, holiday].sort() });
    setHoliday('');
    setHolidayError(null);
  };

  return (
    <div className="space-y-6">
      {changed && (
        <p
          role="status"
          className="flex gap-2 rounded-card border border-warning/40 bg-warning-surface px-4 py-3 text-13 text-warning-text"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {t('plant.staticWarning')}
        </p>
      )}
      <SectionCard
        title={t('plant.title')}
        description={t('plant.desc')}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useAdminStore.setState({ plant: {} })}
            disabled={JSON.stringify(plant) === JSON.stringify(defaultPlantProfile)}
          >
            <RotateCcw aria-hidden="true" />
            {t('actions.resetSection')}
          </Button>
        }
      >
        <div className="grid gap-x-5 gap-y-2 md:grid-cols-2">
          <TextField
            id="plant-name"
            label={t('plant.name')}
            value={plant.name}
            max={80}
            onCommit={(v) => setPlant({ name: v })}
          />
          <TextField
            id="plant-sector"
            label={t('plant.sector')}
            value={plant.sector}
            max={120}
            onCommit={(v) => setPlant({ sector: v })}
          />
          <TextField
            id="plant-location"
            label={t('plant.location')}
            value={plant.location}
            max={60}
            onCommit={(v) => setPlant({ location: v })}
          />
          <NumberField
            label={t('plant.area')}
            unit="m²"
            value={plant.areaM2}
            defaultValue={defaultPlantProfile.areaM2}
            onReset={() => setPlant({ areaM2: defaultPlantProfile.areaM2 })}
            rule={{ min: 100, max: 1_000_000, decimals: 0, example: '18 500' }}
            onCommit={(v) => setPlant({ areaM2: v })}
            hint={t('plant.areaHint')}
          />
        </div>
      </SectionCard>

      <SectionCard title={t('plant.scheduleTitle')} description={t('plant.scheduleDesc')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-13">
            <caption className="sr-only">{t('plant.scheduleTitle')}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-2">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('plant.day')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('plant.shifts')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('plant.start')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {t('plant.end')}
                </th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((k) => {
                const d = plant.schedule[k];
                const err = validateDaySchedule(d);
                return (
                  <tr key={k} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                      {dayLabel[k]}
                      {err && (
                        <span className="block text-xs font-normal text-danger-text">
                          {tx(err)}
                        </span>
                      )}
                    </th>
                    <td className="py-2 pr-3">
                      <Select
                        value={String(d.shifts)}
                        onValueChange={(v) =>
                          setDay(
                            k,
                            Number(v) === 0
                              ? { shifts: 0, start: 0, end: 0 }
                              : { shifts: Number(v), start: d.start || 8, end: d.end || 16 },
                          )
                        }
                      >
                        <SelectTrigger
                          aria-label={t('plant.shiftsAria', { day: dayLabel[k] })}
                          className="h-8 w-[130px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 0 ? t('plant.dayOff') : t('plant.shiftCount', { n })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      {d.shifts > 0 ? (
                        <HourSelect
                          id={`start-${k}`}
                          label={t('plant.startAria', { day: dayLabel[k] })}
                          value={d.start}
                          from={0}
                          to={23}
                          onChange={(v) => setDay(k, { start: v })}
                        />
                      ) : (
                        <span className="text-ink-3">{t('plant.noProduction')}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {d.shifts > 0 && (
                        <HourSelect
                          id={`end-${k}`}
                          label={t('plant.endAria', { day: dayLabel[k] })}
                          value={d.end}
                          from={1}
                          to={24}
                          onChange={(v) => setDay(k, { end: v })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-6 text-13 font-semibold text-ink">{t('plant.shiftList')}</h3>
        <ul className="space-y-2">
          {plant.shifts.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-13">
              <span className="w-20 font-medium text-ink">{t('plant.shiftN', { n: i + 1 })}</span>
              <HourSelect
                id={`shift-s-${i}`}
                label={t('plant.shiftStartAria', { n: i + 1 })}
                value={s.start}
                from={0}
                to={23}
                onChange={(v) => setShift(i, { start: v })}
              />
              <span className="text-ink-3" aria-hidden="true">
                –
              </span>
              <HourSelect
                id={`shift-e-${i}`}
                label={t('plant.shiftEndAria', { n: i + 1 })}
                value={s.end}
                from={1}
                to={24}
                onChange={(v) => setShift(i, { end: v })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={plant.shifts.length <= 1}
                onClick={() => setPlant({ shifts: plant.shifts.filter((_, j) => j !== i) })}
                aria-label={t('plant.removeShift', { n: i + 1 })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        {shiftError && (
          <p className="mt-2 text-xs text-danger-text" role="alert">
            {tx(shiftError)}
          </p>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={plant.shifts.length >= 3}
          onClick={() => {
            const last = plant.shifts[plant.shifts.length - 1];
            const start = Math.min(23, last ? last.end % 24 : 8);
            setPlant({
              shifts: [
                ...plant.shifts,
                { id: `s${Date.now().toString(36)}`, start, end: Math.min(24, start + 8) },
              ],
            });
          }}
        >
          <Plus aria-hidden="true" />
          {t('plant.addShift')}
        </Button>
      </SectionCard>

      <SectionCard
        title={t('plant.holidaysTitle')}
        description={t('plant.holidaysDesc')}
        actions={<Badge variant="warning">{t('source.verify')}</Badge>}
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <label htmlFor="holiday-add" className="text-13 font-medium text-ink">
              {t('plant.holidayAdd')}
            </label>
            <Input
              id="holiday-add"
              type="date"
              value={holiday}
              onChange={(e) => setHoliday(e.target.value)}
              aria-invalid={!!holidayError}
              aria-describedby="holiday-err"
              className="w-[180px]"
            />
          </div>
          <Button variant="secondary" onClick={addHoliday}>
            <CalendarPlus aria-hidden="true" />
            {t('plant.holidayAddBtn')}
          </Button>
        </div>
        <p id="holiday-err" aria-live="polite" className="mt-1 text-xs text-danger-text">
          {holidayError}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('plant.holidaysTitle')}>
          {plant.holidays.map((d) => (
            <li
              key={d}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-bg-subtle py-0.5 pl-2 pr-0.5 text-xs text-ink"
            >
              {formatDate(new Date(`${d}T00:00:00`))}
              <button
                type="button"
                onClick={() => setPlant({ holidays: plant.holidays.filter((x) => x !== d) })}
                className="rounded-[4px] p-0.5 text-ink-3 hover:bg-violet-50 hover:text-ink"
                aria-label={t('plant.holidayRemove', { d: formatDate(new Date(`${d}T00:00:00`)) })}
              >
                <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          {t('plant.holidaysNote', { n: plant.holidays.length })}
        </p>
      </SectionCard>
    </div>
  );
}
