import { clamp, mean } from './stats';

/**
 * Baseline (EnB) and "optimal" consumption models (spec 5.2).
 *
 * - `fitOls` / `fitRobust`: generic multivariate least squares, the robust
 *   variant drops "bad" observations (anomaly hours/days) iteratively using a
 *   MAD based sigma, so the model is trained on good periods only.
 * - `fitDailyBaseline`: the spec model E = a + b·ton + c·CDD + d·HDD + e·hours
 *   with R², CV(RMSE) and a ±kσ band.
 * - `fitEquipmentHourly` / `hourlyExpected`: per-equipment hourly models used
 *   for the optimal band on hourly charts and for waste attribution:
 *   production hours: P = a + b·intensity + c·CDH + d·HDH + e·dark
 *   non-production hours (idle baseload): P = a + c·CDH + d·HDH + e·dark
 */

export interface OlsFit {
  coef: number[];
  n: number;
  p: number;
  r2: number;
  rmse: number;
  /** CV(RMSE) in percent, ASHRAE Guideline 14 definition (n - p dof) */
  cvRmsePct: number;
  /** residual standard deviation of the kept observations */
  sigma: number;
  meanY: number;
}

export function predict(fit: Pick<OlsFit, 'coef'>, x: ArrayLike<number>): number {
  let s = 0;
  for (let j = 0; j < fit.coef.length; j++) s += fit.coef[j] * x[j];
  return s;
}

/** Solve A x = b in place (Gaussian elimination with partial pivoting). */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

/**
 * Ordinary least squares on a flat row-major design matrix (n×p, first column
 * should be the intercept). `weights` 0/1 selects the rows used. A tiny ridge
 * keeps collinear inputs (tons vs hours) solvable.
 */
export function fitOlsFlat(
  X: Float64Array,
  y: ArrayLike<number>,
  n: number,
  p: number,
  use?: Uint8Array,
): OlsFit {
  const xtx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  let m = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    if (use && !use[i]) continue;
    const yi = y[i];
    if (Number.isNaN(yi)) continue;
    m++;
    sy += yi;
    const o = i * p;
    for (let a = 0; a < p; a++) {
      const xa = X[o + a];
      if (xa === 0) continue;
      xty[a] += xa * yi;
      for (let b = a; b < p; b++) xtx[a][b] += xa * X[o + b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) xtx[a][b] = xtx[b][a];
  const trace = xtx.reduce((s, r, i) => s + r[i], 0);
  const ridge = (trace / Math.max(1, p)) * 1e-9 + 1e-9;
  for (let a = 1; a < p; a++) xtx[a][a] += ridge;
  const coef = m > 0 ? solveLinear(xtx, xty) : new Array<number>(p).fill(0);
  const meanY = m ? sy / m : 0;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    if (use && !use[i]) continue;
    const yi = y[i];
    if (Number.isNaN(yi)) continue;
    let f = 0;
    const o = i * p;
    for (let a = 0; a < p; a++) f += coef[a] * X[o + a];
    ssRes += (yi - f) ** 2;
    ssTot += (yi - meanY) ** 2;
  }
  const dof = Math.max(1, m - p);
  const rmse = Math.sqrt(ssRes / dof);
  return {
    coef,
    n: m,
    p,
    r2: ssTot > 0 ? clamp(1 - ssRes / ssTot, 0, 1) : 0,
    rmse,
    cvRmsePct: meanY > 1e-9 ? (rmse / meanY) * 100 : 0,
    sigma: rmse,
    meanY,
  };
}

export function fitOls(X: number[][], y: number[]): OlsFit {
  const n = X.length;
  const p = n ? X[0].length : 0;
  const flat = new Float64Array(n * p);
  X.forEach((row, i) => row.forEach((v, j) => (flat[i * p + j] = v)));
  return fitOlsFlat(flat, y, n, p);
}

export interface RobustOptions {
  iterations: number;
  cutoffSigma: number;
}

export interface RobustFit extends OlsFit {
  kept: Uint8Array;
  /** number of rows removed as anomalous */
  removed: number;
}

/** k-th smallest value (0-based), Hoare quickselect; reorders `a` in place. */
export function selectKth(a: Float64Array, k: number): number {
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi) {
    const pivot = a[(lo + hi) >> 1];
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else return a[k];
  }
  return a[k];
}

