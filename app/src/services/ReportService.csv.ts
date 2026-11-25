import { formatDate, formatMonthYear } from '../lib/format';
import type { Report, SavingsBlock } from './ReportService';

/**
 * CSV export (decision: semicolon separator, UTF-8 with BOM, CRLF, decimal
 * comma, no thousands separator). Excel with Azerbaijani/Russian/Turkish
 * regional settings uses ";" as list separator and "," as decimal mark, so
 * the file opens in columns with numeric cells; the BOM keeps ə, ş, ğ intact.
 */

export const CSV_DELIMITER = ';';
export const CSV_BOM = '\uFEFF';
const EOL = '\r\n';

export type CsvValue = string | number | null | undefined;

export interface CsvSection {
  title?: string;
  header: string[];
  rows: CsvValue[][];
}

/** Translator: (key in reports namespace or "ns:key", params) → text. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Number for CSV: decimal comma, ASCII minus, no grouping. */
export function csvNumber(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return '';
  const s = (Math.round(v * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
  const trimmed = decimals > 0 ? s.replace(/\.?0+$/, '') : s;
  return (trimmed === '-0' ? '0' : trimmed).replace('.', ',');
}

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? csvNumber(v) : v;
  return /[";\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(sections: CsvSection[]): string {
  const lines: string[] = [];
  sections.forEach((sec, i) => {
    if (i > 0) lines.push('');
    if (sec.title) lines.push(csvCell(sec.title));
    lines.push(sec.header.map(csvCell).join(CSV_DELIMITER));
    for (const r of sec.rows) lines.push(r.map(csvCell).join(CSV_DELIMITER));
  });
  return CSV_BOM + lines.join(EOL) + EOL;
}

const n0 = (v: number) => csvNumber(v, 0);
const n1 = (v: number) => csvNumber(v, 1);
const n2 = (v: number) => csvNumber(v, 2);
const n3 = (v: number) => csvNumber(v, 3);

/** CSV sections of a report (Azerbaijani headers from reports.json "csv.*"). */
export function reportCsvSections(r: Report, t: Translate): CsvSection[] {
  const f = r.figures;
  const head: CsvSection = {
    title: t(`template.${r.template}.title`),
    header: [t('csv.indicator'), t('csv.value'), t('csv.unit')],
    rows: [
      [t('csv.plant'), r.plant.name, ''],
      [t('csv.period'), formatMonthYear(r.period.start), ''],
      [t('csv.days'), f.days, t('csv.unitDays')],
      [t('csv.generated'), formatDate(r.generatedAt), ''],
      [t('csv.electricity'), n0(f.kwh), 'kVt·saat'],
      [t('csv.gas'), n0(f.m3), 'm³'],
      [t('csv.production'), n1(f.tons), 't'],
      [t('csv.enpi'), n1(f.enpi), 'kVt·saat/t'],
      [t('csv.enpiTarget'), n1(f.enpiTarget), 'kVt·saat/t'],
      [t('csv.elecCostToDate'), n0(f.electricity.costToDateAzn), 'AZN'],
      [t('csv.elecProjected'), n0(f.electricity.projectedAzn), 'AZN'],
      [t('csv.elecBudget'), n0(f.electricity.budgetAzn), 'AZN'],
      [
        t('csv.overrunProbability'),
        f.electricity.probability === null ? '' : n0(f.electricity.probability * 100),
        '%',
      ],
      [t('csv.gasProjected'), n0(f.gas.projectedAzn), 'AZN'],
      [t('csv.gasBudget'), n0(f.gas.budgetAzn), 'AZN'],
      [t('csv.wasteKwh'), n0(f.wasteKwh), 'kVt·saat'],
      [t('csv.wasteM3'), n0(f.wasteM3), 'm³'],
      [t('csv.wasteAzn'), n0(f.wasteAzn), 'AZN'],
      [t('csv.wasteShare'), n1(f.wasteSharePct), '%'],
      [t('csv.scope1'), n2(f.co2.scope1T), 't CO₂e'],
      [t('csv.scope2'), n2(f.co2.scope2T), 't CO₂e'],
      [t('csv.co2Total'), n2(f.co2.totalT), 't CO₂e'],
      [t('csv.tariff'), n3(r.rates.electricityRateAznPerKwh), 'AZN/kVt·saat'],
      [t('csv.gasTariff'), n3(r.rates.gasRateAznPerM3), 'AZN/m³'],
      [t('csv.scope2Factor'), n3(r.rates.scope2KgCo2PerKwh), 'kq CO₂/kVt·saat'],
      [t('csv.scope1Factor'), n3(r.rates.scope1KgCo2PerKwh), 'kq CO₂/kVt·saat'],
    ],
  };
  const recTitle = (id: string) => t(`common:rec.title.${id}`);
  const measure = (id: string) => t(`common:measure.${id}`);
  const savings = (s: SavingsBlock): CsvSection => ({
    title: t('csv.sectionSavings'),
    header: [
      t('csv.measure'),
      t('csv.status'),
      t('csv.method'),
      t('csv.expectedPct'),
      t('csv.verifiedPct'),
      t('csv.kwhPerMonth'),
      t('csv.aznPerMonth'),
      t('csv.ciKwh'),
    ],
    rows: s.items.map((m) => [
      measure(m.id),
      t(`common:mvStatus.${m.status}`),
      `Option ${m.method}`,
      n1(m.expectedPct),
      n1(m.savingPct),
      n0(m.avoidedPerMonthKwh),
      n0(m.avoidedPerMonthAzn),
      n0(m.ciKwh),
    ]),
  });
  switch (r.template) {
    case 'director':
      return [
        head,
        {
          title: t('csv.sectionTopWaste'),
          header: [
            t('csv.equipment'),
            t('csv.group'),
            t('csv.waste'),
            t('csv.unit'),
            t('csv.wasteAzn'),
            t('csv.sharePct'),
            t('csv.reason'),
          ],
          rows: r.topWaste.map((w) => [
            `${w.code} ${w.name}`,
            t(`common:group.${w.group}`),
            n0(w.waste),
            w.energy === 'gas' ? 'm³' : 'kVt·saat',
            n0(w.wasteAzn),
            n1(w.sharePct),
            w.rule ? t(`common:rule.${w.rule}`) : t('director.reasonBand'),
          ]),
        },
        savings(r.savings),
        {
          title: t('csv.sectionNext'),
          header: [
            t('csv.recommendation'),
            t('csv.effort'),
            t('csv.aznPerMonth'),
            t('csv.kwhPerMonth'),
            t('csv.m3PerMonth'),
            t('csv.tCo2PerYear'),
            t('csv.confidence'),
          ],
          rows: r.next.items.map((x) => [
            recTitle(x.id),
            t(`common:effort.${x.effort}`),
            n0(x.aznPerMonth),
            n0(x.kwhPerMonth),
            n0(x.m3PerMonth),
            n1(x.tCo2PerYear),
            n0(x.confidence),
          ]),
        },
      ];
    case 'energy_manager':
      return [
        head,
        {
          title: t('csv.sectionGroups'),
          header: [
            t('csv.group'),
            t('csv.energy'),
            t('csv.actual'),
            t('csv.optimal'),
            t('csv.waste'),
            t('csv.wastePct'),
            t('csv.wasteAzn'),
          ],
          rows: r.groups.map((g) => [
            t(`common:group.${g.group}`),
            t(`common:energy.${g.energy}`),
            n0(g.actual),
            n0(g.optimal),
            n0(g.waste),
            n1(g.wastePct),
            n0(g.wasteAzn),
          ]),
        },
        {
          title: t('csv.sectionAnomalies'),
          header: [
            t('csv.date'),
            t('csv.rule'),
            t('csv.severity'),
            t('csv.equipment'),
            t('csv.lossAzn'),
            t('csv.status'),
          ],
          rows: r.anomalies.items.map((x) => [
            formatDate(x.start),
            t(`common:rule.${x.rule}`),
            t(`common:severity.${x.severity}`),
            x.equipmentNames.join(', '),
            n0(x.lossAzn),
            t(`common:anomalyStatus.${x.status}`),
          ]),
        },
        {
          title: t('csv.sectionPipeline'),
          header: [
            t('csv.recommendation'),
            t('csv.status'),
            t('csv.aznPerMonth'),
            t('csv.tCo2PerYear'),
          ],
          rows: [...r.pipeline.active, ...r.pipeline.proposed].map((x) => [
            recTitle(x.id),
            t(`common:recStatus.${x.status}`),
            n0(x.aznPerMonth),
            n1(x.tCo2PerYear),
          ]),
        },
        savings(r.savings),
      ];
    case 'carbon':
      return [
        head,
        {
          title: t('csv.sectionMonthly'),
          header: [
            t('csv.month'),
            t('csv.electricity'),
            t('csv.gas'),
            t('csv.production'),
            t('csv.scope1'),
            t('csv.scope2'),
            t('csv.co2Total'),
            t('csv.intensity'),
          ],
          rows: r.months.map((m) => [
            formatMonthYear(m.start),
            n0(m.kwh),
            n0(m.m3),
            n1(m.tons),
            n2(m.scope1T),
            n2(m.scope2T),
            n2(m.totalT),
            n1(m.intensityKgPerT),
          ]),
        },
        {
          title: t('csv.sectionFactors'),
          header: [
            t('csv.factor'),
            t('csv.value'),
            t('csv.unit'),
            t('csv.source'),
            t('csv.lastChecked'),
          ],
          rows: r.factors.map((x) => [
            t(`carbonReport.factor.${x.id}`),
            n3(x.value),
            x.id === 'gasKwhPerM3' ? 'kVt·saat/m³' : 'kq CO₂/kVt·saat',
            x.source,
            x.lastChecked ? formatDate(new Date(x.lastChecked)) : '',
          ]),
        },
      ];
    case 'iso50001':
      return [
        head,
        {
          title: t('csv.sectionEnpi'),
          header: [t('csv.indicator'), t('csv.baseline'), t('csv.reporting'), t('csv.unit')],
          rows: [
            [t('csv.electricity'), n0(r.baseline.kwh), n0(r.reporting.kwh), 'kVt·saat'],
            [t('csv.production'), n1(r.baseline.tons), n1(r.reporting.tons), 't'],
            [t('csv.enpi'), n1(r.baseline.enpi), n1(r.reporting.enpi), 'kVt·saat/t'],
            [t('csv.adjustedBaseline'), '', n0(r.normalized.adjustedBaselineKwh), 'kVt·saat'],
            [t('csv.improvement'), '', n1(r.normalized.improvementPct), '%'],
            [t('csv.r2'), '', n3(r.model.r2), ''],
            [t('csv.cvRmse'), '', n1(r.model.cvRmsePct), '%'],
          ],
        },
        {
          title: t('csv.sectionSeu'),
          header: [t('csv.group'), t('csv.electricity'), t('csv.sharePct'), t('csv.significant')],
          rows: r.seu.map((s) => [
            t(`common:group.${s.group}`),
            n0(s.kwh),
            n1(s.sharePct),
            s.significant ? t('csv.yes') : t('csv.no'),
          ]),
        },
        {
          title: t('csv.sectionPipeline'),
          header: [
            t('csv.recommendation'),
            t('csv.status'),
            t('csv.aznPerMonth'),
            t('csv.tCo2PerYear'),
          ],
          rows: r.actions.active.map((x) => [
            recTitle(x.id),
            t(`common:recStatus.${x.status}`),
            n0(x.aznPerMonth),
            n1(x.tCo2PerYear),
          ]),
        },
        savings(r.savings),
      ];
  }
}

export const reportCsv = (r: Report, t: Translate) => toCsv(reportCsvSections(r, t));

// ---------------------------------------------------------------------------
// Meter data upload (Settings > Data sources)

/** Template for manual meter data uploads, with two example rows. */
export function meterCsvTemplate(columns: string[], example: CsvValue[][]): string {
  return toCsv([{ header: columns, rows: example }]);
}

export interface MeterCsvIssue {
  line: number;
  reason: 'columns' | 'date' | 'hour' | 'meter' | 'value';
}

export interface MeterCsvResult {
  headerOk: boolean;
  rows: number;
  issues: MeterCsvIssue[];
  meters: string[];
}

/** Split one CSV line (; or , separated, quotes supported). */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Validate an uploaded meter CSV against the template columns
 * (Tarix; Saat; Sayğac kodu; Sərfiyyat; Vahid). Data is not imported
 * into calculations (demo); the result drives the upload summary.
 */
export function parseMeterCsv(
  text: string,
  columns: string[],
  knownMeters: string[],
): MeterCsvResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (!lines.length) return { headerOk: false, rows: 0, issues: [], meters: [] };
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const header = splitLine(lines[0], delimiter).map((h) => h.toLowerCase());
  const headerOk =
    header.length >= columns.length && columns.every((c, i) => header[i] === c.toLowerCase());
  const issues: MeterCsvIssue[] = [];
  const meters = new Set<string>();
  const known = new Set(knownMeters.map((m) => m.toLowerCase()));
  if (!headerOk) return { headerOk, rows: lines.length - 1, issues, meters: [] };
  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i], delimiter);
    const line = i + 1;
    if (c.length < columns.length) {
      issues.push({ line, reason: 'columns' });
      continue;
    }
    const [date, hour, meter, value] = c;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      issues.push({ line, reason: 'date' });
      continue;
    }
    const h = Number(hour.replace(/:00$/, ''));
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      issues.push({ line, reason: 'hour' });
      continue;
    }
    if (!known.has(meter.toLowerCase())) {
      issues.push({ line, reason: 'meter' });
      continue;
    }
    const v = Number(value.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) {
      issues.push({ line, reason: 'value' });
      continue;
    }
    meters.add(meter);
  }
  return { headerOk, rows: lines.length - 1, issues, meters: [...meters] };
}
