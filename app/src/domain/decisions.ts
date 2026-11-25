import type { Effort, RecommendationStatus, RejectReason } from '../data/types';
import { DAY_MS, type AnalysisCore } from './core';
import type { RecommendationVM, ResolvedRange } from './viewmodels';

/**
 * AI Decision Center logic (spec 7.6): status flow, filters, impact levels,
 * impact vs effort priority matrix and validation of human decisions.
 */

/** Status flow shown as Kanban columns; `scheduled` lives in the approved column. */
export const FLOW_COLUMNS = [
  'proposed',
  'approved',
  'in_progress',
  'measuring',
  'verified',
] as const;
export type FlowColumn = (typeof FLOW_COLUMNS)[number];

export function columnOf(status: RecommendationStatus): FlowColumn | 'rejected' {
  if (status === 'scheduled') return 'approved';
  return status;
}

export function groupByColumn(
  vms: RecommendationVM[],
): Record<FlowColumn | 'rejected', RecommendationVM[]> {
  const out: Record<FlowColumn | 'rejected', RecommendationVM[]> = {
    proposed: [],
    approved: [],
    in_progress: [],
    measuring: [],
    verified: [],
    rejected: [],
  };
  for (const v of vms) out[columnOf(v.status)].push(v);
  return out;
}

/**
 * Next manual step in the flow. Verified saving is never set by hand: it
 * comes from M&V, so `measuring` has no manual next step.
 */
export function nextStatus(status: RecommendationStatus): RecommendationStatus | null {
  switch (status) {
    case 'approved':
    case 'scheduled':
      return 'in_progress';
    case 'in_progress':
      return 'measuring';
    default:
      return null;
  }
}

/** Decision actions available for a status. */
export function availableActions(status: RecommendationStatus) {
  return {
    approve: status === 'proposed',
    schedule: status === 'proposed' || status === 'approved' || status === 'scheduled',
    reject: status === 'proposed' || status === 'approved' || status === 'scheduled',
    advance: nextStatus(status) !== null,
    reopen: status === 'rejected',
  };
}

// ---------------------------------------------------------------------------
// Impact levels and filters

export type ImpactLevel = 'high' | 'medium' | 'low';

/** AZN per month thresholds for the impact filter (UI classification, not a tariff). */
export const IMPACT_THRESHOLDS = { high: 1000, medium: 400 } as const;

export function impactLevel(
  aznPerMonth: number,
  t: { high: number; medium: number } = IMPACT_THRESHOLDS,
): ImpactLevel {
  return aznPerMonth >= t.high ? 'high' : aznPerMonth >= t.medium ? 'medium' : 'low';
}

export type StatusFilter = 'all' | 'pending' | 'active' | 'rejected';

export interface DecisionFilters {
  status: StatusFilter;
  categories: RecommendationVM['category'][];
  impact: ImpactLevel[];
  effort: Effort[];
}

export const EMPTY_FILTERS: DecisionFilters = {
  status: 'all',
  categories: [],
  impact: [],
  effort: [],
};

export function matchesStatus(status: RecommendationStatus, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'pending') return status === 'proposed';
  if (f === 'rejected') return status === 'rejected';
  return status !== 'proposed' && status !== 'rejected';
}

export function filterDecisions(vms: RecommendationVM[], f: DecisionFilters): RecommendationVM[] {
  return vms.filter(
    (v) =>
      matchesStatus(v.status, f.status) &&
      (!f.categories.length || f.categories.includes(v.category)) &&
      (!f.impact.length || f.impact.includes(impactLevel(v.aznPerMonth))) &&
      (!f.effort.length || f.effort.includes(v.effort)),
  );
}

export function activeFilterCount(f: DecisionFilters): number {
  return (f.status !== 'all' ? 1 : 0) + f.categories.length + f.impact.length + f.effort.length;
}

// ---------------------------------------------------------------------------
// Priority matrix: impact (y) vs effort (x)

export type Quadrant = 'quick_win' | 'strategic' | 'fill_in' | 'later';