/** Iteratively trimmed OLS: drop rows with |residual - median| > cutoff × 1.4826·MAD. */
export function fitRobustFlat(
  X: Float64Array,
  y: ArrayLike<number>,
  n: number,
  p: number,
  opts: RobustOptions,
  initial?: Uint8Array,
): RobustFit {
  const kept = new Uint8Array(n);
  for (let i = 0; i < n; i++) kept[i] = (initial ? initial[i] : 1) && !Number.isNaN(y[i]) ? 1 : 0;
  let fit = fitOlsFlat(X, y, n, p, kept);
  const res = new Float64Array(n);
  for (let it = 0; it < opts.iterations; it++) {
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(y[i]) || (initial && !initial[i])) continue;
      let f = 0;
      const o = i * p;
      for (let a = 0; a < p; a++) f += fit.coef[a] * X[o + a];
      res[k++] = y[i] - f;
    }
    if (k < p + 2) break;
    const work = res.slice(0, k);
    const med = selectKth(work, k >> 1);
    for (let i = 0; i < k; i++) work[i] = Math.abs(res[i] - med);
    const floor = Math.max(1e-6, Math.abs(fit.meanY) * 0.005);
    const sig = Math.max(floor, 1.4826 * selectKth(work, k >> 1));
    const lim = opts.cutoffSigma * sig;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(y[i]) || (initial && !initial[i])) continue;
      let f = 0;
      const o = i * p;
      for (let a = 0; a < p; a++) f += fit.coef[a] * X[o + a];
      const keep = Math.abs(y[i] - f - med) <= lim ? 1 : 0;
      if (keep !== kept[i]) changed++;
      kept[i] = keep;
    }
    fit = fitOlsFlat(X, y, n, p, kept);
    if (!changed) break;
  }
  let total = 0;
  let kc = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(y[i]) && (!initial || initial[i])) total++;
    if (kept[i]) kc++;
  }
  return { ...fit, kept, removed: total - kc };
}

// ---------------------------------------------------------------------------
// Spec model (daily)

export interface DailyVars {
  tons: number;
  cdd: number;
  hdd: number;
  hours: number;
}

export function degreeDays(meanTempC: number, cddBase: number, hddBase: number) {
  return { cdd: Math.max(0, meanTempC - cddBase), hdd: Math.max(0, hddBase - meanTempC) };
}

export const dailyFeatureNames = ['a', 'b_ton', 'c_cdd', 'd_hdd', 'e_hours'] as const;

export function dailyFeatures(v: DailyVars): number[] {
  return [1, v.tons, v.cdd, v.hdd, v.hours];
}

export interface DailyBaselineModel {
  coef: { a: number; b: number; c: number; d: number; e: number };
  fit: RobustFit;
  r2: number;
  cvRmsePct: number;
  sigma: number;
  n: number;
  bandSigma: number;
  /** CV(RMSE) above threshold: UI shows the "low reliability" warning */
  lowReliability: boolean;
}

export function fitDailyBaseline(
  samples: { vars: DailyVars; energy: number }[],
  opts: RobustOptions & { bandSigma: number; cvrmseWarnPct: number },
): DailyBaselineModel {
  const n = samples.length;
  const p = 5;
  const X = new Float64Array(n * p);
  const y = new Float64Array(n);
  samples.forEach((s, i) => {
    dailyFeatures(s.vars).forEach((v, j) => (X[i * p + j] = v));
    y[i] = s.energy;
  });
  const fit = fitRobustFlat(X, y, n, p, opts);
  const [a, b, c, d, e] = fit.coef;
  return {
    coef: { a, b, c, d, e },
    fit,
    r2: fit.r2,
    cvRmsePct: fit.cvRmsePct,
    sigma: fit.sigma,
    n: fit.n,
    bandSigma: opts.bandSigma,
    lowReliability: fit.cvRmsePct > opts.cvrmseWarnPct || fit.n < 30,
  };
}

export function dailyBand(model: DailyBaselineModel, v: DailyVars) {
  const expected = Math.max(0, predict(model.fit, dailyFeatures(v)));
  const h = model.bandSigma * model.sigma;
  return { expected, lower: Math.max(0, expected - h), upper: expected + h };
}

// ---------------------------------------------------------------------------
// Hourly equipment model

export interface HourlyInputs {
  production: ArrayLike<number>;
  /** normalised intensity (≈1 at nominal production rate) */
  intensity: ArrayLike<number>;
  temperature: ArrayLike<number>;
  dark: ArrayLike<number>;
  cddBase: number;
  hddBase: number;
}

export interface EquipmentHourlyModel {
  prod: RobustFit | null;
  idle: RobustFit | null;
  sigmaProd: number;
  sigmaIdle: number;
  /** mean expected load during non-production hours of the training window */
  idleBaseload: number;
  trainFrom: number;
  trainTo: number;
}

const P_PROD = 5;
const P_IDLE = 4;

