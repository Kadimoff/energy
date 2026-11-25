import {
  dailyBand,
  dailyFeatures,
  degreeDays,
  emptyBands,
  expectedAt,
  fitDailyBaseline,
  fitEquipmentHourly,
  fitOls,
  fitRobustFlat,
  hourlyExpected,
  predict,
  selectKth,
  solveLinear,
} from './baseline';

const robust = { iterations: 3, cutoffSigma: 3 };

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
}

describe('linear algebra helpers', () => {
  it('solves linear systems with pivoting', () => {
    const x = solveLinear(
      [
        [0, 2, 1],
        [1, 1, 1],
        [2, 1, 3],
      ],
      [5, 4, 7],
    );
    expect(x.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 2, 1]);
  });
  it('quickselect returns order statistics', () => {
    const a = Float64Array.from([5, 1, 4, 2, 3]);
    expect(selectKth(a.slice(), 0)).toBe(1);
    expect(selectKth(a.slice(), 2)).toBe(3);
    expect(selectKth(a.slice(), 4)).toBe(5);
  });
});

describe('multivariate OLS (spec 5.2 model)', () => {
  it('recovers E = a + b·ton + c·CDD + d·HDD + e·hours', () => {
    const rnd = lcg(7);
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 300; i++) {
      const v = {
        tons: 20 + 40 * Math.abs(rnd()),
        cdd: Math.max(0, 8 * rnd()),
        hdd: Math.max(0, -8 * rnd()),
        hours: i % 7 === 6 ? 0 : 16,
      };
      X.push(dailyFeatures(v));
      y.push(2000 + 55 * v.tons + 120 * v.cdd + 40 * v.hdd + 300 * v.hours + 20 * rnd());
    }
    const fit = fitOls(X, y);
    expect(fit.coef[0]).toBeCloseTo(2000, -1);
    expect(fit.coef[1]).toBeCloseTo(55, 0);
    expect(fit.coef[2]).toBeCloseTo(120, 0);
    expect(fit.coef[3]).toBeCloseTo(40, 0);
    expect(fit.r2).toBeGreaterThan(0.99);
    expect(fit.cvRmsePct).toBeLessThan(2);
    expect(predict(fit, [1, 30, 2, 0, 16])).toBeCloseTo(2000 + 55 * 30 + 240 + 4800, -1);
  });

  it('robust fit ignores anomaly rows (good days only)', () => {
    const rnd = lcg(3);
    const n = 400;
    const X = new Float64Array(n * 2);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / 10;
      X[i * 2] = 1;
      X[i * 2 + 1] = x;
      y[i] = 10 + 2 * x + rnd() * 0.5 + (i % 10 === 0 ? 40 : 0); // 10 % anomalies
    }
    const fit = fitRobustFlat(X, y, n, 2, robust);
    expect(fit.coef[0]).toBeCloseTo(10, 0);
    expect(fit.coef[1]).toBeCloseTo(2, 1);
    expect(fit.removed).toBeGreaterThanOrEqual(40);
    expect(fit.kept[0]).toBe(0);
    expect(fit.kept[1]).toBe(1);
  });

  it('daily baseline: band, R², CV(RMSE) and low-reliability flag', () => {
    const rnd = lcg(11);
    const good = Array.from({ length: 120 }, (_, i) => {
      const vars = { tons: 50, cdd: (i % 10) / 2, hdd: 0, hours: 16 };
      return { vars, energy: 15000 + 300 * vars.cdd + 200 * rnd() };
    });
    const m = fitDailyBaseline(good, { ...robust, bandSigma: 1.5, cvrmseWarnPct: 20 });
    expect(m.lowReliability).toBe(false);
    expect(m.r2).toBeGreaterThan(0.8);
    const b = dailyBand(m, { tons: 50, cdd: 2, hdd: 0, hours: 16 });
    expect(b.expected).toBeGreaterThan(b.lower);
    expect(b.upper - b.expected).toBeCloseTo(1.5 * m.sigma, 6);

    const noisy = good.map((s, i) => ({ ...s, energy: 15000 * (1 + (i % 2 ? 0.6 : -0.6)) }));
    const bad = fitDailyBaseline(noisy, {
      iterations: 0,
      cutoffSigma: 3,
      bandSigma: 1.5,
      cvrmseWarnPct: 20,
    });
    expect(bad.cvRmsePct).toBeGreaterThan(20);
    expect(bad.lowReliability).toBe(true);
  });

  it('degree days', () => {
    expect(degreeDays(25, 18, 15.5)).toEqual({ cdd: 7, hdd: 0 });
    expect(degreeDays(5, 18, 15.5)).toEqual({ cdd: 0, hdd: 10.5 });
  });
});

describe('hourly equipment model and idle baseload', () => {
  it('learns production load, idle baseload and flags waste above the band', () => {
    const n = 24 * 60;
    const production = new Uint8Array(n);
    const intensity = new Float32Array(n);
    const temperature = new Float32Array(n).fill(20);
    const dark = new Uint8Array(n);
    const actual = new Float32Array(n);
    const rnd = lcg(5);
    for (let i = 0; i < n; i++) {
      const h = i % 24;
      production[i] = h >= 8 && h < 24 ? 1 : 0;
      intensity[i] = production[i] ? 3 : 0;
      actual[i] = (production[i] ? 80 + 5 * intensity[i] : 4) * (1 + 0.02 * rnd());
    }
    // injected idle waste on the last 3 nights
    for (let d = 57; d < 60; d++) for (let h = 1; h < 6; h++) actual[d * 24 + h] = 40;
    const inp = { production, intensity, temperature, dark, cddBase: 18, hddBase: 15.5 };
    const m = fitEquipmentHourly(actual, inp, 0, n, robust);
    expect(m.idleBaseload).toBeCloseTo(4, 0);
    expect(expectedAt(m, inp, 10)).toBeCloseTo(95, 0);
    const bands = hourlyExpected(m, actual, inp, 1.5, emptyBands(n));
    expect(bands.waste[57 * 24 + 2]).toBeGreaterThan(30);
    expect(bands.waste[10]).toBeLessThan(2);
    expect(bands.upper[10]).toBeGreaterThan(bands.expected[10]);
  });
});
