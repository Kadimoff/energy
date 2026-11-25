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

/** Timings of the last analysis load (README/DECISIONS: performance budget). */
export interface AnalysisTimings {
  where: 'worker' | 'main';
  /** mock generation inside the worker (or on the main thread) */
  generateMs: number;
  /** models, bands, anomalies, recommendations, M&V */
  analyzeMs: number;
  /** request to result on the main thread (worker start, compute, transfer) */
  totalMs: number;
  /** main-thread work: deserialising the worker message, or everything in the fallback */
  mainThreadMs: number;
}

export let lastAnalysisTimings: AnalysisTimings | null = null;

function mark(name: string, start: number, end: number) {
  try {
    performance.measure(name, { start, duration: Math.max(0, end - start) });
  } catch {
    /* measure with options is not available everywhere (old jsdom) */
  }
}

function runInWorker(now: number): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const w = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (
      e: MessageEvent<{
        ok: boolean;
        analysis?: Analysis;
        error?: string;
        timings?: { generateMs: number; analyzeMs: number };
      }>,
    ) => {
      // e.data is deserialised lazily on first access: that is the main-thread cost
      const tm = performance.now();
      const data = e.data;
      const t1 = performance.now();
      w.terminate();
      if (data.ok && data.analysis) {
        const tm2 = data.timings ?? { generateMs: 0, analyzeMs: 0 };
        lastAnalysisTimings = {
          where: 'worker',
          generateMs: tm2.generateMs,
          analyzeMs: tm2.analyzeMs,
          totalMs: t1 - t0,
          mainThreadMs: t1 - tm,
        };
        mark('sie:generate (worker)', t0, t0 + tm2.generateMs);
        mark('sie:analyze (worker)', t0 + tm2.generateMs, t0 + tm2.generateMs + tm2.analyzeMs);
        mark('sie:analysis (worker, total)', t0, t1);
        mark('sie:analysis (main thread, receive)', tm, t1);
        resolve(data.analysis);
      } else reject(new Error(data.error ?? 'worker failed'));
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
  const t0 = performance.now();
  const ds = await source.getDataset();
  const t1 = performance.now();
  const a = analysisFor(ds, baseConfig);
  const t2 = performance.now();
  lastAnalysisTimings = {
    where: 'main',
    generateMs: t1 - t0,
    analyzeMs: t2 - t1,
    totalMs: t2 - t0,
    mainThreadMs: t2 - t0,
  };
  mark('sie:analysis (main thread fallback)', t0, t2);
  return a;
}
