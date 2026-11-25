import type { EffectiveRates } from '../data/config';

/**
 * Cost calculation (spec 5.5). Rates always come from config / settings
 * overrides (EffectiveRates), never from constants.
 */

/** Electricity cost = kWh × tariff + monthly fixed fee × months. */
export function electricityCost(kwh: number, rates: EffectiveRates, months = 1): number {
  return kwh * rates.electricityRateAznPerKwh + rates.electricityFixedFeeAzn * months;
}

/** Gas cost = m³ × tariff + monthly fixed fee × months. */
export function gasCost(m3: number, rates: EffectiveRates, months = 1): number {
  return m3 * rates.gasRateAznPerM3 + rates.gasFixedFeeAzn * months;
}

/** Variable cost only (waste, savings): no fixed fee. */
export function energyValue(kwh: number, m3: number, rates: EffectiveRates): number {
  return kwh * rates.electricityRateAznPerKwh + m3 * rates.gasRateAznPerM3;
}

export interface BudgetStatus {
  budget: number;
  forecast: number;
  /** forecast - budget; positive = overrun */
  delta: number;
  /** forecast / budget * 100 */
  usedPct: number;
  overrun: boolean;
}

export function budgetStatus(forecastCost: number, budget: number): BudgetStatus {
  const delta = forecastCost - budget;
  return {
    budget,
    forecast: forecastCost,
    delta,
    usedPct: budget > 0 ? (forecastCost / budget) * 100 : 0,
    overrun: delta > 0,
  };
}

/** Budget expressed as kWh after removing the fixed fee (used by forecasts). */
export function budgetKwh(rates: EffectiveRates, months = 1): number {
  const variable = rates.electricityBudgetAzn - rates.electricityFixedFeeAzn * months;
  return rates.electricityRateAznPerKwh > 0
    ? Math.max(0, variable) / rates.electricityRateAznPerKwh
    : 0;
}
