import {
  parseAzNumber,
  validateDaySchedule,
  validateEmail,
  validateNumber,
  validateShifts,
  validateTelegram,
  validateText,
  FIELD_RULES,
} from './validation';

describe('settings validation', () => {
  it('parses Azerbaijani numbers', () => {
    expect(parseAzNumber('0,11')).toBe(0.11);
    expect(parseAzNumber('0.11')).toBe(0.11);
    expect(parseAzNumber('50 000')).toBe(50000);
    expect(parseAzNumber('50\u00A0000')).toBe(50000);
    expect(parseAzNumber('\u22123')).toBe(-3);
    expect(parseAzNumber('abc')).toBeNull();
    expect(parseAzNumber('1,2,3')).toBeNull();
  });

  it('validates numbers with friendly message keys', () => {
    const r = FIELD_RULES.electricityRateAznPerKwh;
    expect(validateNumber('0,12', r)).toEqual({ ok: true, value: 0.12 });
    expect(validateNumber('', r)).toMatchObject({ ok: false, key: 'validation.empty' });
    expect(validateNumber('0,', r)).toMatchObject({ ok: false, incomplete: true });
    expect(validateNumber('on bir', r)).toMatchObject({
      ok: false,
      key: 'validation.nan',
      params: { example: '0,11' },
    });
    expect(validateNumber('0', r)).toMatchObject({ ok: false, key: 'validation.positive' });
    expect(validateNumber('2', r)).toMatchObject({
      ok: false,
      key: 'validation.max',
      params: { max: '1' },
    });
    expect(validateNumber('0,123456', r)).toMatchObject({
      ok: false,
      key: 'validation.decimals',
      params: { n: 4 },
    });
    expect(validateNumber('50000,5', FIELD_RULES.electricityBudgetAzn)).toMatchObject({
      key: 'validation.integer',
    });
    expect(validateNumber('4', FIELD_RULES.gasKwhPerM3)).toMatchObject({
      key: 'validation.min',
      params: { min: '5' },
    });
    expect(
      validateNumber('0,5', { min: 0.5, max: 2, minExclusive: true, decimals: 2, example: '1' }),
    ).toMatchObject({
      key: 'validation.greater',
      params: { min: '0,5' },
    });
  });

  it('validates text, e-mail, telegram and schedules', () => {
    expect(validateText('  ', { required: true })).toMatchObject({
      ok: false,
      key: 'validation.empty',
    });
    expect(validateText('abcdef', { max: 3 })).toMatchObject({
      ok: false,
      key: 'validation.tooLong',
    });
    expect(validateText(' Zavod ', { required: true })).toEqual({ ok: true, value: 'Zavod' });
    expect(validateEmail('Ad@Zavod.az')).toEqual({ ok: true, value: 'ad@zavod.az' });
    expect(validateEmail('ad@zavod')).toMatchObject({ ok: false, key: 'validation.email' });
    expect(validateEmail('')).toMatchObject({ ok: false, key: 'validation.empty' });
    expect(validateTelegram('@numune_enerji')).toMatchObject({ ok: true });
    expect(validateTelegram('numune')).toMatchObject({ ok: false, key: 'validation.telegram' });
    expect(validateTelegram('')).toMatchObject({ ok: false });
    expect(validateDaySchedule({ shifts: 0, start: 0, end: 0 })).toBeNull();
    expect(validateDaySchedule({ shifts: 2, start: 8, end: 24 })).toBeNull();
    expect(validateDaySchedule({ shifts: 1, start: 16, end: 8 })).toBe('validation.endAfterStart');
    expect(validateDaySchedule({ shifts: 3, start: 8, end: 16 })).toBe('validation.shiftTooShort');
    expect(
      validateShifts([
        { start: 8, end: 16 },
        { start: 16, end: 24 },
      ]),
    ).toBeNull();
    expect(
      validateShifts([
        { start: 8, end: 17 },
        { start: 16, end: 24 },
      ]),
    ).toBe('validation.shiftOverlap');
    expect(validateShifts([{ start: 10, end: 8 }])).toBe('validation.endAfterStart');
  });
});
