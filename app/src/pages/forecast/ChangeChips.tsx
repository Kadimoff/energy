import { Badge } from '@/components/ui/badge';
import { scenarioChanges } from '@/domain/analytics/forecastView';
import type { ScenarioInput } from '@/domain/scenario';
import { useT } from '@/i18n';
import { formatNumber, formatPct, formatSigned, formatTemp, NBSP, UNITS } from '@/lib/format';
import { useRates } from '@/stores/derived';

/** Chips naming what a scenario changes ("İstehsal +10%", "3 növbə", ...). */
export function ChangeChips({ input, className }: { input: ScenarioInput; className?: string }) {
  const { t, tx } = useT('forecast');
  const rates = useRates();
  const changes = scenarioChanges(input, rates);
  const text = (key: string, v: number) => {
    switch (key) {
      case 'production':
        return t('change.production', { value: formatSigned(v, (x) => formatPct(x)) });
      case 'temperature':
        return t('change.temperature', { value: formatSigned(v, (x) => formatTemp(x)) });
      case 'tariff':
        return t('change.tariff', { value: `${formatNumber(v, 3)}${NBSP}AZN/${UNITS.kwh}` });
      case 'grid':
        return t('change.grid', {
          value: `${formatNumber(v, 2)}${NBSP}${UNITS.kgCo2}/${UNITS.kwh}`,
        });
      default:
        return tx(`change.${key}`, { value: v });
    }
  };
  return (
    <ul className={className ?? 'flex flex-wrap gap-1.5'}>
      {changes.length === 0 ? (
        <li>
          <Badge variant="neutral">{t('change.none')}</Badge>
        </li>
      ) : (
        changes.map((c) => (
          <li key={c.key}>
            <Badge variant="violet">{text(c.key, c.value)}</Badge>
          </li>
        ))
      )}
    </ul>
  );
}
