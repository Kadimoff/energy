import {
  anomalyTitleParams,
  carbonSnapshot,
  openAnomalyCounts,
  topPending,
} from '../domain/insights';
import {
  anomaliesFor,
  co2Plan,
  dailyBandSeries,
  dailyWaste,
  equipmentWasteRanking,
  lastNightReport,
  recommendationsFor,
} from '../domain/copilotFacts';
import { combinedMonthlySaving } from '../domain/recommendations';
import { annualReductionT } from '../domain/carbon';
import { energyValue } from '../domain/cost';
import { translate, type Params } from '../i18n';
import {
  formatAzn,
  formatDayMonth,
  formatEnergy,
  formatEnpi,
  formatM3,
  formatPct,
  formatSigned,
  formatTCo2,
  formatTime,
} from '../lib/format';
import type { Lang } from '../stores/ui';
import {
  matchIntent,
  PRESET_INTENTS,
  type CopilotAnswer,
  type CopilotContext,
  type CopilotIntent,
  type CopilotReference,
  type CopilotService,
} from './CopilotService';

type Tr = (key: string, params?: Params) => string;

interface Composed {
  paragraphs: string[];
  references: CopilotReference[];
}

const amount = (v: number, energy: 'electricity' | 'gas') =>
  energy === 'gas' ? formatM3(v) : formatEnergy(v);

/** Template based copilot: keyword intents, answers computed from dashboard data. */
export class LocalCopilotService implements CopilotService {
  presets(lang: Lang) {
    return PRESET_INTENTS.map((intent) => ({
      intent,
      question: translate(lang, 'copilot', `presets.${intent}`),
    }));
  }

  async ask(question: string, ctx: CopilotContext): Promise<CopilotAnswer> {
    return this.answer(question, ctx);
  }

  /** Synchronous core (used by tests and by `ask`). */
  answer(question: string, ctx: CopilotContext): CopilotAnswer {
    const t: Tr = (k, p) => translate(ctx.lang, 'copilot', k, p);
    const c: Tr = (k, p) => translate(ctx.lang, 'common', k, p);
    const { intent, equipmentId } = matchIntent(question, ctx.analysis.ds.equipment);
    const presets = this.presets(ctx.lang);
    if (!intent) {
      return {
        question,
        intent: null,
        paragraphs: [t('fallback.text')],
        references: [],
        suggestions: presets.map((p) => p.question),
      };
    }
    const composed = this.compose(intent, ctx, t, c, equipmentId);
    return {
      question,
      intent,
      ...composed,
      suggestions: presets
        .filter((p) => p.intent !== intent)
        .slice(0, 3)
        .map((p) => p.question),
    };
  }

  private compose(
    intent: CopilotIntent,
    ctx: CopilotContext,
    t: Tr,
    c: Tr,
    equipmentId: string | null,
  ): Composed {
    switch (intent) {
      case 'budget':
        return budget(ctx, t, c);
      case 'top_waste':
        return topWaste(ctx, t, c);
      case 'recommendations':
        return recommendations(ctx, t, c);
      case 'co2_target':
        return co2(ctx, t, c);
      case 'last_night':
        return lastNight(ctx, t, c);
      case 'equipment':
        return equipment(ctx, t, c, equipmentId!);
      case 'anomalies':
        return anomalies(ctx, t, c);
      case 'savings':
        return savings(ctx, t);
      case 'enpi':
        return enpi(ctx, t);
    }
  }
}

export const copilotService: CopilotService = new LocalCopilotService();

// ---------------------------------------------------------------------------

function decisionRef(v: CopilotContext['recommendations'][number], c: Tr, t: Tr): CopilotReference {
  return {
    kind: 'decision',
    recId: v.id,
    title: c(`rec.title.${v.id}`),
    detail: t('ref.decisionDetail', {
      azn: formatAzn(v.aznPerMonth),
      co2: formatTCo2(v.tCo2PerYear),
      effort: c(`effort.${v.effort}`),
    }),
  };
}

