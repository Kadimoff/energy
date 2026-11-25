import {
  formatAzn,
  formatCompact,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDayShort,
  formatEnergy,
  formatHours,
  formatKgCo2,
  formatKw,
  formatKwh,
  formatM3,
  formatMonthYear,
  formatMwh,
  formatNumber,
  formatPct,
  formatShare,
  formatSigned,
  formatTCo2,
  formatTemp,
  formatTime,
  formatWeekday,
  minutesAgo,
  MINUS,
  NBSP,
  startOfWeek,
  UNITS,
} from './format';

const n = (s: string) => s.replace(/\u00A0/g, ' ');

describe('formatNumber (spec 5.9)', () => {
  it('uses NBSP thousands and comma decimals', () => {
    expect(formatNumber(57600)).toBe(`57${NBSP}600`);
    expect(formatNumber(0.41, 2)).toBe('0,41');
    expect(formatNumber(1234567.891, 1)).toBe(`1${NBSP}234${NBSP}567,9`);
    expect(formatNumber(999)).toBe('999');
  });
  it('handles negatives, rounding and non-finite values', () => {
    expect(formatNumber(-1500)).toBe(`${MINUS}1${NBSP}500`);
    expect(formatNumber(-0.004, 2)).toBe('0,00');
    expect(formatNumber(Number.NaN)).toBe('–');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('–');
  });
});

describe('units', () => {
  it('formats energy, power, money and CO₂ with units', () => {
    expect(n(formatKwh(57600))).toBe('57 600 kVt·saat');
    expect(n(formatMwh(485_300))).toBe('485,3 MVt·saat');
    expect(n(formatKw(90))).toBe('90 kVt');
    expect(n(formatM3(45000))).toBe('45 000 m³');
    expect(n(formatAzn(7600))).toBe('7 600 AZN');
    expect(n(formatKgCo2(149))).toBe('149 kq CO₂');
    expect(n(formatTCo2(8311))).toBe('8 311,0 t CO₂e');
    expect(n(formatTemp(-3.25))).toBe('−3,3 °C');
    expect(formatPct(78)).toBe('78%');
    expect(formatShare(0.785, 1)).toBe('78,5%');
    expect(n(formatHours(5.5))).toBe('5,5 saat');
    expect(UNITS.kwh).toBe('kVt·saat');
  });
  it('switches kWh to MWh above 10 000', () => {
    expect(n(formatEnergy(9500))).toBe('9 500 kVt·saat');
    expect(n(formatEnergy(12_345))).toBe('12,3 MVt·saat');
    expect(n(formatEnergy(512_000))).toBe('512 MVt·saat');
  });
  it('formats signed deltas and compact axis values', () => {
    expect(formatSigned(4.2, (v) => formatPct(v, 1))).toBe('+4,2%');
    expect(formatSigned(-3, (v) => formatAzn(v))).toBe(`${MINUS}3${NBSP}AZN`);
    expect(formatSigned(0, (v) => formatPct(v))).toBe('0%');
    expect(formatSigned(Number.NaN, (v) => formatPct(v))).toBe('–');
    expect(n(formatCompact(12_400))).toBe('12 min');
    expect(n(formatCompact(1_250_000))).toBe('1,3 mln');
    expect(n(formatCompact(1500))).toBe('1,5 min');
    expect(formatCompact(5.5)).toBe('5,5');
    expect(formatCompact(250)).toBe('250');
  });
});

describe('dates (az locale, Monday weeks)', () => {
  const d = new Date(2026, 10, 25, 14, 30);
  it('formats dates in Azerbaijani, lower-case months', () => {
    expect(formatDate(d)).toBe('25 noyabr 2026');
    expect(formatTime(d)).toBe('14:30');
    expect(formatDateTime(d)).toBe('25 noyabr 2026, 14:30');
    expect(formatMonthYear(d)).toBe('noyabr 2026');
    expect(formatDayShort(d)).toBe('25 noy');
    expect(formatWeekday(d)).toBe('çərşənbə');
    expect(formatDate(new Date(2026, 5, 3))).toBe('3 iyun 2026');
  });
  it('starts the week on Monday', () => {
    expect(startOfWeek(d).getDay()).toBe(1);
    expect(startOfWeek(d).getDate()).toBe(23);
  });
  it('formats ranges', () => {
    expect(formatDateRange(new Date(2026, 10, 1), new Date(2026, 10, 30))).toBe('1–30 noyabr 2026');
    expect(formatDateRange(d, d)).toBe('25 noyabr 2026');
    expect(formatDateRange(new Date(2026, 9, 5), new Date(2026, 10, 2))).toBe(
      '5 oktyabr – 2 noyabr 2026',
    );
    expect(formatDateRange(new Date(2025, 11, 5), new Date(2026, 0, 2))).toBe(
      '5 dekabr 2025 – 2 yanvar 2026',
    );
  });
  it('computes minutes ago', () => {
    expect(minutesAgo(0, 12 * 60_000)).toBe(12);
    expect(minutesAgo(100, 0)).toBe(0);
  });
});
