import { baseConfig } from '../config';
import { analysisFor, registerAnalysis, type Analysis } from '../../domain/analysis';
import type { EnergyDataSource } from './EnergyDataSource';
import { MockDataSource } from './MockDataSource';

export type { EnergyDataSource } from './EnergyDataSource';
export { MockDataSource } from './MockDataSource';

/**
 * The active data source. To connect a real backend, implement
 * EnergyDataSource in ApiDataSource.ts and swap the line below; see README.
 */
export const dataSource: EnergyDataSource = new MockDataSource();

function runInWorker(now: number): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; analysis?: Analysis; error?: string }>) => {
      w.terminate();
      if (e.data.ok && e.data.analysis) resolve(e.data.analysis);
      else reject(new Error(e.data.error ?? 'worker failed'));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(e instanceof ErrorEvent ? e.error : new Error('worker failed'));
    };
    w.postMessage({ now });
  });
}

/**
 * Dataset + analysis (models, anomalies, recommendations, M&V) for the UI.
 * With the mock source the heavy work runs in a web worker when available
 * (falls back to the main thread, e.g. in tests).
 */
export async function loadAnalysis(source: EnergyDataSource = dataSource): Promise<Analysis> {
  if (source instanceof MockDataSource && !source.hasDataset() && typeof Worker !== 'undefined') {
    try {
      const a = await runInWorker(source.nowMs());
      source.adopt(a.ds);
      registerAnalysis(a);
      return a;
    } catch {
      /* fall back to main thread */
    }
  }
  const ds = await source.getDataset();
  return analysisFor(ds, baseConfig);
}
