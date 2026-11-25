import { baseConfig, resolveRates } from '@/data/config';
import { effectiveRecStates, anomalyVMs, recommendationVMs } from '@/domain/viewmodels';
import { cumulativeSavings } from '@/domain/mv';
import { translate } from '@/i18n';
import { fixture } from '@/test/fixture';
import type { EffectiveRates } from '@/data/config';
import {
  buildCarbonReport,
  buildDirectorReport,
  buildEnergyManagerReport,
  buildIsoReport,
  buildReport,
  reportPeriods,
  type ReportInputs,
} from './ReportService';
import {
  CSV_BOM,
  csvCell,
  csvNumber,
  meterCsvTemplate,
  parseMeterCsv,
  reportCsv,
  toCsv,
} from './ReportService.csv';
import {
  evaluateAlerts,
  nextRunAt,
  parseRecipients,
  REPORT_TEMPLATES,
  type AlertRule,
} from './ReportService.schedule';
import { monthOverview } from '@/domain/viewmodels';

const a = fixture();
void cumulativeSavings;

function inputs(rates: EffectiveRates, monthKey?: string): ReportInputs {
  const states = effectiveRecStates(
    Object.fromEntries(
      a.engine.recommendations.map((r) => [r.id, { status: 'proposed' as const, updatedAt: 0 }]),
    ),
    {},
  );
  const recs = recommendationVMs(a.engine.recommendations, states, rates, a.ds.equipment);
  return {
    analysis: a,
    rates,
    recStates: states,
    recommendations: recs,
    anomalies: anomalyVMs(a.anomalies, {}, rates, a.ds.equipment),
    measures: a.measures.map((m) => ({
      ...m,
      avoidedAzn: m.avoidedKwh * rates.electricityRateAznPerKwh,
      avoidedPerMonthAzn: m.avoidedPerMonthKwh * rates.electricityRateAznPerKwh,
    })),
    plant: {
      name: 'Nümunə',
      sector: 's',
      location: 'l',
      areaM2: 18500,
      staticFactorsChanged: false,
    },
    monthKey: monthKey ?? reportPeriods(a)[0].key,
  };
}

const rates = resolveRates(baseConfig);
const t = (k: string, p?: Record<string, string | number>) => translate('az', 'reports', k, p);

describe('ReportService periods and director report', () => {
  it('lists months newest first with the current month on top', () => {
    const ps = reportPeriods(a);
    expect(ps[0].isCurrent).toBe(true);
    expect(ps[0].key).toBe('2026-11');
    expect(ps.length).toBeGreaterThanOrEqual(13);
    expect(ps.slice(1).every((p) => p.complete)).toBe(true);
  });

  it('director figures agree with the overview view model (same domain path)', () => {
    const i = inputs(rates);
    const r = buildDirectorReport(i);
    const ov = monthOverview(a, rates, i.recStates);
    expect(r.figures.electricity.projectedAzn).toBeCloseTo(ov.electricity.costMean, 6);
    expect(r.figures.electricity.probability).toBeCloseTo(ov.electricity.overrunProbability, 6);
    expect(r.figures.kwh).toBeCloseTo(ov.consumptionKwh.value, 6);
    expect(r.figures.co2.totalT).toBeCloseTo(ov.co2T.value, 6);
    expect(r.figures.co2MonthlyTargetT).toBeCloseTo(ov.co2T.monthlyTargetT, 6);
    expect(r.topWaste).toHaveLength(3);
    expect(r.topWaste[0].wasteAzn).toBeGreaterThanOrEqual(r.topWaste[1].wasteAzn);
    expect(r.next.items.length).toBeLessThanOrEqual(3);
    expect(r.next.forecast).not.toBeNull();
    expect(r.next.forecast!.costWithRecsAzn).toBeLessThan(r.next.forecast!.costAzn);
    expect(r.savings.verifiedCount).toBeGreaterThan(0);
    expect(r.daily.length).toBe(r.figures.daysInMonth);
  });

  it('closed month: actual cost, no probability, no next month forecast', () => {
    const prev = reportPeriods(a)[1];
    const r = buildDirectorReport(inputs(rates, prev.key));
    expect(r.figures.electricity.probability).toBeNull();
    expect(r.figures.electricity.projectedAzn).toBeCloseTo(r.figures.electricity.costToDateAzn, 6);
    expect(['within', 'overrun']).toContain(r.figures.electricity.state);
    expect(r.next.forecast).toBeNull();
  });

  it('a tariff, budget or factor change flows into every report number', () => {
    const r1 = buildDirectorReport(inputs(rates));
    const r2 = buildDirectorReport(
      inputs(
        resolveRates(baseConfig, {
          electricityRateAznPerKwh: 0.2,
          electricityBudgetAzn: 90000,
          scope2KgCo2PerKwh: 0.5,
        }),
      ),
    );
    expect(r2.figures.electricity.projectedAzn).toBeGreaterThan(
      r1.figures.electricity.projectedAzn * 1.7,
    );
    expect(r2.figures.electricity.budgetAzn).toBe(90000);
    expect(r2.figures.co2.scope2T / r1.figures.co2.scope2T).toBeCloseTo(0.5 / 0.41, 6);
    expect(r2.savings.verifiedPerMonthAzn).toBeGreaterThan(r1.savings.verifiedPerMonthAzn);
  });
});