export interface MatrixPoint {
  id: string;
  /** 0..3: zero cost 0..1, low cost 1..2, investment 2..3 */
  x: number;
  /** 0..1, square-root scaled AZN per month */
  y: number;
  aznPerMonth: number;
  quadrant: Quadrant;
  status: RecommendationStatus;
}

export interface PriorityMatrix {
  points: MatrixPoint[];
  /** effort split (zero and low cost are low effort) */
  xSplit: number;
  /** impact split on the y scale (median saving) */
  ySplit: number;
  splitAzn: number;
  maxAzn: number;
  /** pending quick wins: count and combined monthly saving (simple sum) */
  quickWins: { count: number; azn: number };
}

const EFFORT_BASE: Record<Effort, number> = { zero: 0, low: 1, invest: 2 };
const RISK_OFFSET = { none: 0.3, low: 0.5, medium: 0.72 } as const;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function priorityMatrix(vms: RecommendationVM[]): PriorityMatrix {
  const maxAzn = Math.max(1, ...vms.map((v) => v.aznPerMonth));
  const splitAzn = median(vms.map((v) => v.aznPerMonth));
  const scale = (azn: number) => Math.sqrt(Math.max(0, azn) / maxAzn);
  const xSplit = 2;
  const ySplit = scale(splitAzn);
  // spread points that share effort + risk so they do not overlap
  const seen = new Map<string, number>();
  const points = vms.map((v) => {
    const key = `${v.effort}:${v.riskLevel}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const x = EFFORT_BASE[v.effort] + RISK_OFFSET[v.riskLevel] + ((n % 3) - 1) * 0.08;
    const y = scale(v.aznPerMonth);
    const high = v.aznPerMonth >= splitAzn;
    const easy = x < xSplit;
    const quadrant: Quadrant = high
      ? easy
        ? 'quick_win'
        : 'strategic'
      : easy
        ? 'fill_in'
        : 'later';
    return { id: v.id, x, y, aznPerMonth: v.aznPerMonth, quadrant, status: v.status };
  });
  const qw = points.filter((p) => p.quadrant === 'quick_win' && p.status === 'proposed');
  return {
    points,
    xSplit,
    ySplit,
    splitAzn,
    maxAzn,
    quickWins: { count: qw.length, azn: qw.reduce((s, p) => s + p.aznPerMonth, 0) },
  };
}

// ---------------------------------------------------------------------------
// Validation of human decisions

export type RejectError = 'reason_required' | 'note_required';

/** A reject needs a reason; "other" also needs a short note. */
export function validateReject(
  reason: RejectReason | null | undefined,
  note = '',
): RejectError | null {
  if (!reason) return 'reason_required';
  if (reason === 'other' && note.trim().length < 3) return 'note_required';
  return null;
}

export type ScheduleError = 'date_required' | 'date_past';

/** Scheduled date must be today or later (plant-local day). */
export function validateSchedule(
  dateMs: number | null | undefined,
  nowMs: number,
): ScheduleError | null {
  if (dateMs === null || dateMs === undefined || !Number.isFinite(dateMs)) return 'date_required';
  const n = new Date(nowMs);
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return dateMs < today ? 'date_past' : null;
}

// ---------------------------------------------------------------------------
// Evidence range for the "Niyə?" chart

/**
 * Night and start-up measures are shown hourly over the last 3 complete days
 * (the pattern is visible hour by hour); others daily over their window.
 */
export function evidenceRange(
  core: AnalysisCore,
  rec: Pick<RecommendationVM, 'mask' | 'windowDays'>,
): ResolvedRange {
  const hourly = rec.mask === 'nonprod' || rec.mask === 'startup';
  const days = hourly ? 3 : Math.max(7, Math.min(28, rec.windowDays));
  const toDay = Math.max(1, core.todayDay);
  const fromDay = Math.max(0, toDay - days);
  return {
    preset: 'custom',
    fromDay,
    toDay,
    from: core.ds.days[fromDay].start,
    to: core.ds.days[toDay - 1].start + DAY_MS,
    resolution: hourly ? 'hour' : 'day',
  };
}
