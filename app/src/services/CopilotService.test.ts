import { baseConfig } from '@/data/config';
import type { RecommendationState } from '@/data/types';
import {
  anomalyVMs,
  carbonByMonth,
  equipmentRows,
  monthOverview,
  recommendationSummary,
  recommendationVMs,
  wasteByGroup,
} from '@/domain/viewmodels';
import { formatAzn } from '@/lib/format';
import { fixture, rates } from '@/test/fixture';
import { paletteFilter } from '@/components/command/filter';
import {
  findEquipment,
  intentScores,
  matchIntent,
  normalizeText,
  type CopilotContext,
} from './CopilotService';
import { LocalCopilotService } from './LocalCopilotService';

const a = fixture();
const states: Record<string, RecommendationState> = Object.fromEntries(
  a.engine.recommendations.map((r) => [r.id, { status: 'proposed' as const, updatedAt: 0 }]),
);
const items = recommendationVMs(a.engine.recommendations, states, rates, a.ds.equipment);
const anomalies = anomalyVMs(a.anomalies, {}, rates, a.ds.equipment);
const ctx: CopilotContext = {
  lang: 'az',
  analysis: a,
  rates,
  overview: monthOverview(a, rates, states),
  recommendations: items,
  summary: recommendationSummary(a, items, rates),
  anomalies,
  equipmentRows: equipmentRows(a, anomalies),
  wasteGroups: wasteByGroup(a, rates, baseConfig),
  carbonMonths: carbonByMonth(a, rates),
};
const svc = new LocalCopilotService();
const eq = a.ds.equipment;

describe('copilot intent matching', () => {
  it('normalizes Azerbaijani letters and CO₂', () => {
    expect(normalizeText('Dünən GECƏ İşıqlar, CO₂?')).toBe('dunen gece isiqlar co2');
    expect(normalizeText('Çiller-1 ŞƏNBƏ')).toBe('ciller-1 senbe');
  });

  it('maps every preset question to its intent', () => {
    for (const p of svc.presets('az')) expect(matchIntent(p.question, eq).intent).toBe(p.intent);
    for (const p of svc.presets('en')) expect(matchIntent(p.question, eq).intent).toBe(p.intent);
  });

  it('understands free text without diacritics and synonyms', () => {
    expect(matchIntent('niye budceni asiriq', eq).intent).toBe('budget');
    expect(matchIntent('Ay sonu xərc nə qədər olacaq?', eq).intent).toBe('budget');
    expect(matchIntent('harada itki var, en cox israf', eq).intent).toBe('top_waste');
    expect(matchIntent('karbon emissiyası hədəfi', eq).intent).toBe('co2_target');
    expect(matchIntent('what happened overnight', eq).intent).toBe('last_night');
    expect(matchIntent('Neçə açıq anomaliya var?', eq).intent).toBe('anomalies');
    expect(matchIntent('Nə qədər qənaət etdik?', eq).intent).toBe('savings');
    expect(matchIntent('EnPI necədir?', eq).intent).toBe('enpi');
    expect(matchIntent('Hansı tövsiyələri tətbiq edək?', eq).intent).toBe('recommendations');
    expect(intentScores('büdcə').budget).toBe(3);
  });

  it('detects equipment codes with or without dash and diacritics', () => {
    expect(matchIntent('K-2 niyə gecə işləyir?', eq)).toEqual({
      intent: 'equipment',
      equipmentId: 'comp-2',
    });
    expect(findEquipment('k2 haqqında', eq)?.id).toBe('comp-2');
    expect(findEquipment('ciller 1 bazar günü', eq)?.id).toBe('chiller-1');
    expect(findEquipment('İM-3 vəziyyəti', eq)?.id).toBe('im-3');
    // short letter-only codes are ignored to avoid false hits ("of")
    expect(findEquipment('state of the plant', eq)).toBeNull();
  });

  it('returns null for unknown questions', () => {
    expect(matchIntent('Sabah hava necə olacaq?', eq).intent).toBeNull();
    expect(matchIntent('', eq).intent).toBeNull();
  });
});

