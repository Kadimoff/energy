import { RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { baseConfig, type SettingsOverrides } from '@/data/config';
import { budgetKwh } from '@/domain/cost';
import { useT } from '@/i18n';
import { formatDate, formatMwh } from '@/lib/format';
import { cn } from '@/lib/utils';
import { formatRate } from '@/components/reports/fmt';
import { useRates } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';
import { RateField, SectionCard, SourceMeta } from './shared';

type Key = keyof SettingsOverrides;

function SectionReset({ keys }: { keys: Key[] }) {
  const { t } = useT('settings');
  const overrides = useSettingsStore((s) => s.overrides);
  const reset = useSettingsStore((s) => s.reset);
  const dirty = keys.some((k) => overrides[k] !== undefined);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={!dirty}
      onClick={() => keys.forEach((k) => reset(k))}
    >
      <RotateCcw aria-hidden="true" />
      {t('actions.resetSection')}
    </Button>
  );
}

export function BudgetSection() {
  const { t } = useT('settings');
  const rates = useRates();
  return (
    <SectionCard
      title={t('budget.title')}
      description={t('budget.desc')}
      actions={<SectionReset keys={['electricityBudgetAzn', 'gasBudgetAzn']} />}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <RateField
          k="electricityBudgetAzn"
          label={t('budget.electricity')}
          unit={t('units.aznMonth')}
          hint={t('budget.electricityHint', { mwh: formatMwh(budgetKwh(rates)) })}
        />
        <RateField
          k="gasBudgetAzn"
          label={t('budget.gas')}
          unit={t('units.aznMonth')}
          hint={t('budget.gasHint')}
        />
      </div>
    </SectionCard>
  );
}

