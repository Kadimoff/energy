import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingsOverrides } from '../data/config';
import { jsonStorage, STORAGE_PREFIX } from './storage';

/**
 * User edits from the Settings page (tariffs, budgets, factors, targets).
 * Everything that calculates money or CO₂ reads `useRates()` which merges
 * these overrides on top of src/data/config.
 */
export interface SettingsState {
  overrides: SettingsOverrides;
  setOverride: <K extends keyof SettingsOverrides>(key: K, value: SettingsOverrides[K]) => void;
  setOverrides: (patch: SettingsOverrides) => void;
  reset: (key?: keyof SettingsOverrides) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (key, value) => set((s) => ({ overrides: { ...s.overrides, [key]: value } })),
      setOverrides: (patch) => set((s) => ({ overrides: { ...s.overrides, ...patch } })),
      reset: (key) =>
        set((s) => {
          if (!key) return { overrides: {} };
          const next = { ...s.overrides };
          delete next[key];
          return { overrides: next };
        }),
    }),
    { name: `${STORAGE_PREFIX}settings`, storage: jsonStorage },
  ),
);
