import { useCallback } from 'react';
import { useUiStore, type Lang } from '../stores/ui';
import azAnomalies from './az/anomalies.json';
import azCarbon from './az/carbon.json';
import azCommon from './az/common.json';
import azCopilot from './az/copilot.json';
import azDecisions from './az/decisions.json';
import azEquipment from './az/equipment.json';
import azForecast from './az/forecast.json';
import azLayout from './az/layout.json';
import azLive from './az/live.json';
import azMv from './az/mv.json';
import azOverview from './az/overview.json';
import azReports from './az/reports.json';
import azSettings from './az/settings.json';
import enAnomalies from './en/anomalies.json';
import enCarbon from './en/carbon.json';
import enCommon from './en/common.json';
import enCopilot from './en/copilot.json';
import enDecisions from './en/decisions.json';
import enEquipment from './en/equipment.json';
import enForecast from './en/forecast.json';
import enLayout from './en/layout.json';
import enLive from './en/live.json';
import enMv from './en/mv.json';
import enOverview from './en/overview.json';
import enReports from './en/reports.json';
import enSettings from './en/settings.json';

/**
 * Tiny typed i18n. One JSON file per area and language (src/i18n/<lang>/<ns>.json)
 * so page agents never edit the same file. Azerbaijani is the default and the
 * source of key types; English falls back to Azerbaijani for missing keys.
 *
 *   const { t } = useT('overview');
 *   t('title')                      // own namespace
 *   t('common:actions.approve')     // any namespace
 *   t('common:states.staleBody', { minutes: 12, name: 'AHU-A' })
 *   tx(`common:rec.title.${id}`)    // dynamic (untyped) keys
 */

const az = {
  common: azCommon,
  layout: azLayout,
  overview: azOverview,
  live: azLive,
  equipment: azEquipment,
  decisions: azDecisions,
  anomalies: azAnomalies,
  forecast: azForecast,
  carbon: azCarbon,
  mv: azMv,
  reports: azReports,
  settings: azSettings,
  copilot: azCopilot,
};

type Resources = typeof az;
export type Namespace = keyof Resources;

const en: { [K in Namespace]: unknown } = {
  common: enCommon,
  layout: enLayout,
  overview: enOverview,
  live: enLive,
  equipment: enEquipment,
  decisions: enDecisions,
  anomalies: enAnomalies,
  forecast: enForecast,
  carbon: enCarbon,
  mv: enMv,
  reports: enReports,
  settings: enSettings,
  copilot: enCopilot,
};

const resources: Record<Lang, { [K in Namespace]: unknown }> = { az, en };

type Leaves<T, P extends string = ''> = T extends string
  ? P
  : T extends object
    ? { [K in keyof T & string]: Leaves<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string]
    : never;

export type TKey<NS extends Namespace> = Leaves<Resources[NS]>;
export type FullKey = { [N in Namespace]: `${N}:${TKey<N>}` }[Namespace];
export type Params = Record<string, string | number>;

function lookup(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Resolve "ns:key" or a key inside `defaultNs`. Returns the key itself when missing. */
export function translate(lang: Lang, defaultNs: Namespace, key: string, params?: Params): string {
  const i = key.indexOf(':');
  const ns = (i > 0 ? key.slice(0, i) : defaultNs) as Namespace;
  const path = i > 0 ? key.slice(i + 1) : key;
  const s = lookup(resources[lang][ns], path) ?? lookup(resources.az[ns], path);
  return s === undefined ? key : interpolate(s, params);
}

/** True when the key exists (in the current or default language). */
export function hasKey(lang: Lang, defaultNs: Namespace, key: string): boolean {
  const i = key.indexOf(':');
  const ns = (i > 0 ? key.slice(0, i) : defaultNs) as Namespace;
  const path = i > 0 ? key.slice(i + 1) : key;
  return (
    lookup(resources[lang][ns], path) !== undefined || lookup(resources.az[ns], path) !== undefined
  );
}

export function useT<NS extends Namespace = 'common'>(ns: NS = 'common' as NS) {
  const lang = useUiStore((s) => s.lang);
  const t = useCallback(
    (key: TKey<NS> | FullKey, params?: Params) => translate(lang, ns, key, params),
    [lang, ns],
  );
  /** untyped variant for data-driven keys */
  const tx = useCallback(
    (key: string, params?: Params) => translate(lang, ns, key, params),
    [lang, ns],
  );
  return { t, tx, lang };
}
