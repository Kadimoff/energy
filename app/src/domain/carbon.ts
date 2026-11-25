import type { EffectiveRates } from '../data/config';

/**
 * Carbon accounting (spec 5.6, GHG Protocol) and CBAM pre-assessment (5.7).
 * All factors come from EffectiveRates (config + settings overrides).
 */

/** Scope 1: natural gas combustion, kg CO₂ = m³ × kWh/m³ × kg/kWh. */
export function scope1Kg(m3: number, rates: EffectiveRates): number {
  return m3 * rates.gasKwhPerM3 * rates.scope1KgCo2PerKwh;
}

/** Scope 2 (location based): purchased electricity, kg CO₂ = kWh × grid factor. */
export function scope2Kg(kwh: number, rates: EffectiveRates): number {
  return kwh * rates.scope2KgCo2PerKwh;
}

export interface Emissions {
  scope1T: number;
  scope2T: number;
  totalT: number;
  /** kg CO₂ per ton of product; NaN without production */
  intensityKgPerT: number;
  scope1Share: number;
}

export function emissions(kwh: number, m3: number, tons: number, rates: EffectiveRates): Emissions {
  const s1 = scope1Kg(m3, rates) / 1000;
  const s2 = scope2Kg(kwh, rates) / 1000;
  const total = s1 + s2;
  return {
    scope1T: s1,
    scope2T: s2,
    totalT: total,
    intensityKgPerT: tons > 0 ? (total * 1000) / tons : Number.NaN,
    scope1Share: total > 0 ? s1 / total : 0,
  };
}

export interface TargetProgress {
  baselineT: number;
  targetT: number;
  currentT: number;
  /** achieved reduction vs baseline, % */
  reductionPct: number;
  targetReductionPct: number;
  /** 0..1 progress towards the target reduction (can exceed 1, can be negative) */
  progress: number;
  onTrack: boolean;
}

/**
 * Progress towards the annual CO₂ target. `baselineT` = emissions of the
 * reference year, `currentT` = projected emissions of the current 12 months.
 */
export function co2TargetProgress(
  baselineT: number,
  currentT: number,
  rates: EffectiveRates,
): TargetProgress {
  const targetT = baselineT * (1 - rates.annualCo2ReductionPct / 100);
  const reductionPct = baselineT > 0 ? (1 - currentT / baselineT) * 100 : 0;
  const progress = rates.annualCo2ReductionPct > 0 ? reductionPct / rates.annualCo2ReductionPct : 0;
  return {
    baselineT,
    targetT,
    currentT,
    reductionPct,
    targetReductionPct: rates.annualCo2ReductionPct,
    progress,
    onTrack: currentT <= targetT,
  };
}

/** Expected annual CO₂ reduction (t/yr) from monthly kWh and m³ savings. */
export function annualReductionT(
  kwhPerMonth: number,
  m3PerMonth: number,
  rates: EffectiveRates,
): number {
  return ((scope2Kg(kwhPerMonth, rates) + scope1Kg(m3PerMonth, rates)) * 12) / 1000;
}

// ---------------------------------------------------------------------------
// CBAM

export type CbamProductGroup =
  | 'cement'
  | 'iron_steel'
  | 'aluminium'
  | 'fertilisers'
  | 'electricity'
  | 'hydrogen'
  | 'plastics'
  | 'other';

export interface CbamInput {
  productGroup: CbamProductGroup;
  coveredGroups: string[];
  exportTonnesPerYear: number;
  exportsToEu: boolean;
  /** embedded emissions per ton of product (t CO₂ / t) */
  embeddedTPerT: number;
  /** carbon price already paid in the country of origin (EUR / t CO₂) */
  domesticCarbonPriceEur?: number;
  freeThresholdTonnesPerYear: number;
  rates: EffectiveRates;
}

export interface CbamResult {
  inScope: boolean;
  belowThreshold: boolean;
  liable: boolean;
  embeddedTotalT: number;
  costEur: number;
  costAzn: number;
  costPerTonAzn: number;
}

/** Embedded emissions per ton of product: direct (Scope 1) and direct + indirect. */
export function embeddedEmissions(kwh: number, m3: number, tons: number, rates: EffectiveRates) {
  const e = emissions(kwh, m3, tons, rates);
  return {
    directTPerT: tons > 0 ? e.scope1T / tons : 0,
    totalTPerT: tons > 0 ? e.totalT / tons : 0,
  };
}

export function cbamAssessment(i: CbamInput): CbamResult {
  const inScope = i.coveredGroups.includes(i.productGroup);
  const belowThreshold = i.exportTonnesPerYear < i.freeThresholdTonnesPerYear;
  const liable = inScope && i.exportsToEu && !belowThreshold;
  const embeddedTotalT = i.embeddedTPerT * i.exportTonnesPerYear;
  const price = Math.max(0, i.rates.euEtsPriceEurPerT - (i.domesticCarbonPriceEur ?? 0));
  const costEur = embeddedTotalT * price;
  const costAzn = costEur * i.rates.eurToAzn;
  return {
    inScope,
    belowThreshold,
    liable,
    embeddedTotalT,
    costEur,
    costAzn,
    costPerTonAzn: i.exportTonnesPerYear > 0 ? costAzn / i.exportTonnesPerYear : 0,
  };
}
