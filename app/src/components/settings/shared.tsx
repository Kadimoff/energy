import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n';
import { formatDate } from '@/lib/format';
import { useAdminStore, type CheckedId } from '@/stores/admin';
import { useRates } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';
import { useDefaultRates } from './hooks';
import { NumberField } from './NumberField';
import { FIELD_RULES, type NumericKey } from './validation';

export function SectionCard({
  title,
  description,
  children,
  actions,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <Card id={id}>
      <CardHeader className="flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Numeric field bound to a Settings override; every valid keystroke updates all calculations. */
export function RateField({
  k,
  label,
  unit,
  hint,
  badges,
}: {
  k: NumericKey;
  label: string;
  unit?: string;
  hint?: ReactNode;
  badges?: ReactNode;
}) {
  const rates = useRates();
  const defaults = useDefaultRates();
  const setOverride = useSettingsStore((s) => s.setOverride);
  const reset = useSettingsStore((s) => s.reset);
  const def = defaults[k];
  return (
    <NumberField
      label={label}
      unit={unit}
      hint={hint}
      badges={badges}
      value={rates[k]}
      defaultValue={def}
      rule={FIELD_RULES[k]}
      onCommit={(v) => (Math.abs(v - def) < 1e-12 ? reset(k) : setOverride(k, v))}
      onReset={() => reset(k)}
    />
  );
}

/** Source link + last check date + "verify" note next to a tariff or factor. */
export function SourceMeta({
  checkedId,
  source,
  sourceUrl,
  lastChecked,
  verify,
  placeholder,
  basis,
  date,
  nowMs,
}: {
  checkedId: CheckedId;
  source: string;
  sourceUrl?: string | null;
  lastChecked: string | null;
  verify?: boolean;
  placeholder?: boolean;
  basis?: string | null;
  date?: string | null;
  nowMs: number;
}) {
  const { t } = useT('settings');
  const checked = useAdminStore((s) => s.checked[checkedId]);
  const mark = useAdminStore((s) => s.markChecked);
  const last = checked ?? lastChecked;
  const today = new Date(nowMs);
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return (
    <div className="rounded-md border border-border bg-bg-subtle px-3 py-2.5 text-xs leading-5 text-ink-2">
      <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-3">{t('source.source')}</dt>
        <dd className="min-w-0">
          {source}
          {sourceUrl && (
            <>
              {' '}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 font-medium text-violet-700 hover:underline"
              >
                {
                  sourceUrl
                    .replace(/^https?:\/\//, '')
                    .replace(/\/$/, '')
                    .split('/')[0]
                }
                <ExternalLink className="size-3" strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">{t('source.newTab')}</span>
              </a>
            </>
          )}
        </dd>
        {basis && (
          <>
            <dt className="text-ink-3">{t('source.basis')}</dt>
            <dd>{basis}</dd>
          </>
        )}
        {date && (
          <>
            <dt className="text-ink-3">{t('source.date')}</dt>
            <dd>{date}</dd>
          </>
        )}
        <dt className="text-ink-3">{t('source.lastChecked')}</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">
            {last ? formatDate(new Date(last)) : t('source.never')}
          </span>
          {(placeholder || verify) && (
            <Badge variant="warning" className="py-0">
              {placeholder ? t('source.placeholder') : t('source.verify')}
            </Badge>
          )}
        </dd>
      </dl>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mt-1 h-7"
        onClick={() => mark(checkedId, iso)}
        disabled={last === iso}
      >
        <CheckCircle2 aria-hidden="true" />
        {last === iso ? t('source.checkedToday') : t('source.markChecked')}
      </Button>
    </div>
  );
}