function rowProd(inp: HourlyInputs, i: number, out: Float64Array, o: number) {
  const t = inp.temperature[i];
  out[o] = 1;
  out[o + 1] = inp.intensity[i];
  out[o + 2] = Math.max(0, t - inp.cddBase);
  out[o + 3] = Math.max(0, inp.hddBase - t);
  out[o + 4] = inp.dark[i];
}

function rowIdle(inp: HourlyInputs, i: number, out: Float64Array, o: number) {
  const t = inp.temperature[i];
  out[o] = 1;
  out[o + 1] = Math.max(0, t - inp.cddBase);
  out[o + 2] = Math.max(0, inp.hddBase - t);
  out[o + 3] = inp.dark[i];
}

export function fitEquipmentHourly(
  actual: ArrayLike<number>,
  inp: HourlyInputs,
  trainFrom: number,
  trainTo: number,
  opts: RobustOptions,
): EquipmentHourlyModel {
  const idxP: number[] = [];
  const idxI: number[] = [];
  for (let i = trainFrom; i < trainTo; i++) {
    if (Number.isNaN(actual[i])) continue;
    (inp.production[i] ? idxP : idxI).push(i);
  }
  const build = (idx: number[], p: number, row: typeof rowProd) => {
    const X = new Float64Array(idx.length * p);
    const y = new Float64Array(idx.length);
    idx.forEach((i, k) => {
      row(inp, i, X, k * p);
      y[k] = actual[i];
    });
    return { X, y };
  };
  let prod: RobustFit | null = null;
  let idle: RobustFit | null = null;
  if (idxP.length > P_PROD + 5) {
    const { X, y } = build(idxP, P_PROD, rowProd);
    prod = fitRobustFlat(X, y, idxP.length, P_PROD, opts);
  }
  if (idxI.length > P_IDLE + 5) {
    const { X, y } = build(idxI, P_IDLE, rowIdle);
    idle = fitRobustFlat(X, y, idxI.length, P_IDLE, opts);
  }
  const sigmaFloor = (f: RobustFit | null) =>
    f ? Math.max(f.sigma, Math.abs(f.meanY) * 0.01, 0.05) : 0;
  let idleBase = 0;
  if (idle) {
    const xs: number[] = [];
    const row = new Float64Array(P_IDLE);
    for (const i of idxI) {
      rowIdle(inp, i, row, 0);
      xs.push(Math.max(0, predict(idle, row)));
    }
    idleBase = mean(xs);
  }
  return {
    prod,
    idle,
    sigmaProd: sigmaFloor(prod),
    sigmaIdle: sigmaFloor(idle),
    idleBaseload: idleBase || 0,
    trainFrom,
    trainTo,
  };
}

/** Expected load of hour i under the model (inputs may be modified for what-if). */
export function expectedAt(
  model: EquipmentHourlyModel,
  inp: HourlyInputs,
  i: number,
  buf = new Float64Array(P_PROD),
): number {
  if (inp.production[i]) {
    if (!model.prod) return 0;
    rowProd(inp, i, buf, 0);
    return Math.max(0, predict(model.prod, buf));
  }
  if (!model.idle) return 0;
  rowIdle(inp, i, buf, 0);
  return Math.max(0, predict(model.idle, buf));
}

export interface HourlyBands {
  expected: Float32Array;
  lower: Float32Array;
  upper: Float32Array;
  /** max(0, actual - upper); 0 where no actual */
  waste: Float32Array;
}

export function emptyBands(n: number): HourlyBands {
  return {
    expected: new Float32Array(n),
    lower: new Float32Array(n),
    upper: new Float32Array(n),
    waste: new Float32Array(n),
  };
}

/** Fill expected / band / waste for hours [from, to) (default: all) using `model`. */
export function hourlyExpected(
  model: EquipmentHourlyModel,
  actual: ArrayLike<number>,
  inp: HourlyInputs,
  bandSigma: number,
  out: HourlyBands = emptyBands(inp.production.length),
  from = 0,
  to = inp.production.length,
): HourlyBands {
  const { expected, lower, upper, waste } = out;
  const buf = new Float64Array(P_PROD);
  const hp = bandSigma * model.sigmaProd;
  const hi = bandSigma * model.sigmaIdle;
  for (let i = from; i < to; i++) {
    const e = expectedAt(model, inp, i, buf);
    const h = inp.production[i] ? hp : hi;
    expected[i] = e;
    lower[i] = Math.max(0, e - h);
    upper[i] = e + h;
    const a = actual[i];
    waste[i] = Number.isNaN(a) ? 0 : Math.max(0, a - upper[i]);
  }
  return out;
}