describe('ReportService other templates', () => {
  it('energy manager report: groups, anomalies, pipeline, model', () => {
    const r = buildEnergyManagerReport(inputs(rates));
    expect(r.groups.length).toBeGreaterThanOrEqual(6);
    expect(r.groups[r.groups.length - 1].energy).toBe('gas');
    const sumWaste = r.groups
      .filter((g) => g.energy === 'electricity')
      .reduce((s, g) => s + g.waste, 0);
    expect(sumWaste).toBeCloseTo(r.figures.wasteKwh, 3);
    expect(r.peakKw).toBeGreaterThan(0);
    expect(r.anomalies.total).toBeGreaterThan(0);
    expect(r.pipeline.counts.proposed).toBe(a.engine.recommendations.length);
    expect(r.model.r2).toBeGreaterThan(0.5);
  });

  it('carbon report: 12 months, target, factors with sources', () => {
    const r = buildCarbonReport(inputs(rates));
    expect(r.months.length).toBe(12);
    expect(r.rolling.totalT).toBeCloseTo(r.rolling.scope1T + r.rolling.scope2T, 6);
    expect(r.target.targetT).toBeCloseTo(r.target.baselineT * 0.9, 6);
    expect(r.factors.map((f) => f.id)).toEqual(['scope2', 'scope1', 'gasKwhPerM3']);
    expect(r.factors.every((f) => f.source.length > 0)).toBe(true);
    const s = r.sources.reduce((x, y) => x + y.sharePct, 0);
    expect(s).toBeCloseTo(100, 6);
    const changed = buildCarbonReport(inputs(resolveRates(baseConfig, { scope2KgCo2PerKwh: 0.5 })));
    expect(changed.factors[0].overridden).toBe(true);
  });

  it('ISO 50001 review: EnB, EnPI, normalised performance, SEU, targets', () => {
    const r = buildIsoReport(inputs(rates));
    expect(r.baseline.months).toBe(12);
    expect(r.baseline.enpi).toBeGreaterThan(0);
    expect(r.reporting.enpi).toBeGreaterThan(0);
    expect(r.normalized.adjustedBaselineKwh).toBeGreaterThan(0);
    expect(r.seu.some((s) => s.significant)).toBe(true);
    expect(r.targets.energyTargetKwhPerYear).toBeCloseTo(r.targets.baselineKwhPerYear * 0.92, 3);
  });

  it('buildReport dispatches every template', () => {
    for (const id of REPORT_TEMPLATES) expect(buildReport(id, inputs(rates)).template).toBe(id);
  });
});

