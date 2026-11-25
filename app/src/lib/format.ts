import { format as dfFormat, startOfWeek as dfStartOfWeek } from 'date-fns';
import { az } from 'date-fns/locale';

/**
 * Azerbaijani number, unit and date formatting (spec 5.9). Every number in
 * the UI goes through this file.
 *   57 600 (NBSP thousands), 0,41 (comma decimals), 25 noyabr 2026, 14:30.
 */

export const NBSP = '\u00A0';
/** typographic minus */
export const MINUS = '\u2212';

export const UNITS = {
  kw: 'kVt',
  kwh: 'kVt·saat',
  mwh: 'MVt·saat',
  m3: 'm³',
  m3h: 'm³/saat',
  azn: 'AZN',
  kgCo2: 'kq CO₂',
  tCo2: 't CO₂e',
  celsius: '°C',
  ton: 't',
  pct: '%',
  enpi: 'kVt·saat/t',
  co2Intensity: 'kq CO₂/t',
} as const;

export type UnitKey = keyof typeof UNITS;

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/**
 * Format a number: NBSP thousands separator, comma decimal separator,
 * typographic minus. NaN / Infinity render as an en dash placeholder.
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '–';
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const rounded = Number(fixed);
  const sign = value < 0 && rounded !== 0 ? MINUS : '';
  return sign + groupThousands(int) + (frac ? `,${frac}` : '');
}

/** Number with sensible precision: 0 decimals ≥ 100, 1 decimal ≥ 10, else 2. */
export function formatAuto(value: number): string {
  const a = Math.abs(value);
  return formatNumber(value, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 1 : 2);
}

export function withUnit(text: string, unit: UnitKey): string {
  return unit === 'pct' ? `${text}%` : `${text}${NBSP}${UNITS[unit]}`;
}

export const formatKw = (v: number, d = 0) => withUnit(formatNumber(v, d), 'kw');
export const formatKwh = (v: number, d = 0) => withUnit(formatNumber(v, d), 'kwh');
export const formatMwh = (kwh: number, d = 1) => withUnit(formatNumber(kwh / 1000, d), 'mwh');
/** kWh below 10 000 as kVt·saat, above as MVt·saat */
export const formatEnergy = (kwh: number) =>
  Math.abs(kwh) >= 10_000 ? formatMwh(kwh, Math.abs(kwh) >= 100_000 ? 0 : 1) : formatKwh(kwh);
export const formatM3 = (v: number, d = 0) => withUnit(formatNumber(v, d), 'm3');
export const formatAzn = (v: number, d = 0) => withUnit(formatNumber(v, d), 'azn');
export const formatKgCo2 = (v: number, d = 0) => withUnit(formatNumber(v, d), 'kgCo2');
export const formatTCo2 = (t: number, d = 1) => withUnit(formatNumber(t, d), 'tCo2');
export const formatTemp = (c: number, d = 1) => withUnit(formatNumber(c, d), 'celsius');
export const formatTons = (t: number, d = 0) => withUnit(formatNumber(t, d), 'ton');
export const formatEnpi = (v: number, d = 0) => withUnit(formatNumber(v, d), 'enpi');
export const formatIntensity = (v: number, d = 0) => withUnit(formatNumber(v, d), 'co2Intensity');
/** 78 -> "78%" (value already in percent) */
export const formatPct = (v: number, d = 0) => withUnit(formatNumber(v, d), 'pct');
/** 0.78 -> "78%" */
export const formatShare = (v: number, d = 0) => formatPct(v * 100, d);

/** Signed delta, e.g. "+4,2%" / "−3 AZN" */
export function formatSigned(value: number, formatter: (v: number) => string): string {
  if (!Number.isFinite(value)) return '–';
  const s = formatter(Math.abs(value));
  if (Math.abs(value) < 1e-9 || s.replace(/[^1-9]/g, '') === '') return s;
  return (value > 0 ? '+' : MINUS) + s;
}

/** Compact for axes: 12 400 -> "12,4 min", 1 250 000 -> "1,3 mln" */
export function formatCompact(value: number): string {
  const a = Math.abs(value);
  if (a >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)}${NBSP}mln`;
  if (a >= 10_000) return `${formatNumber(value / 1000, 0)}${NBSP}min`;
  if (a >= 1000) return `${formatNumber(value / 1000, 1)}${NBSP}min`;
  return formatNumber(value, a < 10 && a % 1 !== 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Dates (date-fns with the az locale; weeks start on Monday)

export const WEEK_STARTS_ON = 1 as const;
export const dateLocale = az;

const toDate = (d: Date | number) => (typeof d === 'number' ? new Date(d) : d);
/** date-fns az capitalises month and weekday names; Azerbaijani writes them in lower case. */
const lower = (s: string) => s.toLocaleLowerCase('az');
const fmt = (d: Date | number, pattern: string) =>
  lower(dfFormat(toDate(d), pattern, { locale: az }));

/** 25 noyabr 2026 */
export const formatDate = (d: Date | number) => fmt(d, 'd MMMM yyyy');
/** 25 noyabr */
export const formatDayMonth = (d: Date | number) => fmt(d, 'd MMMM');
/** 25 noy */
export const formatDayShort = (d: Date | number) => fmt(d, 'd MMM');
/** 14:30 */
export const formatTime = (d: Date | number) => fmt(d, 'HH:mm');
/** 25 noyabr 2026, 14:30 */
export const formatDateTime = (d: Date | number) => `${formatDate(d)}, ${formatTime(d)}`;
/** noyabr 2026 */
export const formatMonthYear = (d: Date | number) => fmt(d, 'LLLL yyyy');
/** noy */
export const formatMonthShort = (d: Date | number) => fmt(d, 'LLL');
/** bazar ertəsi */
export const formatWeekday = (d: Date | number) => fmt(d, 'EEEE');
/** b.e (short weekday) */
export const formatWeekdayShort = (d: Date | number) => fmt(d, 'EEEEEE');

export const startOfWeek = (d: Date | number) =>
  dfStartOfWeek(toDate(d), { weekStartsOn: WEEK_STARTS_ON });

/** "25–30 noyabr 2026" style range (en dash between numbers is allowed). */
export function formatDateRange(from: Date | number, to: Date | number): string {
  const a = toDate(from);
  const b = toDate(to);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    if (a.getDate() === b.getDate()) return formatDate(a);
    return `${a.getDate()}–${formatDate(b)}`;
  }
  if (a.getFullYear() === b.getFullYear()) return `${formatDayMonth(a)} – ${formatDate(b)}`;
  return `${formatDate(a)} – ${formatDate(b)}`;
}

/** Hours as "5,5 saat" */
export const formatHours = (h: number) => `${formatNumber(h, h % 1 === 0 ? 0 : 1)}${NBSP}saat`;

/** Minutes ago split into value + unit key for i18n ("{n} dəqiqə əvvəl"). */
export function minutesAgo(from: number, now: number): number {
  return Math.max(0, Math.round((now - from) / 60_000));
}
