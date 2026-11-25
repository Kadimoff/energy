import { formatNumber, formatWeekday } from '@/lib/format';

/** Tariff / factor value with up to 3 decimals and no trailing zeros: 0,11 · 0,202 · 10. */
export function formatRate(v: number, max = 3, min = 0): string {
  const s = formatNumber(v, max);
  if (!s.includes(',')) return min > 0 ? formatNumber(v, min) : s;
  const [int, frac] = s.split(',');
  const trimmed = frac.replace(/0+$/, '').padEnd(min, '0');
  return trimmed ? `${int},${trimmed}` : int;
}

/** Monday 1 January 2024: weekday names (0 = Monday) via the az date locale. */
export const weekdayName = (i: number) => formatWeekday(new Date(2024, 0, 1 + i));
export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
