import { baseConfig } from '@/data/config';
import type { RecommendationState } from '@/data/types';
import { fixture, rates } from '@/test/fixture';
import { annualReductionT } from '../carbon';
import { combinedMonthlySaving } from '../recommendations';
import { carbonByMonth } from '../viewmodels';
import {
  carbonBySource,
  carbonYear,
  cbamCheck,
  cbamCost,
  cbamDefaultBasis,
  embeddedPerUnit,
  exampleExportTonnes,
  factorRows,
  lastCompleteMonths,
  periodEmissions,
  reductionRoadmap,
} from './carbonView';

const a = fixture();
const states: Record<string, RecommendationState> = {
  'rec-air-leaks': { status: 'approved', updatedAt: 0 },
  'rec-comp-vsd': { status: 'rejected', rejectReason: 'other', updatedAt: 0 },
};
const cfg = baseConfig.emissions.cbam;

describe('carbon year and target (spec 5.6 / 7.9)', () => {
  const y = carbonYear(a, rates, a.engine, states);

  it('year to date matches the monthly emissions of the year', () => {
    const months = carbonByMonth(a, rates).filter((m) => m.key.startsWith('2026'));
    const sum = months.reduce((s, m) => s + m.totalT, 0);
    expect(y.year).toBe(2026);
    expect(y.ytd.totalT).toBeCloseTo(sum, 0);
    expect(y.ytd.scope1T + y.ytd.scope2T).toBeCloseTo(y.ytd.totalT, 6);
    expect(y.scope2Share).toBeCloseTo(y.ytd.scope2T / y.ytd.totalT, 9);
    expect(y.ytd.intensityKgPerT).toBeGreaterThan(150);
  });

  it('projects the year end and compares it with the annual target', () => {
    expect(y.seasonalMonths).toEqual([]);
    expect(y.yearEnd.totalT).toBeGreaterThan(y.ytd.totalT);
    expect(y.forecastShare).toBeGreaterThan(0.05);
    expect(y.forecastShare).toBeLessThan(0.2);
    expect(y.targetT).toBe(rates.annualCo2TargetT);
    expect(y.ytdTargetT).toBeCloseTo(y.targetT * y.ytdTargetShare, 6);
    expect(y.onTrack).toBe(y.yearEnd.totalT <= y.targetT);
    expect(y.yearEndVsTargetPct).toBeCloseTo((y.yearEnd.totalT / y.targetT - 1) * 100, 6);
    const easy = carbonYear(a, { ...rates, annualCo2TargetT: 10_000 }, a.engine, states);
    expect(easy.onTrack).toBe(true);
  });

  it('fills months beyond the data horizon with the same month of the previous year', () => {
    const feb = fixture(new Date(2026, 1, 10, 12, 0).getTime());
    const fy = carbonYear(feb, rates);
    expect(fy.seasonalMonths).toHaveLength(9);
    expect(fy.seasonalMonths[0]).toBe('2026-04');
    expect(fy.yearEnd.totalT).toBeGreaterThan(fy.ytd.totalT * 5);
    expect(fy.yearEnd.totalT).toBeGreaterThan(2500);
    expect(fy.yearEnd.totalT).toBeLessThan(4500);
  }, 30000);
});

