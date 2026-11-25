import type { EffectiveRates } from '../data/config';
import type { Analysis } from '../domain/analysis';
import type { BandPoint } from '../domain/copilotFacts';
import type {
  AnomalyVM,
  CarbonMonth,
  EquipmentRow,
  GroupBreakdown,
  MonthOverview,
  RecommendationSummary,
  RecommendationVM,
} from '../domain/viewmodels';
import type { Lang } from '../stores/ui';

/**
 * AI Copilot service contract (spec 7.13). The first implementation
 * (LocalCopilotService) is template and keyword-intent based and computes
 * every number from the dashboard data. A real LLM (e.g. the Claude API) can
 * later implement the same interface: it receives the same context, can call
 * the same domain functions as tools, and must return the same answer shape
 * so the panel UI does not change. No external calls are made today.
 */

export type CopilotIntent =
  | 'budget'
  | 'top_waste'
  | 'recommendations'
  | 'co2_target'
  | 'last_night'
  | 'equipment'
  | 'anomalies'
  | 'savings'
  | 'enpi';

/** Preset questions shown as buttons (spec 7.13), in display order. */
export const PRESET_INTENTS: CopilotIntent[] = [
  'budget',
  'top_waste',
  'recommendations',
  'co2_target',
  'last_night',
];

export type CopilotReference =
  | {
      kind: 'band';
      title: string;
      points: BandPoint[];
      unit: 'kWh' | 'm3';
      resolution: 'hour' | 'day';
    }
  | {
      kind: 'spark';
      title: string;
      values: number[];
      reference?: number;
      caption: string;
      tone: 'violet' | 'warning' | 'danger' | 'success';
    }
  | { kind: 'equipment'; id: string; code: string; name: string; detail: string }
  | { kind: 'decision'; recId: string; title: string; detail: string }
  | { kind: 'page'; to: string; label: string; detail?: string };

export interface CopilotAnswer {
  question: string;
  /** null = question not understood (fallback text with suggestions) */
  intent: CopilotIntent | null;
  paragraphs: string[];
  references: CopilotReference[];
  /** follow-up questions */
  suggestions: string[];
}

/** Everything the copilot may use to answer: the same data the dashboard shows. */
export interface CopilotContext {
  lang: Lang;
  analysis: Analysis;
  rates: EffectiveRates;
  overview: MonthOverview;
  recommendations: RecommendationVM[];
  summary: RecommendationSummary;
  anomalies: AnomalyVM[];
  equipmentRows: EquipmentRow[];
  wasteGroups: GroupBreakdown[];
  carbonMonths: CarbonMonth[];
}

export interface CopilotService {
  /** Preset questions in the context language. */
  presets(lang: Lang): { intent: CopilotIntent; question: string }[];
  ask(question: string, ctx: CopilotContext): Promise<CopilotAnswer>;
}

// ---------------------------------------------------------------------------
// Keyword intent matching

/** Lower case, Azerbaijani letters folded to Latin (ə→e, ı→i, ş→s ...), CO₂ → co2. */
export function normalizeText(s: string): string {
  return s
    .toLocaleLowerCase('az')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/[“”"«»?!.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Keywords = [string, number][];

/** Stems (prefix match on words) or phrases (contain a space), with weights. */
export const INTENT_KEYWORDS: Record<Exclude<CopilotIntent, 'equipment'>, Keywords> = {
  budget: [
    ['budce', 3],
    ['budget', 3],
    ['asir', 2],
    ['asma', 2],
    ['asil', 2],
    ['xerc', 2],
    ['cost', 2],
    ['overrun', 3],
    ['hesab', 1],
    ['manat', 1],
    ['azn', 1],
    ['ay sonu', 2],
    ['month end', 2],
  ],
  top_waste: [
    ['israf', 3],
    ['waste', 3],
    ['itki', 2],
    ['loss', 2],
    ['en cox', 1],
    ['most', 1],
    ['avadanliq', 1],
    ['equipment', 1],
    ['hansi', 0.5],
    ['which', 0.5],
    ['worst', 2],
  ],
  recommendations: [
    ['tovsiy', 3],
    ['teklif', 2],
    ['recommend', 3],
    ['suggest', 2],
    ['gelen ay', 2],
    ['next month', 2],
    ['ne edek', 2],
    ['ne etmel', 1],
    ['qerar', 1],
    ['tedbir', 1],
  ],
  co2_target: [
    ['co2', 3],
    ['karbon', 3],
    ['carbon', 3],
    ['emiss', 3],
    ['scope', 2],
    ['cbam', 2],
    ['hedef', 1],
    ['target', 1],
  ],
  last_night: [
    ['dunen', 3],
    ['gece', 3],
    ['yesterday', 3],
    ['night', 3],
    ['overnight', 3],
    ['axsam', 1],
    ['bu seher', 2],
  ],
  anomalies: [
    ['anomal', 3],
    ['xeberdarliq', 2],
    ['alarm', 2],
    ['alert', 2],
    ['normadan', 2],
    ['problem', 1],
    ['unusual', 2],
  ],
  savings: [
    ['qenaet etdik', 4],
    ['ne qeder qenaet', 4],
    ['how much did we save', 4],
    ['saved', 3],
    ['savings', 2],
    ['m&v', 3],
    ['tesdiqlenmis qenaet', 3],
    ['qenaet', 1],
  ],
  enpi: [
    ['enpi', 3],
    ['semereli', 2],
    ['efficien', 2],
    ['kvt/ton', 3],
    ['per ton', 2],
    ['tona', 1],
  ],
};

const MIN_SCORE = 2;

export function intentScores(question: string): Record<string, number> {
  const text = normalizeText(question);
  const words = text.split(/[^a-z0-9&/-]+/).filter(Boolean);
  const out: Record<string, number> = {};
  for (const [intent, kws] of Object.entries(INTENT_KEYWORDS)) {
    let s = 0;
    for (const [kw, w] of kws) {
      const hit = kw.includes(' ') ? text.includes(kw) : words.some((x) => x.startsWith(kw));
      if (hit) s += w;
    }
    out[intent] = s;
  }
  return out;
}

/** Equipment mentioned by code ("K-2", "k2", "Çiller 1"); codes need a digit or 4+ letters. */
export function findEquipment<T extends { id: string; code: string }>(
  question: string,
  equipment: T[],
): T | null {
  const text = ` ${normalizeText(question)} `;
  for (const e of equipment) {
    const code = normalizeText(e.code);
    if (!/\d/.test(code) && code.replace(/-/g, '').length < 4) continue;
    const pattern = code
      .split('-')
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s-]?');
    if (new RegExp(`[^a-z0-9]${pattern}[^a-z0-9]`).test(text)) return e;
  }
  return null;
}

/** Best intent for a free-text question, or null when nothing scores high enough. */
export function matchIntent(
  question: string,
  equipment: { id: string; code: string }[] = [],
): { intent: CopilotIntent | null; equipmentId: string | null } {
  const eq = findEquipment(question, equipment);
  if (eq) return { intent: 'equipment', equipmentId: eq.id };
  const scores = intentScores(question);
  let best: CopilotIntent | null = null;
  let bestScore = 0;
  for (const [intent, s] of Object.entries(scores)) {
    if (s > bestScore) {
      best = intent as CopilotIntent;
      bestScore = s;
    }
  }
  return { intent: bestScore >= MIN_SCORE ? best : null, equipmentId: null };
}
