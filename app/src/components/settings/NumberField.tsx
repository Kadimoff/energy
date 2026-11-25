import { RotateCcw } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatRate } from '@/components/reports/fmt';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { validateNumber, type NumberRule } from './validation';

export interface NumberFieldProps {
  label: string;
  value: number;
  rule: NumberRule;
  onCommit: (v: number) => void;
  unit?: string;
  hint?: ReactNode;
  /** default value; shows "Dəyişdirilib" + reset link when different */
  defaultValue?: number;
  onReset?: () => void;
  badges?: ReactNode;
  className?: string;
  /** compact variant (tables, alert rules) */
  compact?: boolean;
  /** visually hide the label (still announced) */
  hideLabel?: boolean;
}

/**
 * Labelled numeric input with Azerbaijani parsing (0,11 / 50 000) and friendly
 * validation. Valid values are committed on every keystroke, so dependent
 * numbers across the app update instantly; invalid input is never applied.
 */
export function NumberField({
  label,
  value,
  rule,
  onCommit,
  unit,
  hint,
  defaultValue,
  onReset,
  badges,
  className,
  compact,
  hideLabel,
}: NumberFieldProps) {
  const { t, tx } = useT('settings');
  const id = useId();
  const show = (v: number) => formatRate(v, rule.decimals, rule.minDecimals ?? 0);
  const [text, setText] = useState(() => show(value));
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [prev, setPrev] = useState(value);
  // external change (reset, consumer group): resync the text unless the user is typing
  if (value !== prev) {
    setPrev(value);
    if (!focused) {
      setText(show(value));
      setError(null);
    }
  }

  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-12;

  const onChange = (s: string) => {
    setText(s);
    const r = validateNumber(s, rule);
    if (r.ok) {
      setError(null);
      if (r.value !== value) onCommit(r.value);
    } else setError(r.incomplete ? null : tx(r.key, r.params));
  };

  const onBlur = () => {
    setFocused(false);
    const r = validateNumber(text, rule);
    if (r.ok) setText(show(r.value));
    else if (r.incomplete) setError(tx('validation.nan', { example: rule.example }));
  };

  const describedBy = `${id}-desc`;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className={cn('flex min-h-[22px] flex-wrap items-center gap-2', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="text-13 font-medium text-ink">
          {label}
        </label>
        {changed && <Badge variant="violet">{t('field.changed')}</Badge>}
        {badges}
      </div>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={() => setFocused(true)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            unit && 'pr-24',
            compact ? 'h-8' : 'h-9',
            error && 'border-danger focus-visible:border-danger focus-visible:ring-danger-surface',
          )}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">
            {unit}
          </span>
        )}
      </div>
      <div id={describedBy} aria-live="polite" className="text-xs leading-[18px]">
        {error ? (
          <p className="text-danger-text">{error}</p>
        ) : (
          hint && <p className="text-ink-3">{hint}</p>
        )}
        {changed && onReset && (
          <p className="mt-0.5 text-ink-3">
            {t('field.default', { v: show(defaultValue) })}{' '}
            <button
              type="button"
              onClick={onReset}
              aria-label={t('field.resetAria', { label })}
              className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline"
            >
              <RotateCcw className="size-3" strokeWidth={2} aria-hidden="true" />
              {t('field.reset')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
