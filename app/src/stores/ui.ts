import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage, STORAGE_PREFIX } from './storage';

export type Role = 'director' | 'energy_manager' | 'operator';
export type RangePreset = 'today' | '7d' | 'month' | 'quarter' | 'year' | 'custom';
export type Lang = 'az' | 'en';

export interface UiState {
  role: Role;
  rangePreset: RangePreset;
  /** custom range (ms), used when rangePreset = custom */
  customRange: { from: number; to: number } | null;
  plantId: string;
  lang: Lang;
  sidebarCollapsed: boolean;
  copilotOpen: boolean;
  /** optional prompt the copilot should answer when it opens */
  copilotPrompt: string | null;
  commandOpen: boolean;
  setRole: (r: Role) => void;
  setRange: (p: RangePreset, custom?: { from: number; to: number }) => void;
  setPlant: (id: string) => void;
  setLang: (l: Lang) => void;
  toggleSidebar: () => void;
  setCopilotOpen: (open: boolean, prompt?: string | null) => void;
  setCommandOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      role: 'director',
      rangePreset: 'month',
      customRange: null,
      plantId: 'plant-sumqayit-1',
      lang: 'az',
      sidebarCollapsed: false,
      copilotOpen: false,
      copilotPrompt: null,
      commandOpen: false,
      setRole: (role) => set({ role }),
      setRange: (rangePreset, custom) =>
        set((s) => ({
          rangePreset,
          customRange: custom ?? (rangePreset === 'custom' ? s.customRange : s.customRange),
        })),
      setPlant: (plantId) => set({ plantId }),
      setLang: (lang) => set({ lang }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCopilotOpen: (copilotOpen, prompt = null) => set({ copilotOpen, copilotPrompt: prompt }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: `${STORAGE_PREFIX}ui`,
      storage: jsonStorage,
      partialize: (s) => ({
        role: s.role,
        rangePreset: s.rangePreset,
        customRange: s.customRange,
        plantId: s.plantId,
        lang: s.lang,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    },
  ),
);
