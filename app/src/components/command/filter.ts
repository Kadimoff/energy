import { normalizeText } from '@/services/CopilotService';

/**
 * Command palette filter: diacritic-insensitive substring match on the item
 * keywords (label, code, names). Word starts rank above inner matches; the
 * cmdk value is only an id and is not searched.
 */
export function paletteFilter(_value: string, search: string, keywords?: string[]): number {
  const q = normalizeText(search);
  if (!q) return 1;
  const hay = ` ${normalizeText((keywords ?? []).join(' '))}`;
  if (hay.includes(` ${q}`)) return 1;
  return hay.includes(q) ? 0.5 : 0;
}
