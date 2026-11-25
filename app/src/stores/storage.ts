import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** localStorage wrapped in try/catch (private mode, quota, SSR). Falls back to memory. */
const memory = new Map<string, string>();

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? memory.get(name) ?? null;
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    memory.set(name, value);
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      /* storage unavailable: keep in memory for this session */
    }
  },
  removeItem: (name) => {
    memory.delete(name);
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const jsonStorage = createJSONStorage(() => safeStorage);

export const STORAGE_PREFIX = 'sie:';
