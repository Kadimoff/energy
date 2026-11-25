import type { Severity } from '../data/types';
import type { AnomalyVM, MonthOverview } from '../domain/viewmodels';

/**
 * Report auto-send schedules and alert rules (UI simulation: nothing is sent).
 * Pure functions; the admin store persists the user's choices.
 */

export const REPORT_TEMPLATES = ['director', 'energy_manager', 'carbon', 'iso50001'] as const;
export type ReportTemplateId = (typeof REPORT_TEMPLATES)[number];

export type ScheduleFrequency = 'weekly' | 'monthly';

export interface ReportSchedule {
  id: string;
  template: ReportTemplateId;
  frequency: ScheduleFrequency;
  /** 0 = Monday … 6 = Sunday (weekly) */
  weekday: number;
  /** 1…28 (monthly; 28 keeps every month valid) */
  dayOfMonth: number;
  /** local hour 0…23 */
  hour: number;
  recipients: string[];
  format: 'pdf' | 'csv';
  enabled: boolean;
}

/** Next send time (local) strictly after `nowMs`. */
export function nextRunAt(
  s: Pick<ReportSchedule, 'frequency' | 'weekday' | 'dayOfMonth' | 'hour'>,
  nowMs: number,
): number {
  const now = new Date(nowMs);
  if (s.frequency === 'weekly') {
    const jsDay = (s.weekday + 1) % 7; // JS: 0 = Sunday
    for (let add = 0; add <= 7; add++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, s.hour, 0, 0, 0);
      if (d.getDay() === jsDay && d.getTime() > nowMs) return d.getTime();
    }
  }
  const day = Math.min(28, Math.max(1, Math.round(s.dayOfMonth)));
  for (let add = 0; add <= 1; add++) {
    const d = new Date(now.getFullYear(), now.getMonth() + add, day, s.hour, 0, 0, 0);
    if (d.getTime() > nowMs) return d.getTime();
  }
  return new Date(now.getFullYear(), now.getMonth() + 2, day, s.hour).getTime();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

/** Split a free-text recipient list (comma, semicolon, space, new line). */
export function parseRecipients(text: string): { valid: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid = [...new Set(parts.filter(isEmail).map((p) => p.toLowerCase()))];
  const invalid = parts.filter((p) => !isEmail(p));
  return { valid, invalid };
}

// ---------------------------------------------------------------------------
// Alert rules

export type AlertRuleId = 'budget' | 'anomaly' | 'peak' | 'stale' | 'enpi';

export interface AlertRule {
  id: AlertRuleId;
  enabled: boolean;
  /**
   * budget: overrun probability %, anomaly: minimum severity level
   * (1 = critical only … 4 = all), peak: kW, stale: minutes, enpi: % above target
   */
  threshold: number;
  channels: { email: boolean; telegram: boolean; inApp: boolean };
}

export interface AlertRuleLimits {
  min: number;
  max: number;
  decimals: number;
}

export const ALERT_LIMITS: Record<AlertRuleId, AlertRuleLimits> = {
  budget: { min: 1, max: 100, decimals: 0 },
  anomaly: { min: 1, max: 4, decimals: 0 },
  peak: { min: 50, max: 10000, decimals: 0 },
  stale: { min: 1, max: 1440, decimals: 0 },
  enpi: { min: 1, max: 100, decimals: 0 },
};

const SEVERITY_LEVEL: Record<Severity, number> = { critical: 1, high: 2, medium: 3, low: 4 };

export interface AlertInputs {
  overview: MonthOverview;
  anomalies: AnomalyVM[];
  /** highest hourly electric load in the last 7 days (kW) */
  peakKw: number;
  /** minutes since the oldest disconnected meter went offline (0 = all connected) */
  staleMinutes: number;
}

export interface AlertStatus {
  id: AlertRuleId;
  /** current value of the monitored quantity in the rule's unit */
  value: number;
  triggered: boolean;
}

/** Evaluate the rules against current data ("would fire now"). */
export function evaluateAlerts(rules: AlertRule[], i: AlertInputs): AlertStatus[] {
  return rules.map((r) => {
    let value = 0;
    switch (r.id) {
      case 'budget':
        value = i.overview.electricity.overrunProbability * 100;
        break;
      case 'anomaly':
        value = i.anomalies.filter(
          (a) =>
            (a.status === 'open' || a.status === 'investigating') &&
            SEVERITY_LEVEL[a.severity] <= r.threshold,
        ).length;
        return { id: r.id, value, triggered: r.enabled && value > 0 };
      case 'peak':
        value = i.peakKw;
        break;
      case 'stale':
        value = i.staleMinutes;
        break;
      case 'enpi': {
        const t = i.overview.enpi.targetKwhPerT;
        value = t > 0 ? (i.overview.enpi.value / t - 1) * 100 : 0;
        break;
      }
    }
    return { id: r.id, value, triggered: r.enabled && value >= r.threshold };
  });
}
