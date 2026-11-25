import { Check, Info, Minus, ShieldAlert, X } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { baseConfig } from '@/data/config';
import {
  CBAM_GROUPS,
  cbamCheck,
  cbamCost,
  cbamDefaultBasis,
  embeddedPerUnit,
  exampleExportTonnes,
  type CbamBasis,
} from '@/domain/analytics/carbonView';
import type { CbamProductGroup } from '@/domain/carbon';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDate,
  formatKgCo2,
  formatNumber,
  formatShare,
  formatTCo2,
  formatTons,
  NBSP,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRates } from '@/stores/derived';
import { FactorNote } from './FactorNote';

const EXAMPLE_SHARE = 0.1;
const cbamCfg = baseConfig.emissions.cbam;

function CheckRow({
  state,
  label,
  hint,
  control,
}: {
  state: 'yes' | 'no' | 'na';
  label: string;
  hint?: string;
  control?: ReactNode;
}) {
  const { t } = useT('carbon');
  const Icon = state === 'yes' ? Check : state === 'no' ? X : Minus;
  const text =
    state === 'yes'
      ? t('cbam.check.yes')
      : state === 'no'
        ? t('cbam.check.no')
        : t('cbam.check.notApplicable');
  return (
    <li className="flex gap-3 py-3">
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
          state === 'yes'
            ? 'bg-warning-surface text-warning-text'
            : state === 'no'
              ? 'bg-success-surface text-success-text'
              : 'bg-bg-subtle text-ink-3',
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-13 font-medium text-ink">
          {label} <span className="sr-only">: {text}</span>
          <span aria-hidden="true" className="ml-1 text-xs font-normal text-ink-3">
            {text}
          </span>
        </p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
        {control && <div className="mt-2">{control}</div>}
      </div>
    </li>
  );
}

