/// <reference lib="webworker" />
import { baseConfig } from '../config';
import { generateDataset } from '../mock/generator';
import { analyze } from '../../domain/analysis';

/**
 * Runs the mock generator + full analysis off the main thread so the first
 * render never blocks (spec 10). Posts back the Analysis (typed arrays are
 * structured-cloned; internal references such as analysis.ds are preserved).
 */
self.onmessage = (e: MessageEvent<{ now: number }>) => {
  try {
    const ds = generateDataset({ now: e.data.now, config: baseConfig });
    const analysis = analyze(ds, baseConfig);
    self.postMessage({ ok: true, analysis });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
