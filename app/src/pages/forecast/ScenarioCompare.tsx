import { FolderOpen, GitCompare, Trash2 } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/Skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  compareOutcomes,
  normalizeScenario,
  type OutcomeMetric,
} from '@/domain/analytics/forecastView';
import { defaultScenario, type ScenarioInput } from '@/domain/scenario';
import { useT } from '@/i18n';
import {
  formatAzn,
  formatDate,
  formatEnergy,
  formatEnpi,
  formatSigned,
  formatTCo2,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRates, useScenario } from '@/stores/derived';
import { useScenarioStore } from '@/stores/scenarios';
import { ChangeChips } from './ChangeChips';

const fmt: Record<OutcomeMetric, (v: number) => string> = {
  costAzn: (v) => formatAzn(v),
  deltaVsBudgetAzn: (v) => formatSigned(v, (x) => formatAzn(x)),
  kwh: (v) => formatEnergy(v),
  co2T: (v) => formatTCo2(v),
  enpiKwhPerT: (v) => formatEnpi(v),
};
const fmtDiff: Record<OutcomeMetric, (v: number) => string> = {
  costAzn: (v) => formatSigned(v, (x) => formatAzn(x)),
  deltaVsBudgetAzn: (v) => formatSigned(v, (x) => formatAzn(x)),
  kwh: (v) => formatSigned(v, (x) => formatEnergy(x)),
  co2T: (v) => formatSigned(v, (x) => formatTCo2(x)),
  enpiKwhPerT: (v) => formatSigned(v, (x) => formatEnpi(x)),
};

/** Saved scenarios (load / delete) and a side-by-side comparison of two scenarios. */
export function ScenarioCompare({
  current,
  onLoad,
}: {
  current: ScenarioInput;
  onLoad: (input: ScenarioInput) => void;
}) {
  const { t, tx } = useT('forecast');
  const rates = useRates();
  const saved = useScenarioStore((s) => s.saved);
  const remove = useScenarioStore((s) => s.remove);
  const deferred = useDeferredValue(current);
  const [a, setA] = useState('base');
  const [b, setB] = useState('current');
  const options = useMemo(
    () => [
      { id: 'base', name: t('saved.optionBase'), input: defaultScenario },
      { id: 'current', name: t('saved.optionCurrent'), input: normalizeScenario(deferred, rates) },
      ...saved.map((s) => ({ id: s.id, name: s.name, input: s.input })),
    ],
    [saved, deferred, rates, t],
  );
  const optA = options.find((o) => o.id === a) ?? options[0];
  const optB = options.find((o) => o.id === b) ?? options[1];
  const resA = useScenario(optA.input);
  const resB = useScenario(optB.input);
  const rows = resA && resB ? compareOutcomes(resA.scenario, resB.scenario) : null;

  const picker = (value: string, onValue: (v: string) => void, label: string) => (
    <div className="min-w-0 flex-1 space-y-1.5">
      <p className="text-xs font-medium text-ink-2" id={`cmp-${label}`}>
        {label}
      </p>
      <Select value={value} onValueChange={onValue}>
        <SelectTrigger aria-labelledby={`cmp-${label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="saved-title">
      <h2 id="saved-title" className="text-lg font-semibold text-ink">
        {t('saved.title')}
      </h2>
      <p className="mt-1 text-13 text-ink-2">{t('saved.subtitle')}</p>
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          {saved.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-strong">
              <EmptyState
                compact
                icon={FolderOpen}
                title={t('saved.empty')}
                body={t('saved.emptyBody')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {saved.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                    <p className="text-xs text-ink-3">
                      {t('saved.created', { date: formatDate(s.createdAt) })}
                    </p>
                    <ChangeChips input={s.input} className="mt-2 flex flex-wrap gap-1.5" />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => onLoad(s.input)}
                      aria-label={t('saved.loadAria', { name: s.name })}
                    >
                      <FolderOpen aria-hidden="true" />
                      {t('saved.load')}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        remove(s.id);
                        if (a === s.id) setA('base');
                        if (b === s.id) setB('current');
                      }}
                      aria-label={t('saved.removeAria', { name: s.name })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <section aria-label={t('saved.compareAria')} className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <GitCompare className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
            {t('saved.compare')}
          </h3>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            {picker(a, setA, t('saved.compareA'))}
            {picker(b, setB, t('saved.compareB'))}
          </div>
          {!rows ? (
            <TableSkeleton rows={5} cols={4} className="mt-4" />
          ) : (
            <div className="mt-4 rounded-md border border-border">
              <Table>
                <caption className="sr-only">{t('saved.compareAria')}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('saved.metric')}</TableHead>
                    {[optA, optB].map((o, i) => (
                      <TableHead key={i} className="text-right">
                        <span className="block">{o.name}</span>
                        <span className="block font-normal text-ink-3">
                          {o.input.monthOffset === 1 ? t('sim.nextMonth') : t('sim.thisMonth')}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t('saved.difference')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.metric}>
                      <TableCell className="font-medium">{tx(`sim.metric.${r.metric}`)}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          r.winner === 'a' && 'font-semibold text-success-text',
                        )}
                      >
                        {fmt[r.metric](r.a)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          r.winner === 'b' && 'font-semibold text-success-text',
                        )}
                      >
                        {fmt[r.metric](r.b)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-ink-2">
                        {r.winner === null ? t('saved.equal') : fmtDiff[r.metric](r.diff)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t border-border px-3 py-2 text-xs text-ink-3">
                <span className="font-semibold text-success-text">{t('saved.better')}</span>
                {': '}
                {t('saved.betterNote')}
              </p>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}