export function TariffSection({ nowMs }: { nowMs: number }) {
  const { t, tx } = useT('settings');
  const rates = useRates();
  const groupOverride = useSettingsStore((s) => s.overrides.consumerGroup);
  const rateOverride = useSettingsStore((s) => s.overrides.electricityRateAznPerKwh);
  const setOverride = useSettingsStore((s) => s.setOverride);
  const reset = useSettingsStore((s) => s.reset);
  const el = baseConfig.tariffs.electricity;
  const gas = baseConfig.tariffs.gas;
  const selectGroup = (id: string) => {
    if (id === el.defaultConsumerGroup) reset('consumerGroup');
    else setOverride('consumerGroup', id);
    reset('electricityRateAznPerKwh');
  };
  return (
    <div className="space-y-6">
      <SectionCard
        title={t('tariff.electricityTitle')}
        description={t('tariff.electricityDesc')}
        actions={
          <SectionReset
            keys={['consumerGroup', 'electricityRateAznPerKwh', 'electricityFixedFeeAzn']}
          />
        }
      >
        <fieldset>
          <legend className="mb-2 text-13 font-medium text-ink">{t('tariff.group')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {el.consumerGroups.map((g) => {
              const active = rates.consumerGroup === g.id;
              return (
                <label
                  key={g.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-180 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-600 has-[:focus-visible]:ring-offset-2',
                    active ? 'border-violet-300 bg-violet-50' : 'border-border hover:bg-bg-subtle',
                  )}
                >
                  <input
                    type="radio"
                    name="consumer-group"
                    checked={active}
                    onChange={() => selectGroup(g.id)}
                    className="mt-1 size-4 accent-violet-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {tx(`common:${g.labelKey}`)}
                    </span>
                    <span className="block text-13 tabular-nums text-ink-2">
                      {formatRate(g.rateAznPerKwh, 3, 2)} {t('units.aznKwh')}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {groupOverride === undefined && (
            <p className="mt-1.5 text-xs text-ink-3">{t('tariff.groupDefault')}</p>
          )}
        </fieldset>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <RateField
            k="electricityRateAznPerKwh"
            label={t('tariff.kwh')}
            unit={t('units.aznKwh')}
            hint={rateOverride !== undefined ? t('tariff.customRate') : t('tariff.kwhHint')}
            badges={
              rateOverride !== undefined ? (
                <Badge variant="info">{t('tariff.custom')}</Badge>
              ) : undefined
            }
          />
          <RateField
            k="electricityFixedFeeAzn"
            label={t('tariff.fixedFee')}
            unit={t('units.aznMonth')}
            hint={t('tariff.fixedFeeHint', {
              date: formatDate(new Date(el.fixedFeeEffectiveFrom)),
            })}
          />
        </div>
        <div className="mt-4">
          <SourceMeta
            checkedId="tariff.electricity"
            source={el.source}
            sourceUrl={el.sourceUrl}
            lastChecked={el.lastChecked}
            verify={el.verify}
            nowMs={nowMs}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={t('tariff.gasTitle')}
        description={t('tariff.gasDesc')}
        actions={<SectionReset keys={['gasRateAznPerM3', 'gasFixedFeeAzn']} />}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <RateField
            k="gasRateAznPerM3"
            label={t('tariff.gasRate')}
            unit={t('units.aznM3')}
            hint={t('tariff.gasRateHint')}
            badges={
              gas.placeholder ? (
                <Badge variant="warning">{t('source.placeholder')}</Badge>
              ) : undefined
            }
          />
          <RateField
            k="gasFixedFeeAzn"
            label={t('tariff.gasFixedFee')}
            unit={t('units.aznMonth')}
          />
        </div>
        <div className="mt-4">
          <SourceMeta
            checkedId="tariff.gas"
            source={gas.source}
            sourceUrl={gas.sourceUrl}
            lastChecked={gas.lastChecked}
            verify={gas.verify}
            placeholder={gas.placeholder}
            nowMs={nowMs}
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function EmissionSection({ nowMs }: { nowMs: number }) {
  const { t } = useT('settings');
  const em = baseConfig.emissions;
  return (
    <div className="space-y-6">
      <SectionCard
        title={t('emission.title')}
        description={t('emission.desc')}
        actions={<SectionReset keys={['scope1KgCo2PerKwh', 'scope2KgCo2PerKwh', 'gasKwhPerM3']} />}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <RateField
              k="scope2KgCo2PerKwh"
              label={t('emission.scope2')}
              unit={t('units.kgKwh')}
              hint={t('emission.scope2Hint')}
            />
            <SourceMeta
              checkedId="emission.scope2"
              source={em.scope2.source}
              sourceUrl={em.scope2.sourceUrl}
              basis={em.scope2.basis}
              date={em.scope2.date}
              lastChecked={em.scope2.lastChecked}
              verify={em.scope2.verify}
              nowMs={nowMs}
            />
          </div>
          <div className="space-y-3">
            <RateField
              k="scope1KgCo2PerKwh"
              label={t('emission.scope1')}
              unit={t('units.kgKwh')}
              hint={t('emission.scope1Hint')}
            />
            <SourceMeta
              checkedId="emission.scope1"
              source={em.scope1.source}
              sourceUrl={em.scope1.sourceUrl}
              basis={em.scope1.basis}
              date={em.scope1.date}
              lastChecked={em.scope1.lastChecked}
              verify={em.scope1.verify}
              nowMs={nowMs}
            />
          </div>
          <div className="space-y-3">
            <RateField
              k="gasKwhPerM3"
              label={t('emission.gasKwh')}
              unit={t('units.kwhM3')}
              hint={t('emission.gasKwhHint')}
            />
            <SourceMeta
              checkedId="emission.gasKwhPerM3"
              source={em.gasKwhPerM3.source}
              lastChecked={em.gasKwhPerM3.lastChecked}
              verify={em.gasKwhPerM3.verify}
              nowMs={nowMs}
            />
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title={t('emission.cbamTitle')}
        description={t('emission.cbamDesc')}
        actions={<SectionReset keys={['euEtsPriceEurPerT', 'eurToAzn']} />}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <RateField k="euEtsPriceEurPerT" label={t('emission.ets')} unit={t('units.eurT')} />
          <RateField k="eurToAzn" label={t('emission.eurAzn')} unit={t('units.azn')} />
        </div>
        <div className="mt-4">
          <SourceMeta
            checkedId="emission.cbam"
            source={em.cbam.source}
            lastChecked={em.cbam.lastChecked}
            verify={em.cbam.verify}
            nowMs={nowMs}
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function TargetSection() {
  const { t } = useT('settings');
  return (
    <SectionCard
      title={t('targets.title')}
      description={t('targets.desc')}
      actions={
        <SectionReset
          keys={[
            'annualEnergyReductionPct',
            'annualCo2ReductionPct',
            'annualCo2TargetT',
            'enpiTargetKwhPerT',
          ]}
        />
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <RateField
          k="annualEnergyReductionPct"
          label={t('targets.energy')}
          unit="%"
          hint={t('targets.energyHint')}
        />
        <RateField
          k="annualCo2ReductionPct"
          label={t('targets.co2')}
          unit="%"
          hint={t('targets.co2Hint')}
        />
        <RateField
          k="annualCo2TargetT"
          label={t('targets.co2Abs')}
          unit={t('units.tYear')}
          hint={t('targets.co2AbsHint')}
        />
        <RateField
          k="enpiTargetKwhPerT"
          label={t('targets.enpi')}
          unit={t('units.kwhT')}
          hint={t('targets.enpiHint')}
        />
      </div>
    </SectionCard>
  );
}
