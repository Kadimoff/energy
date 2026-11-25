import { baseConfig, resolveRates } from '@/data/config';
import { generateDataset } from '@/data/mock/generator';
import { analyze, type Analysis } from '@/domain/analysis';

/** Fixed "now" for deterministic tests (plant time, Asia/Baku). */
export const FIXED_NOW = new Date(2026, 10, 25, 14, 30).getTime();

const cache = new Map<number, Analysis>();

/** Generated dataset + analysis for a given now (memoised per test file). */
export function fixture(now: number = FIXED_NOW): Analysis {
  let a = cache.get(now);
  if (!a) {
    a = analyze(generateDataset({ now }), baseConfig);
    cache.set(now, a);
  }
  return a;
}

export const rates = resolveRates(baseConfig);
