import { RotateCcw, Save } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { BeforeAfterChart } from '@/components/charts/analytics/BeforeAfterChart';
import { SourceTooltip } from '@/components/common/SourceTooltip';
import { ChartSkeleton } from '@/components/common/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { baseConfig } from '@/data/config';
import type { MetricDelta, OutcomeMetric } from '@/domain/analytics/forecastView';
import { defaultScenario, type ScenarioInput } from '@/domain/scenario';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatEnergy,
  formatEnpi,
  formatNumber,
  formatPct,
  formatSigned,
  formatTCo2,
  formatTemp,
  NBSP,
  UNITS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRates } from '@/stores/derived';
import { useScenarioStore } from '@/stores/scenarios';
import { useChecklist, useSimulation } from './hooks';
import { ChangeChips } from './ChangeChips';

const metricFormat: Record<OutcomeMetric, (v: number) => string> = {
  costAzn: (v) => formatAzn(v),
  deltaVsBudgetAzn: (v) => formatAzn(v),
  kwh: (v) => formatEnergy(v),
  co2T: (v) => formatTCo2(v),
  enpiKwhPerT: (v) => formatEnpi(v),
};

const fmtTariff = (v: number) => `${formatNumber(v, 3)}${NBSP}AZN/${UNITS.kwh}`;
const fmtGrid = (v: number) => `${formatNumber(v, 2)}${NBSP}${UNITS.kgCo2}/${UNITS.kwh}`;

