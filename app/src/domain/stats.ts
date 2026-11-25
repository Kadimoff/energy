/** Small numeric helpers shared by the domain functions. Pure, no I/O. */

export function sum(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i];
    if (!Number.isNaN(v)) s += v;
  }
  return s;
}

export function mean(xs: ArrayLike<number>): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i];
    if (!Number.isNaN(v)) {
      s += v;
      n++;
    }
  }
  return n ? s / n : Number.NaN;
}

export function std(xs: ArrayLike<number>, ddof = 1): number {
  const m = mean(xs);
  let s = 0;
  let n = 0;
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i];
    if (!Number.isNaN(v)) {
      s += (v - m) * (v - m);
      n++;
    }
  }
  return n > ddof ? Math.sqrt(s / (n - ddof)) : 0;
}

/** Linear-interpolated quantile, q in [0,1]. Ignores NaN. */
export function quantile(xs: ArrayLike<number>, q: number): number {
  const arr: number[] = [];
  for (let i = 0; i < xs.length; i++) if (!Number.isNaN(xs[i])) arr.push(xs[i]);
  if (!arr.length) return Number.NaN;
  arr.sort((a, b) => a - b);
  const pos = (arr.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
}

export const median = (xs: ArrayLike<number>) => quantile(xs, 0.5);

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26, |err| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Simple linear regression y = a + b x. */
export function linearTrend(ys: ArrayLike<number>): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: n ? ys[0] : 0, r2: 0 };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += ys[i];
    sxx += i * i;
    sxy += i * ys[i];
  }
  const den = n * sxx - sx * sx;
  const slope = den ? (n * sxy - sx * sy) / den : 0;
  const intercept = (sy - slope * sx) / n;
  const my = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const f = intercept + slope * i;
    ssTot += (ys[i] - my) ** 2;
    ssRes += (ys[i] - f) ** 2;
  }
  return { slope, intercept, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

/** Student t two-sided critical value approximation (for CI). */
export function tCritical(df: number, confidence = 0.9): number {
  const z = confidence >= 0.95 ? 1.96 : confidence >= 0.9 ? 1.645 : 1.2816;
  if (df <= 0) return z;
  // Cornish-Fisher style correction
  return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
}