/** CBAM readiness (spec 5.7): checklist, embedded emissions calculator, cost scenario. */
export function CbamSection({
  kwh,
  m3,
  tons,
}: {
  /** basis: last 12 complete months of plant data */
  kwh: number;
  m3: number;
  tons: number;
}) {
  const { t, tx } = useT('carbon');
  const rates = useRates();
  const ids = { group: useId(), exp: useId(), mass: useId(), dom: useId() };
  const [group, setGroup] = useState<CbamProductGroup>('plastics');
  const [toEu, setToEu] = useState(true);
  const [initialExport] = useState(() => exampleExportTonnes(tons, EXAMPLE_SHARE));
  const [exportT, setExportT] = useState(initialExport);
  const [unitMassKg, setUnitMassKg] = useState(1);
  const [ets, setEts] = useState(rates.euEtsPriceEurPerT);
  const [domestic, setDomestic] = useState(0);
  const [basis, setBasis] = useState<CbamBasis>(cbamDefaultBasis('plastics'));

  const check = cbamCheck({
    group,
    exportsToEu: toEu,
    exportTonnesPerYear: exportT,
    coveredGroups: cbamCfg.coveredGroups,
    thresholdT: cbamCfg.freeThresholdTonnesPerYear,
  });
  const emb = useMemo(
    () => embeddedPerUnit(kwh, m3, tons, rates, unitMassKg),
    [kwh, m3, tons, rates, unitMassKg],
  );
  const cost = cbamCost({
    group,
    exportsToEu: toEu,
    exportTonnesPerYear: exportT,
    basis,
    embedded: emb,
    euEtsPriceEurPerT: ets,
    domesticCarbonPriceEur: domestic,
    coveredGroups: cbamCfg.coveredGroups,
    thresholdT: cbamCfg.freeThresholdTonnesPerYear,
    rates,
  });
  const num = (v: string) => {
    const n = Number(v.replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const avro = (v: number, d = 0) => t('cbam.cost.avro', { value: formatNumber(v, d) });

  return (
    <section aria-labelledby="cbam-title" className="space-y-4">
      <div>
        <h2 id="cbam-title" className="text-xl font-semibold tracking-[-0.01em] text-ink">
          {t('cbam.title')}
        </h2>
        <p className="mt-1 text-13 text-ink-2">{t('cbam.subtitle')}</p>
      </div>
      <div
        role="note"
        className="flex gap-3 rounded-card border border-warning/40 bg-warning-surface p-4 text-warning-text"
      >
        <ShieldAlert className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <div className="space-y-1.5 text-13">
          <p className="font-semibold">{t('cbam.disclaimer')}</p>
          <p className="text-ink-2">
            {t('cbam.timeline', {
              from: formatDate(new Date(cbamCfg.definitivePhaseFrom)),
              due: formatDate(new Date(cbamCfg.firstDeclarationDue)),
            })}
          </p>
          <p className="text-ink-2">{t('cbam.plantNote')}</p>
          <p className="text-ink-2">{t('cbam.importerNote')}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('cbam.check.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="divide-y divide-border">
              <CheckRow
                state={check.inScope ? 'yes' : 'no'}
                label={t('cbam.check.q1')}
                hint={t('cbam.check.q1Hint')}
                control={
                  <div className="space-y-1.5">
                    <label htmlFor={ids.group} className="text-xs font-medium text-ink-2">
                      {t('cbam.check.group')}
                    </label>
                    <Select
                      value={group}
                      onValueChange={(v) => {
                        const g = v as CbamProductGroup;
                        setGroup(g);
                        setBasis(cbamDefaultBasis(g));
                      }}
                    >
                      <SelectTrigger id={ids.group} className="sm:max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CBAM_GROUPS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {tx(`cbam.group.${g}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                }
              />
              <CheckRow
                state={toEu ? 'yes' : 'no'}
                label={t('cbam.check.q2')}
                control={
                  <Switch
                    checked={toEu}
                    onCheckedChange={setToEu}
                    aria-label={t('cbam.check.q2')}
                  />
                }
              />
              <CheckRow
                state={!check.thresholdApplies ? 'na' : check.belowThreshold ? 'no' : 'yes'}
                label={t('cbam.check.q3')}
                hint={
                  check.thresholdApplies ? t('cbam.check.q3Hint') : t('cbam.check.q3NoThreshold')
                }
                control={
                  <div className="space-y-1.5">
                    <label htmlFor={ids.exp} className="text-xs font-medium text-ink-2">
                      {t('cbam.check.exportVolume')}
                    </label>
                    <Input
                      id={ids.exp}
                      inputMode="decimal"
                      className="sm:max-w-[180px]"
                      defaultValue={String(initialExport)}
                      onChange={(e) => setExportT(num(e.target.value))}
                    />
                    <p className="text-xs text-ink-3">
                      {t('cbam.check.exportDefault', { pct: formatShare(EXAMPLE_SHARE) })}
                    </p>
                  </div>
                }
              />
            </ul>
            <p
              role="status"
              className={cn(
                'mt-2 flex gap-2 rounded-md p-3 text-13 font-medium',
                check.liable
                  ? 'bg-danger-surface text-danger-text'
                  : 'bg-success-surface text-success-text',
              )}
            >
              <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {tx(`cbam.check.verdict.${check.verdict}`)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('cbam.embedded.title')}</CardTitle>
              <CardDescription>
                {t('cbam.embedded.subtitle', { tons: formatTons(tons) })}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={ids.mass} className="text-13 font-medium text-ink">
                {t('cbam.embedded.unitMass')}
              </label>
              <Input
                id={ids.mass}
                inputMode="decimal"
                className="max-w-[180px]"
                defaultValue="1"
                onChange={(e) => setUnitMassKg(num(e.target.value))}
              />
              <p className="text-xs text-ink-3">{t('cbam.embedded.unitMassHint')}</p>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">{t('cbam.embedded.title')}</caption>
                <thead className="bg-bg-subtle text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium" />
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {t('cbam.embedded.perTon')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {t('cbam.embedded.perUnit')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(
                    [
                      ['direct', emb.directKgPerT, emb.directKgPerUnit],
                      ['indirect', emb.indirectKgPerT, emb.indirectKgPerUnit],
                      ['total', emb.totalKgPerT, emb.totalKgPerUnit],
                    ] as const
                  ).map(([k, perT, perUnit]) => (
                    <tr key={k} className={k === 'total' ? 'font-semibold' : undefined}>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                        {tx(`cbam.embedded.${k}`)}
                      </th>
                      <td className="px-3 py-2 text-right">{formatKgCo2(perT)}</td>
                      <td className="px-3 py-2 text-right">{formatKgCo2(perUnit, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FactorNote kinds={['scope1', 'scope2']} short className="text-xs" />
            <p className="text-xs text-ink-3">{t('cbam.embedded.basisNote')}</p>
            <p className="text-xs text-ink-3">{t('cbam.embedded.allocationNote')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('cbam.cost.title')}</CardTitle>
            <CardDescription>{t('cbam.cost.subtitle')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!check.inScope && (
            <p className="mb-4 rounded-sm bg-info-surface px-3 py-2 text-13 text-info-text">
              {t('cbam.cost.hypothetical')}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-13 font-medium text-ink">{t('cbam.cost.etsPrice')}</span>
                  <output className="text-13 font-semibold tabular-nums text-violet-700">
                    {avro(ets)}
                  </output>
                </div>
                <Slider
                  value={[ets]}
                  min={20}
                  max={200}
                  step={1}
                  onValueChange={([v]) => setEts(v)}
                  thumbLabel={t('cbam.cost.etsPrice')}
                />
                <p className="text-xs text-ink-3">
                  {t('cbam.cost.etsHint', { value: avro(rates.euEtsPriceEurPerT) })}
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={ids.dom} className="text-13 font-medium text-ink">
                  {t('cbam.cost.domesticPrice')}
                </label>
                <Input
                  id={ids.dom}
                  inputMode="decimal"
                  className="max-w-[180px]"
                  defaultValue="0"
                  onChange={(e) => setDomestic(num(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <p className="text-13 font-medium text-ink">{t('cbam.cost.basis')}</p>
                <Tabs value={basis} onValueChange={(v) => setBasis(v as CbamBasis)}>
                  <TabsList aria-label={t('cbam.cost.basis')}>
                    <TabsTrigger value="direct">{t('cbam.cost.basisDirect')}</TabsTrigger>
                    <TabsTrigger value="total">{t('cbam.cost.basisTotal')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div>
              <dl className="grid grid-cols-2 gap-3" aria-live="polite">
                <div className="rounded-md border border-border p-4">
                  <dt className="text-xs text-ink-3">{t('cbam.cost.embeddedTotal')}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                    {formatTCo2(cost.embeddedTotalT, 0)}
                  </dd>
                  <dd className="text-xs tabular-nums text-ink-3">
                    {formatTons(exportT)} × {formatKgCo2(cost.embeddedKgPerT)}/t
                  </dd>
                </div>
                <div className="rounded-md border border-border p-4">
                  <dt className="text-xs text-ink-3">{t('cbam.cost.costEur')}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                    {avro(cost.costEur)}
                  </dd>
                </div>
                <div className="rounded-md border border-border p-4">
                  <dt className="text-xs text-ink-3">{t('cbam.cost.costAzn')}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                    {formatAzn(cost.costAzn)}
                  </dd>
                  <dd className="text-xs text-ink-3">
                    {t('cbam.cost.rate', { value: `${formatNumber(rates.eurToAzn, 2)}${NBSP}AZN` })}
                  </dd>
                </div>
                <div className="rounded-md border border-border p-4">
                  <dt className="text-xs text-ink-3">{t('cbam.cost.perTon')}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                    {formatAzn(cost.costPerTonAzn, 1)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-3">{t('cbam.cost.upperNote')}</p>
              <p className="mt-2 text-xs font-semibold text-warning-text">{t('cbam.disclaimer')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