function budget(ctx: CopilotContext, t: Tr, c: Tr): Composed {
  const e = ctx.overview.electricity;
  const p = Math.round(Math.min(99, Math.max(1, e.overrunProbability * 100)));
  const paragraphs = [
    e.overrunAzn > 0
      ? t('answers.budget.over', {
          forecast: formatAzn(e.costMean),
          budget: formatAzn(e.budgetAzn),
          overrun: formatAzn(e.overrunAzn),
          prob: formatPct(p),
        })
      : t('answers.budget.within', {
          forecast: formatAzn(e.costMean),
          budget: formatAzn(e.budgetAzn),
          reserve: formatAzn(-e.overrunAzn),
          prob: formatPct(p),
        }),
  ];
  const groups = ctx.wasteGroups.filter((g) => g.wasteAzn > 0).slice(0, 3);
  if (groups.length) {
    paragraphs.push(
      t('answers.budget.drivers', {
        waste: formatAzn(ctx.overview.waste.value),
        list: groups.map((g) => `${c(`group.${g.group}`)} ${formatAzn(g.wasteAzn)}`).join(', '),
      }),
    );
  }
  const pending = topPending(ctx.recommendations, 3);
  if (ctx.summary.pendingCount > 0) {
    paragraphs.push(
      t('answers.budget.potential', {
        count: ctx.summary.pendingCount,
        azn: formatAzn(ctx.summary.potentialAznPerMonth),
      }),
    );
  }
  return {
    paragraphs,
    references: [
      {
        kind: 'spark',
        title: t('answers.budget.chart'),
        values: ctx.overview.costAzn.spark,
        reference: e.budgetAzn,
        caption: t('ref.budgetLine', { budget: formatAzn(e.budgetAzn) }),
        tone: e.overrunAzn > 0 ? 'danger' : 'success',
      },
      ...pending.slice(0, 1).map((v) => decisionRef(v, c, t)),
      { kind: 'page', to: '/forecast', label: t('ref.openForecast') },
    ],
  };
}

function topWaste(ctx: CopilotContext, t: Tr, c: Tr): Composed {
  const ranked = equipmentWasteRanking(ctx.equipmentRows, ctx.rates);
  const top = ranked[0];
  if (!top) return { paragraphs: [t('answers.topWaste.none')], references: [] };
  const eq = top.equipment;
  const paragraphs = [
    t('answers.topWaste.main', {
      name: eq.name,
      waste: amount(top.wasteAmount, eq.energy),
      azn: formatAzn(top.wasteAzn),
      pct: formatPct(top.wastePct, 1),
    }),
  ];
  const an = anomaliesFor(ctx.anomalies, eq.id);
  if (an.length) {
    paragraphs.push(
      t('answers.topWaste.cause', {
        rule: c(`rule.${an[0].rule}`).toLocaleLowerCase('az'),
        count: an.length,
      }),
    );
  }
  const next = ranked.slice(1, 4);
  if (next.length) {
    paragraphs.push(
      t('answers.topWaste.next', {
        list: next.map((r) => `${r.equipment.code} ${formatAzn(r.wasteAzn)}`).join(', '),
      }),
    );
  }
  const rec = recommendationsFor(ctx.recommendations, eq.id).find((v) => v.status === 'proposed');
  return {
    paragraphs,
    references: [
      {
        kind: 'spark',
        title: t('answers.topWaste.chart', { code: eq.code }),
        values: dailyWaste(ctx.analysis, [eq.id], 30),
        caption: t('ref.last30'),
        tone: 'warning',
      },
      {
        kind: 'equipment',
        id: eq.id,
        code: eq.code,
        name: eq.name,
        detail: t('ref.equipmentDetail', { pct: formatPct(top.wastePct, 1) }),
      },
      ...(rec ? [decisionRef(rec, c, t)] : []),
    ],
  };
}

function recommendations(ctx: CopilotContext, t: Tr, c: Tr): Composed {
  const top = topPending(ctx.recommendations, 3);
  if (!top.length) {
    return {
      paragraphs: [t('answers.recommendations.none')],
      references: [{ kind: 'page', to: '/decisions', label: t('ref.openDecisions') }],
    };
  }
  const s = combinedMonthlySaving(
    ctx.analysis.ds,
    ctx.analysis.engine,
    top.map((v) => v.id),
  );
  return {
    paragraphs: [
      t('answers.recommendations.main', {
        count: top.length,
        azn: formatAzn(energyValue(s.kwh, s.m3, ctx.rates)),
        co2: formatTCo2(annualReductionT(s.kwh, s.m3, ctx.rates)),
      }),
      ...top.map((v, i) =>
        t('answers.recommendations.item', {
          n: i + 1,
          title: c(`rec.title.${v.id}`),
          azn: formatAzn(v.aznPerMonth),
          effort: c(`effort.${v.effort}`).toLocaleLowerCase('az'),
        }),
      ),
    ],
    references: top.map((v) => decisionRef(v, c, t)),
  };
}

