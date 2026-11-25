import { baseConfig, resolveRates } from '@/data/config';
import {
  annualReductionT,
  cbamAssessment,
  co2TargetProgress,
  embeddedEmissions,
  emissions,
  scope1Kg,
  scope2Kg,
} from './carbon';
import { budgetKwh, budgetStatus, electricityCost, energyValue, gasCost } from './cost';

const rates = resolveRates(baseConfig);

describe('cost (spec 5.5)', () => {
  it('uses config tariffs: 0,11 AZN/kWh + 3 AZN fixed', () => {
    expect(rates.electricityRateAznPerKwh).toBe(0.11);
    expect(rates.electricityFixedFeeAzn).toBe(3);
    expect(electricityCost(10_000, rates)).toBeCloseTo(1103, 6);
    expect(electricityCost(10_000, rates, 2)).toBeCloseTo(1106, 6);
    expect(gasCost(1000, rates)).toBeCloseTo(
      1000 * rates.gasRateAznPerM3 + rates.gasFixedFeeAzn,
      6,
    );
    expect(energyValue(100, 10, rates)).toBeCloseTo(11 + 10 * rates.gasRateAznPerM3, 6);
  });
  it('consumer group and overrides flow into rates', () => {
    expect(
      resolveRates(baseConfig, { consumerGroup: 'other_non_household' }).electricityRateAznPerKwh,
    ).toBe(0.1);
    expect(resolveRates(baseConfig, { consumerGroup: 'unknown' }).electricityRateAznPerKwh).toBe(
      0.11,
    );
    const r = resolveRates(baseConfig, {
      electricityRateAznPerKwh: 0.2,
      electricityBudgetAzn: 1000,
      scope2KgCo2PerKwh: 0.5,
    });
    expect(electricityCost(100, r)).toBeCloseTo(23, 6);
    expect(r.electricityBudgetAzn).toBe(1000);
    expect(scope2Kg(100, r)).toBeCloseTo(50, 6);
  });
  it('budget status and budget in kWh', () => {
    const s = budgetStatus(57_600, 50_000);
    expect(s.overrun).toBe(true);
    expect(s.delta).toBe(7_600);
    expect(s.usedPct).toBeCloseTo(115.2, 6);
    expect(budgetStatus(10, 0).usedPct).toBe(0);
    expect(budgetKwh(rates)).toBeCloseTo((50_000 - 3) / 0.11, 3);
    expect(budgetKwh({ ...rates, electricityRateAznPerKwh: 0 })).toBe(0);
  });
});

describe('carbon (spec 5.6)', () => {
  it('Scope 1 from gas, Scope 2 from grid electricity', () => {
    expect(scope1Kg(1000, rates)).toBeCloseTo(1000 * 10 * 0.202, 6);
    expect(scope2Kg(1000, rates)).toBeCloseTo(410, 6);
    const e = emissions(100_000, 10_000, 250, rates);
    expect(e.scope2T).toBeCloseTo(41, 6);
    expect(e.scope1T).toBeCloseTo(20.2, 6);
    expect(e.totalT).toBeCloseTo(61.2, 6);
    expect(e.intensityKgPerT).toBeCloseTo(244.8, 6);
    expect(e.scope1Share).toBeCloseTo(20.2 / 61.2, 6);
    expect(Number.isNaN(emissions(1, 1, 0, rates).intensityKgPerT)).toBe(true);
    expect(emissions(0, 0, 0, rates).scope1Share).toBe(0);
  });
  it('target progress and recommendation reductions', () => {
    const p = co2TargetProgress(3000, 2800, rates);
    expect(p.targetT).toBeCloseTo(2700, 6);
    expect(p.reductionPct).toBeCloseTo(6.667, 2);
    expect(p.onTrack).toBe(false);
    expect(co2TargetProgress(3000, 2600, rates).onTrack).toBe(true);
    expect(co2TargetProgress(0, 0, { ...rates, annualCo2ReductionPct: 0 }).progress).toBe(0);
    expect(annualReductionT(1000, 100, rates)).toBeCloseTo(((410 + 202) * 12) / 1000, 6);
  });
  it('CBAM: scope, threshold and cost scenario (spec 5.7)', () => {
    const cov = baseConfig.emissions.cbam.coveredGroups;
    const emb = embeddedEmissions(400_000, 40_000, 1000, rates);
    expect(emb.directTPerT).toBeCloseTo(0.0808, 4);
    expect(emb.totalTPerT).toBeGreaterThan(emb.directTPerT);
    expect(embeddedEmissions(1, 1, 0, rates).totalTPerT).toBe(0);
    const plastics = cbamAssessment({
      productGroup: 'plastics',
      coveredGroups: cov,
      exportTonnesPerYear: 500,
      exportsToEu: true,
      embeddedTPerT: 0.3,
      freeThresholdTonnesPerYear: 50,
      rates,
    });
    expect(plastics.inScope).toBe(false);
    expect(plastics.liable).toBe(false);
    const alu = cbamAssessment({
      productGroup: 'aluminium',
      coveredGroups: cov,
      exportTonnesPerYear: 1000,
      exportsToEu: true,
      embeddedTPerT: 2,
      freeThresholdTonnesPerYear: 50,
      rates,
      domesticCarbonPriceEur: 10,
    });
    expect(alu.liable).toBe(true);
    expect(alu.costEur).toBeCloseTo(2000 * 70, 6);
    expect(alu.costAzn).toBeCloseTo(2000 * 70 * rates.eurToAzn, 6);
    expect(alu.costPerTonAzn).toBeCloseTo(alu.costAzn / 1000, 6);
    const small = cbamAssessment({
      productGroup: 'cement',
      coveredGroups: cov,
      exportTonnesPerYear: 40,
      exportsToEu: true,
      embeddedTPerT: 0.8,
      freeThresholdTonnesPerYear: 50,
      rates,
    });
    expect(small.belowThreshold).toBe(true);
    expect(small.liable).toBe(false);
    expect(
      cbamAssessment({
        productGroup: 'cement',
        coveredGroups: cov,
        exportTonnesPerYear: 0,
        exportsToEu: false,
        embeddedTPerT: 1,
        freeThresholdTonnesPerYear: 50,
        rates,
      }).costPerTonAzn,
    ).toBe(0);
  });
});
