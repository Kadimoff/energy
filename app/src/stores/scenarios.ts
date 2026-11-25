import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScenarioInput } from '../domain/scenario';
import { jsonStorage, STORAGE_PREFIX } from './storage';

export interface SavedScenario {
  id: string;
  name: string;
  input: ScenarioInput;
  createdAt: number;
}

export interface ScenarioStore {
  saved: SavedScenario[];
  save: (name: string, input: ScenarioInput) => SavedScenario;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

export const useScenarioStore = create<ScenarioStore>()(
  persist(
    (set) => ({
      saved: [],
      save: (name, input) => {
        const s: SavedScenario = {
          id: `sc-${Date.now().toString(36)}`,
          name,
          input,
          createdAt: Date.now(),
        };
        set((st) => ({ saved: [...st.saved, s] }));
        return s;
      },
      remove: (id) => set((st) => ({ saved: st.saved.filter((x) => x.id !== id) })),
      rename: (id, name) =>
        set((st) => ({ saved: st.saved.map((x) => (x.id === id ? { ...x, name } : x)) })),
    }),
    { name: `${STORAGE_PREFIX}scenarios`, storage: jsonStorage },
  ),
);