function co2(ctx: CopilotContext, t: Tr, c: Tr): Composed {
  const snap = carbonSnapshot(
    ctx.carbonMonths,
    ctx.overview,
    ctx.rates,
    ctx.analysis.ds.timeline.nowMs,
  );
  const plan = co2Plan(snap, ctx.recommendations);
  const paragraphs = [
    t('answers.co2.main', {
      rolling: formatTCo2(plan.rolling12T, 0),
      target: formatTCo2(plan.targetT, 0),
      year: snap.year,
      projected: formatTCo2(snap.projectedYearT, 0),
    }),
    plan.gapT > 0
      ? t(plan.enough ? 'answers.co2.gapCovered' : 'answers.co2.gapOpen', {
          gap: formatTCo2(plan.gapT, 0),
          pending: formatTCo2(plan.pendingT, 0),
          rest: formatTCo2(Math.max(0, plan.gapT - plan.pendingT), 0),
        })
      : t('answers.co2.noGap', { pending: formatTCo2(plan.pendingT, 0) }),
  ];
  const top = plan.pending.slice(0, 3);
  if (top.length) {
    paragraphs.push(
      t('answers.co2.top', {
        list: top.map((v) => `${c(`rec.title.${v.id}`)} (${formatTCo2(v.tCo2PerYear)})`).join('; '),
      }),
    );
  }
  return {
    paragraphs,
    references: [
      {
        kind: 'spark',
        title: t('answers.co2.chart'),
        values: ctx.carbonMonths
          .filter((m) => m.complete)
          .slice(-12)
          .map((m) => m.totalT),
        reference: snap.annualTargetT / 12,
        caption: t('ref.monthlyTarget', { target: formatTCo2(snap.annualTargetT / 12, 0) }),
        tone: plan.gapT > 0 ? 'warning' : 'success',
      },
      ...top.slice(0, 1).map((v) => decisionRef(v, c, t)),
      { kind: 'page', to: '/carbon', label: t('ref.openCarbon') },
    ],
  };
}

function lastNight(ctx: CopilotContext, t: Tr, c: Tr): Composed {
  const r = lastNightReport(ctx.analysis, ctx.rates, ctx.anomalies);
  const paragraphs = [
    t('answers.lastNight.main', {
      from: `${formatDayMonth(r.from)} ${formatTime(r.from)}`,
      to: `${formatDayMonth(r.to)} ${formatTime(r.to)}`,
      actual: formatEnergy(r.actualKwh),
      upper: formatEnergy(r.expectedUpperKwh),
    }),
  ];
  if (r.top.length) {
    paragraphs.push(
      t('answers.lastNight.waste', {
        azn: formatAzn(r.wasteAzn),
        list: r.top
          .slice(0, 3)
          .map((x) => `${x.code} ${formatAzn(x.wasteAzn)}`)
          .join(', '),
      }),
    );
  } else paragraphs.push(t('answers.lastNight.clean'));
  if (r.anomalies.length) {
    paragraphs.push(
      t('answers.lastNight.anomalies', {
        count: r.anomalies.length,
        list: r.anomalies
          .slice(0, 3)
          .map((a) => c(`anomaly.title.${a.rule}`, anomalyTitleParams(a)))
          .join('; '),
      }),
    );
  }
  const first = r.top[0];
  const eq = first ? ctx.analysis.ds.equipment.find((e) => e.id === first.id) : undefined;
  return {
    paragraphs,
    references: [
      {
        kind: 'band',
        title: t('answers.lastNight.chart'),
        points: r.points,
        unit: 'kWh',
        resolution: 'hour',
      },
      ...(eq && first
        ? [
            {
              kind: 'equipment' as const,
              id: eq.id,
              code: eq.code,
              name: eq.name,
              detail: t('ref.nightWaste', { azn: formatAzn(first.wasteAzn) }),
            },
          ]
        : []),
      { kind: 'page', to: '/anomalies', label: t('ref.openAnomalies') },
    ],
  };
}