describe('local copilot answers', () => {
  it('budget answer uses the dashboard forecast and links a decision', async () => {
    const r = await svc.ask('Bu ay niyə büdcəni aşırıq?', ctx);
    expect(r.intent).toBe('budget');
    expect(r.paragraphs[0]).toContain(formatAzn(ctx.overview.electricity.costMean));
    expect(r.paragraphs[0]).toContain(formatAzn(ctx.overview.electricity.budgetAzn));
    expect(r.paragraphs.join(' ')).toContain(formatAzn(ctx.summary.potentialAznPerMonth));
    expect(r.references.some((x) => x.kind === 'spark')).toBe(true);
    expect(r.references.some((x) => x.kind === 'decision')).toBe(true);
    expect(r.suggestions).toHaveLength(3);
  });

  it('top waste answer names the equipment with the largest waste value', () => {
    const r = svc.answer('Ən çox israf edən avadanlıq hansıdır?', ctx);
    const eqRef = r.references.find((x) => x.kind === 'equipment');
    expect(eqRef).toBeDefined();
    expect(r.paragraphs[0]).toContain(eqRef && eqRef.kind === 'equipment' ? eqRef.name : '');
  });

  it('recommendations answer lists three decisions with Decision Center links', () => {
    const r = svc.answer('Gələn ay üçün 3 əsas tövsiyə', ctx);
    expect(r.references.filter((x) => x.kind === 'decision')).toHaveLength(3);
    expect(r.paragraphs).toHaveLength(4);
  });

  it('co2, last night, equipment, anomalies, savings and enpi answers', () => {
    for (const [q, intent] of [
      ['CO₂ hədəfinə çatmaq üçün nə etməliyik?', 'co2_target'],
      ['Dünən gecə nə baş verib?', 'last_night'],
      ['K-2 niyə gecə işləyir?', 'equipment'],
      ['Açıq anomaliyalar', 'anomalies'],
      ['Nə qədər qənaət etdik?', 'savings'],
      ['EnPI necədir?', 'enpi'],
    ] as const) {
      const r = svc.answer(q, ctx);
      expect(r.intent).toBe(intent);
      expect(r.paragraphs.length).toBeGreaterThan(0);
      expect(r.paragraphs.join(' ')).not.toMatch(/\{\w+\}/);
    }
    const night = svc.answer('Dünən gecə nə baş verib?', ctx);
    expect(night.references[0].kind).toBe('band');
    const k2 = svc.answer('K-2', ctx);
    expect(
      k2.references.some((x) => x.kind === 'decision' && x.recId === 'rec-comp-schedule'),
    ).toBe(true);
  });

  it('when nothing is pending the recommendations answer says so', () => {
    const none = {
      ...ctx,
      recommendations: items.map((v) => ({ ...v, status: 'approved' as const })),
    };
    const r = svc.answer('tövsiyə', none);
    expect(r.paragraphs[0]).toBe('Gözləyən təklif yoxdur. Bütün təkliflər üzrə qərar verilib.');
  });

  it('unknown question returns the fallback with suggestions', () => {
    const r = svc.answer('Sabah hava necə olacaq?', ctx);
    expect(r.intent).toBeNull();
    expect(r.paragraphs[0]).toBe('Bu sualı hələ cavablandıra bilmirəm. Bunları soruşa bilərsiniz:');
    expect(r.suggestions).toHaveLength(5);
  });

  it('answers in English when the context language is en', () => {
    const r = svc.answer('Why are we over budget this month?', { ...ctx, lang: 'en' });
    expect(r.paragraphs[0]).toMatch(/^Month-end cost forecast/);
  });
});

describe('command palette filter', () => {
  it('matches keywords without diacritics, ranks word starts higher', () => {
    expect(paletteFilter('eq:comp-2', 'k-2', ['k-2', 'k-2 kompressoru'])).toBe(1);
    expect(paletteFilter('page:carbon', 'karb', ['karbon'])).toBe(1);
    expect(paletteFilter('page:decisions', 'qerar', [normalizeText('AI Qərar Mərkəzi')])).toBe(1);
    expect(paletteFilter('page:carbon', 'arbo', ['karbon'])).toBe(0.5);
    expect(paletteFilter('page:carbon', 'k-2', ['karbon'])).toBe(0);
    expect(paletteFilter('x', '', [])).toBe(1);
  });
});
