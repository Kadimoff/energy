import type { SettingsOverrides } from '@/data/config';

/**
 * Settings form validation (pure). Messages are i18n keys in settings.json
 * ("validation.*") with params, so the UI shows friendly Azerbaijani text.
 */

export type NumericKey = Exclude<keyof SettingsOverrides, 'consumerGroup'>;

export interface NumberRule {
  min: number;
  max: number;
  /** min itself is not allowed (e.g. a tariff must be > 0) */
  minExclusive?: boolean;
  decimals: number;
  /** decimals always shown (tariffs: 0,10 instead of 0,1) */
  minDecimals?: number;
  /** example shown in the "not a number" message */
  example: string;
}

export type ValidationResult =
  | { ok: true; value: number }
  | { ok: false; key: string; params?: Record<string, string | number>; incomplete?: boolean };

/** "0,11", "0.11", "50 000", "50 000" → number; null when not a number. */
export function parseAzNumber(text: string): number | null {
  const s = text
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/\u2212/g, '-')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const fmt = (v: number) => String(v).replace('.', ',');

export function validateNumber(text: string, rule: NumberRule): ValidationResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, key: 'validation.empty' };
  if (/^\d+[.,]$/.test(trimmed.replace(/[\s\u00A0]/g, '')))
    return { ok: false, key: 'validation.incomplete', incomplete: true };
  const v = parseAzNumber(trimmed);
  if (v === null) return { ok: false, key: 'validation.nan', params: { example: rule.example } };
  const dec = trimmed.split(/[.,]/)[1]?.length ?? 0;
  if (dec > rule.decimals)
    return rule.decimals === 0
      ? { ok: false, key: 'validation.integer' }
      : { ok: false, key: 'validation.decimals', params: { n: rule.decimals } };
  if (rule.minExclusive && v <= rule.min)
    return rule.min === 0
      ? { ok: false, key: 'validation.positive' }
      : { ok: false, key: 'validation.greater', params: { min: fmt(rule.min) } };
  if (v < rule.min) return { ok: false, key: 'validation.min', params: { min: fmt(rule.min) } };
  if (v > rule.max) return { ok: false, key: 'validation.max', params: { max: fmt(rule.max) } };
  return { ok: true, value: v };
}

/** Limits for every editable rate (sanity ranges, not legal limits). */
export const FIELD_RULES: Record<NumericKey, NumberRule> = {
  electricityRateAznPerKwh: {
    min: 0,
    max: 1,
    minExclusive: true,
    decimals: 4,
    minDecimals: 2,
    example: '0,11',
  },
  electricityFixedFeeAzn: { min: 0, max: 1000, decimals: 2, example: '3' },
  gasRateAznPerM3: {
    min: 0,
    max: 5,
    minExclusive: true,
    decimals: 4,
    minDecimals: 2,
    example: '0,30',
  },
  gasFixedFeeAzn: { min: 0, max: 1000, decimals: 2, example: '0' },
  electricityBudgetAzn: {
    min: 0,
    max: 10_000_000,
    minExclusive: true,
    decimals: 0,
    example: '50 000',
  },
  gasBudgetAzn: { min: 0, max: 10_000_000, minExclusive: true, decimals: 0, example: '14 000' },
  scope1KgCo2PerKwh: {
    min: 0,
    max: 1,
    minExclusive: true,
    decimals: 4,
    minDecimals: 2,
    example: '0,202',
  },
  scope2KgCo2PerKwh: {
    min: 0,
    max: 2,
    minExclusive: true,
    decimals: 4,
    minDecimals: 2,
    example: '0,41',
  },
  gasKwhPerM3: { min: 5, max: 15, decimals: 2, example: '10' },
  euEtsPriceEurPerT: { min: 0, max: 1000, decimals: 2, example: '80' },
  eurToAzn: { min: 0, max: 10, minExclusive: true, decimals: 4, minDecimals: 2, example: '1,98' },
  annualEnergyReductionPct: { min: 0, max: 100, decimals: 1, example: '8' },
  annualCo2ReductionPct: { min: 0, max: 100, decimals: 1, example: '10' },
  annualCo2TargetT: { min: 0, max: 1_000_000, minExclusive: true, decimals: 0, example: '3 200' },
  enpiTargetKwhPerT: { min: 0, max: 10_000, minExclusive: true, decimals: 1, example: '360' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateText(
  text: string,
  o: { required?: boolean; max?: number } = {},
): ValidationResult | { ok: true; value: string } {
  const v = text.trim();
  if (o.required && !v) return { ok: false, key: 'validation.empty' };
  if (o.max && v.length > o.max)
    return { ok: false, key: 'validation.tooLong', params: { n: o.max } };
  return { ok: true, value: v };
}

export function validateEmail(
  text: string,
): { ok: true; value: string } | { ok: false; key: string } {
  const v = text.trim();
  if (!v) return { ok: false, key: 'validation.empty' };
  return EMAIL_RE.test(v)
    ? { ok: true, value: v.toLowerCase() }
    : { ok: false, key: 'validation.email' };
}

/** Telegram username or chat: @name (5–32 letters, digits, underscore). */
export function validateTelegram(
  text: string,
): { ok: true; value: string } | { ok: false; key: string } {
  const v = text.trim();
  if (!v) return { ok: false, key: 'validation.empty' };
  return /^@[A-Za-z0-9_]{5,32}$/.test(v)
    ? { ok: true, value: v }
    : { ok: false, key: 'validation.telegram' };
}

/** Day schedule: start < end, hours 0…24, shifts 0…3; no production = 0 shifts. */
export function validateDaySchedule(d: {
  shifts: number;
  start: number;
  end: number;
}): string | null {
  if (d.shifts === 0) return null;
  if (d.end <= d.start) return 'validation.endAfterStart';
  if ((d.end - d.start) / d.shifts < 4) return 'validation.shiftTooShort';
  return null;
}

export function validateShifts(shifts: { start: number; end: number }[]): string | null {
  for (const s of shifts) if (s.end <= s.start) return 'validation.endAfterStart';
  const sorted = [...shifts].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].start < sorted[i - 1].end) return 'validation.shiftOverlap';
  return null;
}
