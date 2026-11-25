import { fixture, rates, FIXED_NOW } from '@/test/fixture';
import { baseConfig } from '@/data/config';
import type { RecommendationState } from '@/data/types';
import {
  anomalyVMs,
  carbonByMonth,
  equipmentRows,
  monthOverview,
  recommendationVMs,
  wasteByGroup,
} from './viewmodels';
import {
  anomalyTitleParams,
  budgetHero,
  carbonSnapshot,
  openAnomalyCounts,
  recentAnomalies,
  topPending,
  wasteBars,
} from './insights';
import {
  anomaliesFor,
  co2Plan,
  dailyBandSeries,
  dailyWaste,
  equipmentWasteRanking,
  lastNightReport,
  nightWindow,
  recommendationsFor,
} from './copilotFacts';
import {
  availableActions,
  columnOf,
  EMPTY_FILTERS,
  evidenceRange,
  filterDecisions,
  groupByColumn,
  impactLevel,
  nextStatus,
  priorityMatrix,
  validateReject,
  validateSchedule,
  activeFilterCount,
} from './decisions';

const a = fixture();
const proposedAll: Record<string, RecommendationState> = Object.fromEntries(
  a.engine.recommendations.map((r) => [r.id, { status: 'proposed' as const, updatedAt: 0 }]),
);
const vms = recommendationVMs(a.engine.recommendations, proposedAll, rates, a.ds.equipment);
const anomalies = anomalyVMs(a.anomalies, {}, rates, a.ds.equipment);

describe('budget hero', () => {
  it('reflects the electricity forecast and reacts to accepted recommendations', () => {
    const ov = monthOverview(a, rates, proposedAll);
    const h = budgetHero(ov, rates);
    expect(h.forecastAzn).toBeCloseTo(ov.electricity.costMean);
    expect(h.overrunAzn).toBeCloseTo(-h.reserveAzn);
    expect(h.probabilityPct).toBeGreaterThanOrEqual(1);
    expect(h.probabilityPct).toBeLessThanOrEqual(99);
    expect(h.acceptedEffectAzn).toBe(0);
    expect(['over', 'risk', 'within']).toContain(h.state);
    // approving everything lowers the month-end forecast (status flows into numbers)
    const approved = Object.fromEntries(
      Object.keys(proposedAll).map((id) => [id, { status: 'approved' as const, updatedAt: 0 }]),
    );
    const h2 = budgetHero(monthOverview(a, rates, approved), rates);
    expect(h2.forecastAzn).toBeLessThan(h.forecastAzn);
    expect(h2.acceptedEffectAzn).toBeGreaterThan(0);
  });

  it('classifies states by probability and sign', () => {
    const ov = monthOverview(a, rates, proposedAll);
    const mk = (p: number, overrun: number) =>
      budgetHero(
        { ...ov, electricity: { ...ov.electricity, overrunProbability: p, overrunAzn: overrun } },
        rates,
      );
    expect(mk(0.8, 100).state).toBe('over');
    expect(mk(0.3, -100).state).toBe('risk');
    expect(mk(0.05, -1000).state).toBe('within');
    expect(mk(0.999, 10).probabilityCapped).toBe(true);
  });
});

describe('overview lists and bars', () => {
  it('waste bars split each group into shares that add up to 1', () => {
    const bars = wasteBars(wasteByGroup(a, rates, baseConfig), rates);
    expect(bars.length).toBeGreaterThan(3);
    for (const b of bars) {
      expect(b.productiveShare + b.unrecoverableShare + b.recoverableShare).toBeCloseTo(1, 6);
      expect(b.recoverable).toBeLessThanOrEqual(b.waste + 1e-9);
    }
    expect(bars[0].wasteAzn).toBeGreaterThanOrEqual(bars[1].wasteAzn);
  });

  it('top pending and recent anomalies are ordered', () => {
    const top = topPending(vms, 3);
    expect(top).toHaveLength(3);
    expect(top[0].aznPerMonth).toBeGreaterThanOrEqual(top[2].aznPerMonth);
    const rec = recentAnomalies(anomalies, 5);
    expect(rec.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < rec.length; i++) expect(rec[i - 1].end).toBeGreaterThanOrEqual(rec[i].end);
    const counts = openAnomalyCounts(anomalies);
    expect(counts.total).toBe(anomalies.length);
    const p = anomalyTitleParams({ ...anomalies[0], equipmentNames: ['A', 'B', 'C', 'D'] });
    expect(p.equipment).toBe('A, B, C +1');
  });

  it('carbon snapshot sums Scope 1 and 2 for the year and projects the year end', () => {
    const months = carbonByMonth(a, rates);
    const ov = monthOverview(a, rates, proposedAll);
    const s = carbonSnapshot(months, ov, rates, FIXED_NOW);
    expect(s.year).toBe(2026);
    expect(s.ytdTotalT).toBeCloseTo(s.ytdScope1T + s.ytdScope2T);
    expect(s.elapsedShare).toBeGreaterThan(0.85);
    expect(s.projectedYearT).toBeGreaterThan(s.ytdTotalT);
    expect(s.onTrack).toBe(s.overTargetT === 0);
    expect(s.rolling12T).toBeGreaterThan(0);
  });
});

