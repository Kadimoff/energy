import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ForecastHorizon } from '@/domain/analytics/forecastView';
import { defaultScenario, type ScenarioInput } from '@/domain/scenario';
import { useT } from '@/i18n';
import { ForecastHero } from './ForecastHero';
import { PeakPlanner } from './PeakPlanner';
import { ScenarioCompare } from './ScenarioCompare';
import { Simulator } from './Simulator';

/** Route "/forecast": spec 7.8 Proqnoz və ssenarilər. */
export default function ForecastPage() {
  const { t } = useT('forecast');
  const [horizon, setHorizon] = useState<ForecastHorizon>('month');
  const [scenario, setScenario] = useState<ScenarioInput>({ ...defaultScenario });
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Tabs value={horizon} onValueChange={(v) => setHorizon(v as ForecastHorizon)}>
            <TabsList aria-label={t('horizon.label')}>
              <TabsTrigger value="month">{t('horizon.month')}</TabsTrigger>
              <TabsTrigger value="quarter">{t('horizon.quarter')}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="space-y-6">
        <ForecastHero horizon={horizon} />
        <Simulator input={scenario} onChange={setScenario} />
        <ScenarioCompare current={scenario} onLoad={(s) => setScenario({ ...s })} />
        <PeakPlanner />
      </div>
    </>
  );
}