describe('sources, roadmap and factors', () => {
  const l12 = lastCompleteMonths(a, 12);
  const pe = periodEmissions(a, rates, l12.fromDay, l12.toDay);

  it('splits emissions by group; shares sum to 1; boiler is Scope 1', () => {
    expect(l12.months).toBe(12);
    const src = carbonBySource(a, rates, baseConfig.groups, l12.fromDay, l12.toDay);
    expect(src.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 9);
    expect(src.reduce((s, r) => s + r.tCo2, 0)).toBeCloseTo(pe.totalT, 6);
    expect(src.find((r) => r.group === 'boiler')!.scope).toBe(1);
    expect(src.filter((r) => r.scope === 2).every((r) => r.energy === 'electricity')).toBe(true);
    for (let i = 1; i < src.length; i++)
      expect(src[i - 1].tCo2).toBeGreaterThanOrEqual(src[i].tCo2);
  });

  it('waterfall steps chain without double counting and skip rejected ones', () => {
    const rm = reductionRoadmap(a, a.engine, states, rates, pe.totalT);
    const steps = rm.steps.filter((s) => s.kind === 'step');
    expect(steps.some((s) => s.id === 'rec-comp-vsd')).toBe(false);
    expect(steps).toHaveLength(a.engine.recommendations.length - 1);
    for (let i = 1; i <= steps.length; i++)
      expect(rm.steps[i].from).toBeCloseTo(rm.steps[i - 1].to, 9);
    const ids = steps.map((s) => s.id);
    const all = combinedMonthlySaving(a.ds, a.engine, ids);
    expect(rm.reductionT).toBeCloseTo(annualReductionT(all.kwh, all.m3, rates), 6);
    expect(rm.afterT).toBeCloseTo(pe.totalT - rm.reductionT, 6);
    expect(rm.gapT).toBeCloseTo(rm.afterT - rates.annualCo2TargetT, 6);
    expect(rm.axisMin).toBeLessThan(Math.min(rm.afterT, rm.targetT));
    expect(rm.axisMax).toBeGreaterThanOrEqual(pe.totalT);
  });

  it('factor rows carry source, date and override state', () => {
    const rows = factorRows(
      baseConfig,
      { ...rates, scope2KgCo2PerKwh: 0.5 },
      { scope2KgCo2PerKwh: 0.5 },
    );
    const s2 = rows.find((r) => r.id === 'scope2')!;
    expect(s2.value).toBe(0.5);
    expect(s2.defaultValue).toBe(0.41);
    expect(s2.overridden).toBe(true);
    expect(s2.source).toContain('Azərenerji');
    const s1 = rows.find((r) => r.id === 'scope1')!;
    expect(s1.overridden).toBe(false);
    expect(s1.sourceUrl).toMatch(/^https:/);
    expect(rows.map((r) => r.id)).toEqual([
      'scope1',
      'scope2',
      'gasKwhPerM3',
      'euEtsPrice',
      'eurToAzn',
    ]);
  });
});

describe('CBAM (spec 5.7)', () => {
  const base = {
    exportsToEu: true,
    exportTonnesPerYear: 1000,
    coveredGroups: cfg.coveredGroups,
    thresholdT: cfg.freeThresholdTonnesPerYear,
  };

  it('checklist verdicts', () => {
    expect(cbamCheck({ ...base, group: 'plastics' }).verdict).toBe('not_covered');
    expect(cbamCheck({ ...base, group: 'cement', exportsToEu: false }).verdict).toBe(
      'no_eu_export',
    );
    expect(cbamCheck({ ...base, group: 'cement', exportTonnesPerYear: 40 }).verdict).toBe(
      'below_threshold',
    );
    expect(cbamCheck({ ...base, group: 'aluminium' }).liable).toBe(true);
    // the 50 t threshold does not apply to electricity and hydrogen
    const h2 = cbamCheck({ ...base, group: 'hydrogen', exportTonnesPerYear: 10 });
    expect(h2.thresholdApplies).toBe(false);
    expect(h2.verdict).toBe('liable');
  });

  it('embedded emissions per ton and per product unit', () => {
    const e = embeddedPerUnit(400_000, 40_000, 1000, rates, 2.5);
    expect(e.totalTPerT).toBeCloseTo(e.directTPerT + e.indirectTPerT, 12);
    expect(e.directKgPerT).toBeCloseTo((40_000 * 10 * 0.202) / 1000, 6);
    expect(e.indirectKgPerT).toBeCloseTo((400_000 * 0.41) / 1000, 6);
    expect(e.totalKgPerUnit).toBeCloseTo(e.totalTPerT * 2.5, 12);
    expect(embeddedPerUnit(1, 1, 1, rates, -3).totalKgPerUnit).toBe(0);
  });

  it('cost scenario uses the ETS price parameter, basis and domestic price', () => {
    const emb = embeddedPerUnit(400_000, 40_000, 1000, rates, 1);
    const input = {
      ...base,
      group: 'cement' as const,
      basis: 'total' as const,
      embedded: emb,
      euEtsPriceEurPerT: 100,
      domesticCarbonPriceEur: 0,
      rates,
    };
    const total = cbamCost(input);
    expect(total.embeddedTotalT).toBeCloseTo(emb.totalTPerT * 1000, 9);
    expect(total.costEur).toBeCloseTo(total.embeddedTotalT * 100, 6);
    expect(total.costAzn).toBeCloseTo(total.costEur * rates.eurToAzn, 6);
    expect(total.embeddedKgPerT).toBeCloseTo(emb.totalKgPerT, 9);
    const direct = cbamCost({ ...input, basis: 'direct' });
    expect(direct.costEur).toBeLessThan(total.costEur);
    const paid = cbamCost({ ...input, domesticCarbonPriceEur: 30 });
    expect(paid.costEur).toBeCloseTo(total.embeddedTotalT * 70, 6);
    expect(cbamDefaultBasis('iron_steel')).toBe('direct');
    expect(cbamDefaultBasis('cement')).toBe('total');
    expect(cbamDefaultBasis('plastics')).toBe('total');
    expect(exampleExportTonnes(14_134)).toBe(1410);
  });
});