describe('copilot facts', () => {
  it('ranks equipment by waste value and builds series', () => {
    const rows = equipmentRows(a, a.anomalies);
    const r = equipmentWasteRanking(rows, rates);
    expect(r[0].wasteAzn).toBeGreaterThanOrEqual(r[1].wasteAzn);
    expect(dailyWaste(a, ['comp-2'], 30)).toHaveLength(30);
    const band = dailyBandSeries(a, ['comp-2'], 14);
    expect(band).toHaveLength(14);
    expect(band[0].upper).toBeGreaterThanOrEqual(band[0].lower);
  });

  it('last night covers 22:00 to 08:00 and finds the injected night waste', () => {
    const w = nightWindow(a);
    expect(w.to - w.from).toBe(10 * 3_600_000);
    expect(new Date(w.to).getHours()).toBe(8);
    const r = lastNightReport(a, rates, anomalies);
    expect(r.points.length).toBe(10);
    expect(r.wasteAzn).toBeGreaterThan(0);
    expect(r.top[0].wasteAzn).toBeGreaterThanOrEqual(r.top[r.top.length - 1].wasteAzn);
  });

  it('co2 plan compares the rolling year with the target', () => {
    const ov = monthOverview(a, rates, proposedAll);
    const s = carbonSnapshot(carbonByMonth(a, rates), ov, rates, FIXED_NOW);
    const p = co2Plan(s, vms);
    expect(p.pending).toHaveLength(vms.length);
    expect(p.pendingT).toBeGreaterThan(0);
    expect(p.enough).toBe(p.pendingT >= p.gapT);
    expect(co2Plan({ ...s, rolling12T: 0 }, vms).coverage).toBe(Number.POSITIVE_INFINITY);
    expect(recommendationsFor(vms, 'comp-2').length).toBeGreaterThan(0);
    expect(anomaliesFor(anomalies, 'comp-2').every((x) => x.equipmentIds.includes('comp-2'))).toBe(
      true,
    );
  });
});

describe('decision center logic', () => {
  it('status flow columns and manual steps', () => {
    expect(columnOf('scheduled')).toBe('approved');
    expect(columnOf('rejected')).toBe('rejected');
    expect(nextStatus('approved')).toBe('in_progress');
    expect(nextStatus('scheduled')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('measuring');
    expect(nextStatus('measuring')).toBeNull();
    expect(nextStatus('proposed')).toBeNull();
    expect(availableActions('proposed')).toMatchObject({
      approve: true,
      schedule: true,
      reject: true,
      reopen: false,
    });
    expect(availableActions('rejected')).toMatchObject({ approve: false, reopen: true });
    expect(availableActions('verified')).toMatchObject({ reject: false, advance: false });
    const g = groupByColumn([{ ...vms[0], status: 'scheduled' }, vms[1]]);
    expect(g.approved).toHaveLength(1);
    expect(g.proposed).toHaveLength(1);
  });

  it('filters by status, category, impact and effort', () => {
    expect(filterDecisions(vms, EMPTY_FILTERS)).toHaveLength(vms.length);
    expect(filterDecisions(vms, { ...EMPTY_FILTERS, status: 'rejected' })).toHaveLength(0);
    expect(filterDecisions(vms, { ...EMPTY_FILTERS, status: 'pending' })).toHaveLength(vms.length);
    expect(filterDecisions(vms, { ...EMPTY_FILTERS, status: 'active' })).toHaveLength(0);
    const zero = filterDecisions(vms, { ...EMPTY_FILTERS, effort: ['zero'] });
    expect(zero.every((v) => v.effort === 'zero')).toBe(true);
    const high = filterDecisions(vms, { ...EMPTY_FILTERS, impact: ['high'] });
    expect(high.every((v) => v.aznPerMonth >= 1000)).toBe(true);
    const cat = filterDecisions(vms, { ...EMPTY_FILTERS, categories: ['investment'] });
    expect(cat.every((v) => v.category === 'investment')).toBe(true);
    expect(
      activeFilterCount({ status: 'pending', categories: ['peak'], impact: [], effort: ['low'] }),
    ).toBe(3);
    expect(impactLevel(1200)).toBe('high');
    expect(impactLevel(500)).toBe('medium');
    expect(impactLevel(10)).toBe('low');
  });

  it('priority matrix marks quick wins (high impact, low effort)', () => {
    const m = priorityMatrix(vms);
    expect(m.points).toHaveLength(vms.length);
    for (const p of m.points) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
      const v = vms.find((x) => x.id === p.id)!;
      if (p.quadrant === 'quick_win') {
        expect(v.effort).not.toBe('invest');
        expect(v.aznPerMonth).toBeGreaterThanOrEqual(m.splitAzn);
      }
    }
    expect(m.quickWins.count).toBeGreaterThan(0);
    expect(m.points.find((p) => p.id === 'rec-comp-vsd')!.quadrant).not.toBe('quick_win');
  });

  it('validates reject reasons and schedule dates', () => {
    expect(validateReject(null)).toBe('reason_required');
    expect(validateReject('other', '')).toBe('note_required');
    expect(validateReject('other', 'Xətt təmirdədir')).toBeNull();
    expect(validateReject('production_risk')).toBeNull();
    expect(validateSchedule(null, FIXED_NOW)).toBe('date_required');
    expect(validateSchedule(FIXED_NOW - 3 * 86_400_000, FIXED_NOW)).toBe('date_past');
    expect(validateSchedule(new Date(2026, 10, 25).getTime(), FIXED_NOW)).toBeNull();
    expect(validateSchedule(FIXED_NOW + 86_400_000, FIXED_NOW)).toBeNull();
  });

  it('evidence range is hourly for night measures and daily otherwise', () => {
    const night = evidenceRange(a, { mask: 'nonprod', windowDays: 28 });
    expect(night.resolution).toBe('hour');
    expect(night.toDay - night.fromDay).toBe(3);
    const day = evidenceRange(a, { mask: 'prod', windowDays: 28 });
    expect(day.resolution).toBe('day');
    expect(day.toDay).toBe(a.todayDay);
  });
});
