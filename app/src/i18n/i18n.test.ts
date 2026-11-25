import { hasKey, interpolate, translate } from './index';

const modules = import.meta.glob<Record<string, unknown>>('./*/*.json', {
  eager: true,
  import: 'default',
});

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}
function values(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  return Object.values(obj as Record<string, unknown>).flatMap(values);
}

const ACRONYMS = new Set([
  'AI',
  'AZN',
  'CO₂',
  'CO₂e',
  'EnPI',
  'CBAM',
  'IPMVP',
  'VSD',
  'AHU',
  'M&V',
  'SCADA',
  'CSV',
  'PDF',
  'ISO',
  'ETS',
  'SIE',
  'P10',
  'P90',
  'K-2',
  'K-1',
  'E-1',
  'LED',
  'OK',
  'RMSE',
  'CDD',
  'HDD',
  // admin area (reports, settings)
  'RMSE',
  'CFO',
  'ESG',
  'UTC',
]);

describe('i18n resources', () => {
  const az = Object.entries(modules).filter(([p]) => p.startsWith('./az/'));
  it('has one file per area, mirrored in en with the same keys', () => {
    expect(az.map(([p]) => p.replace('./az/', '')).sort()).toEqual([
      'anomalies.json',
      'carbon.json',
      'common.json',
      'copilot.json',
      'decisions.json',
      'equipment.json',
      'forecast.json',
      'layout.json',
      'live.json',
      'mv.json',
      'overview.json',
      'reports.json',
      'settings.json',
    ]);
    for (const [p, json] of az) {
      const en = modules[p.replace('./az/', './en/')];
      expect(en, p).toBeDefined();
      expect(keys(en).sort(), p).toEqual(keys(json).sort());
    }
  });
  it('Azerbaijani copy: no em dash, no ALL CAPS words, no lorem ipsum', () => {
    for (const [p, json] of az) {
      for (const v of values(json)) {
        expect(v, p).not.toMatch(/—/);
        expect(v.toLowerCase(), p).not.toContain('lorem');
        for (const w of v.split(/[\s,.:;()/"«»]+/)) {
          if (
            w.length >= 3 &&
            w === w.toUpperCase() &&
            /[A-ZƏÖÜĞŞÇİ]/.test(w) &&
            !ACRONYMS.has(w) &&
            !/\d/.test(w)
          ) {
            throw new Error(`ALL CAPS "${w}" in ${p}: ${v}`);
          }
        }
      }
    }
  });
});

describe('translate', () => {
  it('resolves namespaced keys, interpolates and falls back', () => {
    expect(translate('az', 'layout', 'nav.overview')).toBe('Ümumi baxış');
    expect(translate('az', 'overview', 'layout:nav.live')).toBe('Canlı monitorinq');
    expect(translate('az', 'common', 'states.staleShort', { minutes: 12 })).toBe(
      'Son yenilənmə 12 dəqiqə əvvəl',
    );
    expect(translate('en', 'common', 'footer.demo')).toBe(
      'Demo versiya. Məlumatlar nümunə üçün yaradılıb.',
    );
    expect(translate('az', 'common', 'missing.key')).toBe('missing.key');
    expect(interpolate('{a} və {b}', { a: 1 })).toBe('1 və {b}');
    expect(interpolate('x')).toBe('x');
    expect(hasKey('az', 'common', 'rec.title.rec-comp-vsd')).toBe(true);
    expect(hasKey('az', 'common', 'layout:nav.nope')).toBe(false);
  });
});