describe('CSV export', () => {
  it('formats cells: decimal comma, quoting, BOM, semicolons, CRLF', () => {
    expect(csvNumber(1234.567, 2)).toBe('1234,57');
    expect(csvNumber(-0.0001, 2)).toBe('0');
    expect(csvNumber(10, 2)).toBe('10');
    expect(csvNumber(Number.NaN)).toBe('');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "x"')).toBe('"say ""x"""');
    expect(csvCell(null)).toBe('');
    const csv = toCsv([{ title: 'Başlıq', header: ['Göstərici', 'Dəyər'], rows: [['Ə', 1.5]] }]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}Başlıq\r\nGöstərici;Dəyər\r\nƏ;1,5\r\n`);
  });

  it('every report exports Azerbaijani headers without missing keys', () => {
    for (const id of REPORT_TEMPLATES) {
      const csv = reportCsv(buildReport(id, inputs(rates)), t);
      expect(csv.startsWith(CSV_BOM)).toBe(true);
      expect(csv).toContain('Göstərici;Dəyər;Vahid');
      expect(csv).not.toMatch(/csv\.|common:|template\./);
    }
  });

  it('meter template round-trips through the validator', () => {
    const cols = ['Tarix', 'Saat', 'Sayğac kodu', 'Sərfiyyat', 'Vahid'];
    const tpl = meterCsvTemplate(cols, [
      ['2026-11-24', '08:00', 'K-1', 61.4, 'kVt·saat'],
      ['2026-11-24', '09:00', 'K-1', 63.2, 'kVt·saat'],
    ]);
    const ok = parseMeterCsv(tpl, cols, ['K-1']);
    expect(ok).toEqual({ headerOk: true, rows: 2, issues: [], meters: ['K-1'] });
    const bad = parseMeterCsv(
      `${tpl}2026-13-40;08:00;K-1;1;kVt·saat\r\n2026-11-24;25;K-1;1;x\r\n2026-11-24;1;X-9;1;x\r\n2026-11-24;1;K-1;abc;x\r\n2026-11-24;1\r\n`,
      cols,
      ['K-1'],
    );
    expect(bad.issues.map((i) => i.reason)).toEqual(['date', 'hour', 'meter', 'value', 'columns']);
    expect(parseMeterCsv('a,b\n1,2', cols, []).headerOk).toBe(false);
    expect(parseMeterCsv('', cols, []).rows).toBe(0);
  });
});

describe('schedules and alerts', () => {
  const now = new Date(2026, 10, 25, 14, 30).getTime(); // Wednesday
  it('computes the next weekly and monthly run', () => {
    expect(
      new Date(nextRunAt({ frequency: 'weekly', weekday: 0, dayOfMonth: 1, hour: 8 }, now)),
    ).toEqual(new Date(2026, 10, 30, 8));
    expect(
      new Date(nextRunAt({ frequency: 'weekly', weekday: 2, dayOfMonth: 1, hour: 16 }, now)),
    ).toEqual(new Date(2026, 10, 25, 16));
    expect(
      new Date(nextRunAt({ frequency: 'weekly', weekday: 2, dayOfMonth: 1, hour: 9 }, now)),
    ).toEqual(new Date(2026, 11, 2, 9));
    expect(
      new Date(nextRunAt({ frequency: 'monthly', weekday: 0, dayOfMonth: 1, hour: 9 }, now)),
    ).toEqual(new Date(2026, 11, 1, 9));
    expect(
      new Date(nextRunAt({ frequency: 'monthly', weekday: 0, dayOfMonth: 28, hour: 9 }, now)),
    ).toEqual(new Date(2026, 10, 28, 9));
  });

  it('parses recipient lists', () => {
    expect(parseRecipients('a@b.az, A@b.az; c@d.example  bad@')).toEqual({
      valid: ['a@b.az', 'c@d.example'],
      invalid: ['bad@'],
    });
  });

  it('evaluates alert rules against current data', () => {
    const i = inputs(rates);
    const ov = monthOverview(a, rates, i.recStates);
    const rules: AlertRule[] = [
      {
        id: 'budget',
        enabled: true,
        threshold: 1,
        channels: { email: true, telegram: false, inApp: true },
      },
      {
        id: 'anomaly',
        enabled: true,
        threshold: 4,
        channels: { email: true, telegram: false, inApp: true },
      },
      {
        id: 'peak',
        enabled: true,
        threshold: 100000,
        channels: { email: true, telegram: false, inApp: true },
      },
      {
        id: 'stale',
        enabled: false,
        threshold: 1,
        channels: { email: true, telegram: false, inApp: true },
      },
      {
        id: 'enpi',
        enabled: true,
        threshold: 100,
        channels: { email: true, telegram: false, inApp: true },
      },
    ];
    const st = evaluateAlerts(rules, {
      overview: ov,
      anomalies: i.anomalies,
      peakKw: 900,
      staleMinutes: 30,
    });
    expect(st.map((s) => s.triggered)).toEqual([
      ov.electricity.overrunProbability >= 0.01,
      true,
      false,
      false,
      false,
    ]);
    expect(st[3].value).toBe(30);
  });
});