function ControlRow({
  label,
  value,
  hint,
  children,
  extra,
}: {
  label: string;
  value: string;
  hint?: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-13 font-medium text-ink">
          {label}
          {extra}
        </span>
        <output className="text-13 font-semibold tabular-nums text-violet-700">{value}</output>
      </div>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

function MetricTile({
  d,
  label,
  primary,
  className,
}: {
  d: MetricDelta;
  label: string;
  primary?: boolean;
  className?: string;
}) {
  const { t } = useT('forecast');
  const fmt = metricFormat[d.metric];
  const tone =
    d.better === null
      ? 'bg-bg-subtle text-ink-2'
      : d.better
        ? 'bg-success-surface text-success-text'
        : 'bg-danger-surface text-danger-text';
  const main =
    d.metric === 'deltaVsBudgetAzn' ? `${formatSigned(d.scenario, fmt)}` : fmt(d.scenario);
  return (
    <div className={cn('min-w-0 rounded-md border border-border bg-surface p-4', className)}>
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p
        className={cn(
          'mt-1 font-semibold tabular-nums tracking-[-0.01em] text-ink',
          primary ? 'text-2xl' : 'text-lg',
        )}
      >
        {main}
      </p>
      {d.metric === 'deltaVsBudgetAzn' && (
        <p className={cn('text-xs', d.scenario > 0 ? 'text-danger-text' : 'text-success-text')}>
          {d.scenario > 0 ? t('sim.overBudget') : t('sim.underBudget')}
        </p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
        <span className={cn('rounded-[6px] px-1.5 py-0.5 font-semibold tabular-nums', tone)}>
          {d.better === null ? t('sim.noChange') : formatSigned(d.delta, fmt)}
        </span>
        {d.better !== null && Number.isFinite(d.deltaPct) && d.metric !== 'deltaVsBudgetAzn' && (
          <span className="tabular-nums">{formatSigned(d.deltaPct, (v) => formatPct(v, 1))}</span>
        )}
      </p>
      <p className="mt-1 truncate text-xs tabular-nums text-ink-3">
        {t('sim.base', {
          value: d.metric === 'deltaVsBudgetAzn' ? formatSigned(d.base, fmt) : fmt(d.base),
        })}
      </p>
    </div>
  );
}

/** "Nə olar əgər" simulator (spec 7.8): controls, instant results, before/after, save. */
export function Simulator({
  input,
  onChange,
}: {
  input: ScenarioInput;
  onChange: (next: ScenarioInput) => void;
}) {
  const { t, tx } = useT('forecast');
  const rates = useRates();
  const sim = useSimulation(input);
  const checklist = useChecklist();
  const save = useScenarioStore((s) => s.save);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const nameId = useId();
  const set = (patch: Partial<ScenarioInput>) => onChange({ ...input, ...patch });
  const tariff = input.tariffAznPerKwh ?? rates.electricityRateAznPerKwh;
  const grid = input.gridKgCo2PerKwh ?? rates.scope2KgCo2PerKwh;
  const s2 = baseConfig.emissions.scope2;
  const onSave = () => {
    const n = name.trim();
    if (!n) {
      setMessage({ text: t('sim.save.required'), error: true });
      return;
    }
    save(n, sim?.input ?? input);
    setName('');
    setMessage({ text: t('sim.save.saved', { name: n }), error: false });
  };
  const toggleRec = (id: string, on: boolean) =>
    set({
      recommendationIds: on
        ? [...input.recommendationIds, id]
        : input.recommendationIds.filter((x) => x !== id),
    });

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="sim-title">
      <div className="flex flex-col gap-1">
        <h2 id="sim-title" className="text-lg font-semibold text-ink">
          {t('sim.title')}
        </h2>
        <p className="text-13 text-ink-2">{t('sim.subtitle', { days: sim?.days ?? '…' })}</p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <section aria-label={t('sim.controls')} className="space-y-5">
          <div className="space-y-2">
            <p className="text-13 font-medium text-ink">{t('sim.period')}</p>
            <Tabs
              value={String(input.monthOffset)}
              onValueChange={(v) => set({ monthOffset: v === '1' ? 1 : 0 })}
            >
              <TabsList aria-label={t('sim.period')} className="w-full">
                <TabsTrigger value="0" className="flex-1">
                  {t('sim.thisMonth')}
                </TabsTrigger>
                <TabsTrigger value="1" className="flex-1">
                  {t('sim.nextMonth')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ControlRow
            label={t('sim.production')}
            value={formatSigned(input.productionPct, (v) => formatPct(v))}
            hint={t('sim.productionHint')}
          >
            <Slider
              value={[input.productionPct]}
              min={-30}
              max={30}
              step={1}
              onValueChange={([v]) => set({ productionPct: v })}
              thumbLabel={t('sim.production')}
            />
          </ControlRow>
          <ControlRow
            label={t('sim.temperature')}
            value={formatSigned(input.tempDeltaC, (v) => formatTemp(v))}
            hint={t('sim.temperatureHint')}
          >
            <Slider
              value={[input.tempDeltaC]}
              min={-10}
              max={10}
              step={0.5}
              onValueChange={([v]) => set({ tempDeltaC: v })}
              thumbLabel={t('sim.temperature')}
            />
          </ControlRow>
          <div className="space-y-2">
            <p className="text-13 font-medium text-ink">{t('sim.shifts')}</p>
            <Tabs
              value={String(input.shifts)}
              onValueChange={(v) => set({ shifts: Number(v) as 1 | 2 | 3 })}
            >
              <TabsList aria-label={t('sim.shifts')} className="h-auto w-full">
                {([1, 2, 3] as const).map((n) => (
                  <TabsTrigger key={n} value={String(n)} className="h-auto flex-1 flex-col py-1">
                    <span>{tx(`sim.shift${n}`)}</span>
                    <span className="text-xs font-normal text-ink-3">
                      {t('sim.shiftHours', { hours: n * 8 })}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <ControlRow
            label={t('sim.tariff')}
            value={fmtTariff(tariff)}
            hint={t('sim.tariffHint', { value: fmtTariff(rates.electricityRateAznPerKwh) })}
          >
            <Slider
              value={[tariff]}
              min={0.05}
              max={0.2}
              step={0.005}
              onValueChange={([v]) => set({ tariffAznPerKwh: v })}
              thumbLabel={t('sim.tariff')}
            />
          </ControlRow>
          <ControlRow
            label={t('sim.grid')}
            value={fmtGrid(grid)}
            hint={t('sim.gridHint', { value: fmtGrid(rates.scope2KgCo2PerKwh) })}
            extra={
              <SourceTooltip
                label={t('sim.grid')}
                value={fmtGrid(rates.scope2KgCo2PerKwh)}
                source={s2.source}
                date={s2.date}
                lastChecked={s2.lastChecked}
                verify={s2.verify}
              />
            }
          >
            <Slider
              value={[grid]}
              min={0.2}
              max={0.6}
              step={0.01}
              onValueChange={([v]) => set({ gridKgCo2PerKwh: v })}
              thumbLabel={t('sim.grid')}
            />
          </ControlRow>
          <fieldset className="space-y-2">
            <legend className="text-13 font-medium text-ink">{t('sim.recs')}</legend>
            <p className="text-xs text-ink-3">{t('sim.recsHint')}</p>
            <ul className="max-h-[300px] space-y-1 overflow-y-auto rounded-md border border-border p-1.5">
              {checklist?.map((c) => {
                const id = `rec-${c.id}`;
                const checked = c.active || input.recommendationIds.includes(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-bg-subtle"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={c.active}
                      onCheckedChange={(v) => toggleRec(c.id, v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-13 text-ink">
                      <span className="block leading-snug">{tx(`common:rec.title.${c.id}`)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        <span className="tabular-nums">
                          {t('sim.perMonth', { value: formatAzn(c.aznPerMonth) })}
                        </span>
                        {c.active && <Badge variant="violet">{t('sim.recActive')}</Badge>}
                        {c.rejected && <Badge variant="neutral">{t('sim.recRejected')}</Badge>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...defaultScenario })}
            className="-ml-2"
          >
            <RotateCcw aria-hidden="true" />
            {t('sim.reset')}
          </Button>
        </section>

        <section aria-label={t('sim.resultsAria')} className="min-w-0 space-y-5">
          {!sim ? (
            <ChartSkeleton height={420} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{t('sim.results')}</h3>
                <ChangeChips input={sim.input} />
              </div>
              <div
                className={cn(
                  'grid grid-cols-2 gap-3 transition-opacity duration-180 sm:grid-cols-6',
                  sim.pending && 'opacity-70',
                )}
                aria-live="polite"
              >
                {sim.deltas.map((d, i) => (
                  <MetricTile
                    key={d.metric}
                    d={d}
                    label={tx(`sim.metric.${d.metric}`)}
                    className={cn(
                      i < 2 ? 'sm:col-span-3' : 'sm:col-span-2',
                      i === 4 && 'col-span-2 sm:col-span-2',
                    )}
                    primary={i < 2}
                  />
                ))}
              </div>
              <BeforeAfterChart
                points={sim.series}
                labels={{
                  title: t('sim.beforeAfter.title'),
                  summary: t('sim.beforeAfter.summary', {
                    diff: formatSigned(
                      sim.deltas.find((d) => d.metric === 'kwh')?.delta ?? 0,
                      (v) => formatEnergy(v),
                    ),
                  }),
                  date: t('sim.beforeAfter.date'),
                  before: t('sim.beforeAfter.before'),
                  after: t('sim.beforeAfter.after'),
                  daily: t('sim.beforeAfter.daily'),
                  cumulative: t('sim.beforeAfter.cumulative'),
                  remaining: t('sim.beforeAfter.remaining'),
                  difference: t('sim.beforeAfter.difference'),
                }}
              />
              <form
                className="flex flex-col gap-2 rounded-md border border-border bg-bg-subtle p-4 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSave();
                }}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor={nameId} className="text-13 font-medium text-ink">
                    {t('sim.save.name')}
                  </label>
                  <Input
                    id={nameId}
                    value={name}
                    maxLength={60}
                    placeholder={t('sim.save.placeholder')}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={message?.error || undefined}
                  />
                </div>
                <Button type="submit" variant="primary">
                  <Save aria-hidden="true" />
                  {t('sim.save.button')}
                </Button>
              </form>
              <p
                role="status"
                className={cn(
                  'min-h-[18px] text-xs',
                  message?.error ? 'text-danger-text' : 'text-success-text',
                )}
              >
                {message?.text}
              </p>
            </>
          )}
        </section>
      </div>
    </Card>
  );
}