function equipment(ctx: CopilotContext, t: Tr, c: Tr, id: string): Composed {
  const row = ctx.equipmentRows.find((r) => r.equipment.id === id)!;
  const eq = row.equipment;
  const azn =
    eq.energy === 'gas'
      ? energyValue(0, row.monthWaste, ctx.rates)
      : energyValue(row.monthWaste, 0, ctx.rates);
  const an = anomaliesFor(ctx.anomalies, id);
  const recs = recommendationsFor(ctx.recommendations, id);
  const paragraphs = [
    t('answers.equipment.main', {
      name: eq.name,
      actual: amount(row.monthActual, eq.energy),
      waste: amount(row.monthWaste, eq.energy),
      pct: formatPct(row.wastePct, 1),
      azn: formatAzn(azn),
    }),
    an.length
      ? t('answers.equipment.anomalies', {
          count: an.length,
          list: an
            .slice(0, 2)
            .map((a) => c(`anomaly.title.${a.rule}`, anomalyTitleParams(a)))
            .join('; '),
        })
      : t('answers.equipment.noAnomalies'),
  ];
  if (recs[0]) {
    paragraphs.push(
      t('answers.equipment.rec', {
        title: c(`rec.title.${recs[0].id}`),
        azn: formatAzn(recs[0].aznPerMonth),
        status: c(`recStatus.${recs[0].status}`).toLocaleLowerCase('az'),
      }),
    );
  }
  return {
    paragraphs,
    references: [
      {
        kind: 'band',
        title: t('answers.equipment.chart', { code: eq.code }),
        points: dailyBandSeries(ctx.analysis, [id], 14),
        unit: eq.energy === 'gas' ? 'm3' : 'kWh',
        resolution: 'day',
      },
      {
        kind: 'equipment',
        id: eq.id,
        code: eq.code,
        name: eq.name,
        detail: t('ref.equipmentDetail', { pct: formatPct(row.wastePct, 1) }),
      },
      ...recs.slice(0, 1).map((v) => decisionRef(v, c, t)),
    ],
  };
}

function anomalies(ctx: CopilotContext, t: Tr, c: Tr): Composed {
  const n = openAnomalyCounts(ctx.anomalies);
  const latest = [...ctx.anomalies]
    .filter((a) => a.status === 'open' || a.status === 'investigating')
    .sort((a, b) => b.end - a.end)[0];
  const paragraphs = [
    t('answers.anomalies.main', {
      total: n.total,
      critical: n.critical,
      high: n.high,
      azn: formatAzn(n.lossAzn),
    }),
  ];
  if (latest) {
    paragraphs.push(
      t('answers.anomalies.latest', {
        title: c(`anomaly.title.${latest.rule}`, anomalyTitleParams(latest)),
        time: `${formatDayMonth(latest.end)} ${formatTime(latest.end)}`,
      }),
    );
  }
  return {
    paragraphs,
    references: [{ kind: 'page', to: '/anomalies', label: t('ref.openAnomalies') }],
  };
}

function savings(ctx: CopilotContext, t: Tr): Composed {
  const ms = ctx.analysis.measures;
  const kwh = ms.reduce((s, m) => s + m.avoidedKwh, 0);
  const perMonth = ms.reduce((s, m) => s + m.avoidedPerMonthKwh, 0);
  const count = (st: string) => ms.filter((m) => m.status === st).length;
  const accepted = ctx.recommendations.filter(
    (v) => v.status !== 'proposed' && v.status !== 'rejected',
  );
  return {
    paragraphs: [
      t('answers.savings.main', {
        count: ms.length,
        kwh: formatEnergy(kwh),
        azn: formatAzn(energyValue(kwh, 0, ctx.rates)),
        perMonth: formatAzn(energyValue(perMonth, 0, ctx.rates)),
      }),
      t('answers.savings.status', {
        verified: count('verified'),
        below: count('below_expected'),
        measuring: count('measuring'),
      }),
      t('answers.savings.accepted', {
        count: accepted.length,
        azn: formatAzn(ctx.summary.acceptedAznPerMonth),
      }),
    ],
    references: [{ kind: 'page', to: '/mv', label: t('ref.openMv') }],
  };
}

function enpi(ctx: CopilotContext, t: Tr): Composed {
  const e = ctx.overview.enpi;
  return {
    paragraphs: [
      t('answers.enpi.main', {
        value: formatEnpi(e.value),
        previous: formatEnpi(e.previous),
        delta: formatSigned(e.deltaPct, (v) => formatPct(v, 1)),
        target: formatEnpi(e.targetKwhPerT),
      }),
    ],
    references: [
      {
        kind: 'spark',
        title: t('answers.enpi.chart'),
        values: e.spark,
        reference: e.targetKwhPerT,
        caption: t('ref.enpiTarget', { target: formatEnpi(e.targetKwhPerT) }),
        tone: e.value > e.targetKwhPerT ? 'warning' : 'success',
      },
    ],
  };
}
