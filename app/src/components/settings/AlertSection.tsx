import { BellRing, Info, Mail, MessageCircle, MonitorSmartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatKw, formatNumber, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  ALERT_LIMITS,
  evaluateAlerts,
  type AlertRule,
  type AlertRuleId,
} from '@/services/ReportService.schedule';
import { offlineMinutes, recentPeakKw } from '@/services/ReportService';
import { useAdminStore } from '@/stores/admin';
import { useAnalysis, useAnomalies, useMonthOverview } from '@/stores/derived';
import { NumberField } from './NumberField';
import { SectionCard } from './shared';
import { validateEmail, validateTelegram } from './validation';

const CHANNELS = [
  { key: 'email', icon: Mail },
  { key: 'telegram', icon: MessageCircle },
  { key: 'inApp', icon: MonitorSmartphone },
] as const;

function ContactField({
  id,
  label,
  value,
  validate,
  onCommit,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  validate: (s: string) => { ok: true; value: string } | { ok: false; key: string };
  onCommit: (v: string) => void;
  hint: string;
}) {
  const { tx } = useT('settings');
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-13 font-medium text-ink">
        {label}
      </label>
      <Input
        id={id}
        value={text}
        aria-invalid={!!error}
        aria-describedby={`${id}-d`}
        className={cn(error && 'border-danger')}
        onChange={(e) => {
          setText(e.target.value);
          const r = validate(e.target.value);
          if (r.ok) {
            setError(null);
            onCommit(r.value);
          } else setError(tx(r.key));
        }}
      />
      <p
        id={`${id}-d`}
        aria-live="polite"
        className={cn('text-xs', error ? 'text-danger-text' : 'text-ink-3')}
      >
        {error ?? hint}
      </p>
    </div>
  );
}

export function AlertSection() {
  const { t, tx } = useT('settings');
  const rules = useAdminStore((s) => s.alertRules);
  const contacts = useAdminStore((s) => s.alertContacts);
  const update = useAdminStore((s) => s.updateAlertRule);
  const setContacts = useAdminStore((s) => s.setAlertContacts);
  const { data } = useAnalysis();
  const overview = useMonthOverview();
  const anomalies = useAnomalies();
  const [sent, setSent] = useState<string>('');
  const statuses = useMemo(() => {
    if (!data || !overview || !anomalies) return undefined;
    return evaluateAlerts(rules, {
      overview,
      anomalies,
      peakKw: recentPeakKw(data, 7),
      staleMinutes: offlineMinutes(data),
    });
  }, [data, overview, anomalies, rules]);

  const unit: Record<AlertRuleId, string> = {
    budget: '%',
    anomaly: '',
    peak: t('units.kw'),
    stale: t('units.min'),
    enpi: '%',
  };
  const fmtValue = (r: AlertRule, v: number) =>
    r.id === 'peak'
      ? formatKw(v)
      : r.id === 'anomaly'
        ? formatNumber(v)
        : r.id === 'stale'
          ? t('alerts.minutes', { n: formatNumber(v) })
          : formatPct(v, 0);

  const test = (r: AlertRule) => {
    const ch = CHANNELS.filter((c) => r.channels[c.key]).map((c) => t(`alerts.channel.${c.key}`));
    setSent(
      ch.length
        ? t('alerts.testSent', { rule: tx(`alerts.rule.${r.id}.title`), channels: ch.join(', ') })
        : t('alerts.noChannel'),
    );
  };

  return (
    <div className="space-y-6">
      <p className="flex gap-2 rounded-card border border-info/30 bg-info-surface px-4 py-3 text-13 text-info-text">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {t('alerts.simulation')}
      </p>
      <SectionCard title={t('alerts.contactsTitle')} description={t('alerts.contactsDesc')}>
        <div className="grid gap-5 md:grid-cols-2">
          <ContactField
            id="alert-email"
            label={t('alerts.email')}
            value={contacts.email}
            validate={validateEmail}
            onCommit={(v) => setContacts({ email: v })}
            hint={t('alerts.emailHint')}
          />
          <ContactField
            id="alert-telegram"
            label={t('alerts.telegram')}
            value={contacts.telegram}
            validate={validateTelegram}
            onCommit={(v) => setContacts({ telegram: v })}
            hint={t('alerts.telegramHint')}
          />
        </div>
      </SectionCard>
      <SectionCard title={t('alerts.rulesTitle')} description={t('alerts.rulesDesc')}>
        <p className="sr-only" aria-live="polite">
          {sent}
        </p>
        <ul className="divide-y divide-border">
          {rules.map((r) => {
            const st = statuses?.find((s) => s.id === r.id);
            const lim = ALERT_LIMITS[r.id];
            return (
              <li
                key={r.id}
                className="grid gap-4 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]"
              >
                <div className="flex gap-3">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => update(r.id, { enabled: v })}
                    aria-label={t('alerts.enableAria', { rule: tx(`alerts.rule.${r.id}.title`) })}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {tx(`alerts.rule.${r.id}.title`)}
                    </p>
                    <p className="text-13 text-ink-2">{tx(`alerts.rule.${r.id}.desc`)}</p>
                    {st && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <span>{t('alerts.now', { v: fmtValue(r, st.value) })}</span>
                        {r.enabled &&
                          (st.triggered ? (
                            <Badge variant="danger">
                              <BellRing aria-hidden="true" />
                              {t('alerts.firing')}
                            </Badge>
                          ) : (
                            <Badge variant="success">{t('alerts.quiet')}</Badge>
                          ))}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {r.id === 'anomaly' ? (
                    <div className="grid gap-1.5">
                      <label htmlFor="alert-anomaly-level" className="text-13 font-medium text-ink">
                        {t('alerts.minSeverity')}
                      </label>
                      <Select
                        value={String(r.threshold)}
                        onValueChange={(v) => update(r.id, { threshold: Number(v) })}
                      >
                        <SelectTrigger id="alert-anomaly-level" className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4].map((lvl) => (
                            <SelectItem key={lvl} value={String(lvl)}>
                              {tx(`alerts.level.${lvl}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <NumberField
                      compact
                      label={tx(`alerts.rule.${r.id}.threshold`)}
                      unit={unit[r.id]}
                      value={r.threshold}
                      rule={{
                        min: lim.min,
                        max: lim.max,
                        decimals: lim.decimals,
                        example: formatNumber(lim.min),
                      }}
                      onCommit={(v) => update(r.id, { threshold: v })}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <fieldset>
                    <legend className="mb-1.5 text-13 font-medium text-ink">
                      {t('alerts.channels')}
                    </legend>
                    <div className="flex flex-wrap gap-3">
                      {CHANNELS.map((c) => {
                        const cid = `ch-${r.id}-${c.key}`;
                        return (
                          <span key={c.key} className="inline-flex items-center gap-1.5">
                            <Checkbox
                              id={cid}
                              checked={r.channels[c.key]}
                              onCheckedChange={(v) =>
                                update(r.id, { channels: { ...r.channels, [c.key]: v === true } })
                              }
                            />
                            <label
                              htmlFor={cid}
                              className="inline-flex items-center gap-1 text-13 text-ink"
                            >
                              <c.icon
                                className="size-3.5 text-ink-3"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              {t(`alerts.channel.${c.key}`)}
                            </label>
                          </span>
                        );
                      })}
                    </div>
                  </fieldset>
                  <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => test(r)}>
                    {t('alerts.test')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {sent && (
          <p className="mt-4 rounded-sm bg-bg-subtle px-3 py-2 text-13 text-ink-2" role="status">
            {sent}
          </p>
        )}
      </SectionCard>
    </div>
  );
}
