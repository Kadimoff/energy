import { useMemo } from 'react';
import { baseConfig, resolveRates, type EffectiveRates } from '@/data/config';
import { useSettingsStore } from '@/stores/settings';

/** Defaults with the selected consumer group applied (electricity rate follows the group). */
export function useDefaultRates(): EffectiveRates {
  const group = useSettingsStore((s) => s.overrides.consumerGroup);
  return useMemo(() => resolveRates(baseConfig, { consumerGroup: group }), [group]);
}
