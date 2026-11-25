import type { EffectiveRates } from '../data/config';
import type { RecommendationState } from '../data/types';
import { expectedAt, type HourlyInputs } from './baseline';
import { emissions } from './carbon';
import { electricityCost } from './cost';
import { slotOf, type AnalysisCore } from './core';
import { monthDayRange, reductionAt } from './forecast';
import { SLOTS, type RecommendationEngineResult } from './recommendations';

/**
 * "What if" simulator (spec 7.8). Re-evaluates the optimal models for the
 * remaining hours of the chosen month with modified inputs and returns the
 * month result next to the unchanged base case.
 */

export interface ScenarioInput {
  /** production volume change, % (e.g. -10 … +20) */
  productionPct: number;
  /** outdoor temperature shift, °C */
  tempDeltaC: number;
  /** shifts on workdays (1: 08-16, 2: 08-24, 3: 24 h) */
  shifts: 1 | 2 | 3;
  /** recommendations assumed implemented from the start of the remaining period */
  recommendationIds: string[];
  /** overrides; undefined = current settings */
  tariffAznPerKwh?: number;
  gridKgCo2PerKwh?: number;
  /** 0 = current month, 1 = next month */
  monthOffset: 0 | 1;
}

export const defaultScenario: ScenarioInput = {
  productionPct: 0,
  tempDeltaC: 0,
  shifts: 2,
  recommendationIds: [],
  monthOffset: 0,
};

export interface ScenarioOutcome {
  kwh: number;
  m3: number;
  tons: number;
  costAzn: number;
  budgetAzn: number;
  deltaVsBudgetAzn: number;
  co2T: number;
  enpiKwhPerT: number;
}

export interface ScenarioResult {
  base: ScenarioOutcome;
  scenario: ScenarioOutcome;
  daily: { key: string; start: number; base: number; scenario: number; isFuture: boolean }[];
}

function shiftHours(shifts: 1 | 2 | 3): { start: number; end: number } {
  return shifts === 1
    ? { start: 8, end: 16 }
    : shifts === 3
      ? { start: 0, end: 24 }
      : { start: 8, end: 24 };
}

export function runScenario(
  core: AnalysisCore,
  engine: RecommendationEngineResult,
  recStates: Record<string, RecommendationState>,
  rates: EffectiveRates,
  input: ScenarioInput,
): ScenarioResult {
  const { ds } = core;
  const { fromDay, toDay } = monthDayRange(core, input.monthOffset);
  const now = ds.timeline.nowIndex;
  const n = ds.timeline.hours;
  const production = new Uint8Array(ds.context.production);
  const intensity = new Float32Array(ds.context.intensity);
  const temperature = new Float32Array(ds.context.temperature);
  const sh = shiftHours(input.shifts);
  const pf = 1 + input.productionPct / 100;
  let tonsScenario = 0;
  let tonsBase = 0;
  for (let d = fromDay; d < toDay; d++) {
    const day = ds.days[d];
    tonsBase += day.tons;
    const future = day.endIndex > now;
    if (!future) {
      tonsScenario += day.tons;
      continue;
    }
    const rate = day.productionHours > 0 ? day.plannedTons / day.productionHours : 0;
    let newHours = 0;
    for (let i = Math.max(day.startIndex, now); i < day.endIndex; i++) {
      temperature[i] += input.tempDeltaC;
      if (day.dayType === 'workday') {
        const h = ds.timeline.hourOfDay[i];
        production[i] = h >= sh.start && h < sh.end ? 1 : 0;
      }
      if (production[i]) {
        // keep the planned hourly profile where production was planned, plan rate elsewhere
        intensity[i] = (ds.context.production[i] ? ds.context.intensity[i] : rate) * pf;
        newHours++;
      } else intensity[i] = 0;
    }
    // production already done today: planned rate × production hours before now
    let doneProdHours = 0;
    for (let i = day.startIndex; i < Math.min(day.endIndex, now); i++)
      doneProdHours += ds.context.production[i];
    tonsScenario += rate * doneProdHours + rate * pf * newHours;
  }
  const inputs: HourlyInputs = { ...core.inputs, production, intensity, temperature };
  const baseRed = reductionAt(engine, recStates, ds.timeline.nowMs);
  const scenStates: Record<string, RecommendationState> = { ...recStates };
  for (const id of input.recommendationIds)
    scenStates[id] = { status: 'in_progress', updatedAt: ds.timeline.nowMs };
  const scenRed = reductionAt(engine, scenStates, ds.timeline.nowMs);
  const zero = new Float32Array(SLOTS);
  const daily: ScenarioResult['daily'] = [];
  const buf = new Float64Array(5);
  let kB = 0;
  let kS = 0;
  let gB = 0;
  let gS = 0;
  for (let d = fromDay; d < toDay; d++) {
    const day = ds.days[d];
    let b = 0;
    let s = 0;
    for (let i = day.startIndex; i < Math.min(day.endIndex, n); i++) {
      for (const eq of ds.equipment) {
        const gas = eq.energy === 'gas';
        let vb: number;
        let vs: number;
        if (i < now) {
          vb = vs = ds.readings[eq.id][i];
        } else {
          const slot = slotOf(core, i);
          const w = (engine.wasteRate[eq.id] ?? zero)[slot];
          const t = ds.timeline.hourStarts[i];
          const rb = baseRed(t)?.[eq.id]?.[slot] ?? 0;
          const rs = scenRed(t)?.[eq.id]?.[slot] ?? 0;
          vb = core.bands[eq.id].expected[i] + Math.max(0, w - rb);
          const sameState = production[i] === ds.context.production[i];
          vs =
            expectedAt(core.models[eq.id], inputs, i, buf) + (sameState ? Math.max(0, w - rs) : 0);
        }
        if (gas) {
          gB += vb;
          gS += vs;
        } else {
          b += vb;
          s += vs;
        }
      }
    }
    kB += b;
    kS += s;
    daily.push({
      key: day.key,
      start: day.start,
      base: b,
      scenario: s,
      isFuture: day.endIndex > now,
    });
  }
  const sRates: EffectiveRates = {
    ...rates,
    electricityRateAznPerKwh: input.tariffAznPerKwh ?? rates.electricityRateAznPerKwh,
    scope2KgCo2PerKwh: input.gridKgCo2PerKwh ?? rates.scope2KgCo2PerKwh,
  };
  const outcome = (kwh: number, m3: number, tons: number, r: EffectiveRates): ScenarioOutcome => {
    const cost = electricityCost(kwh, r);
    return {
      kwh,
      m3,
      tons,
      costAzn: cost,
      budgetAzn: r.electricityBudgetAzn,
      deltaVsBudgetAzn: cost - r.electricityBudgetAzn,
      co2T: emissions(kwh, m3, tons, r).totalT,
      enpiKwhPerT: tons > 0 ? kwh / tons : 0,
    };
  };
  return {
    base: outcome(kB, gB, tonsBase, rates),
    scenario: outcome(kS, gS, tonsScenario, sRates),
    daily,
  };
}
