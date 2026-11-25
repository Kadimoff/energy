import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RecommendationState, RecommendationStatus, RejectReason } from '../data/types';
import { dataSource } from '../data/sources';
import { jsonStorage, STORAGE_PREFIX } from './storage';

/**
 * Human-in-the-loop decisions on AI recommendations. Changes are kept in
 * memory, persisted to localStorage (try/catch) and forwarded to the data
 * source. Effective states = data-source states overlaid with these.
 */
export interface RecommendationStore {
  overrides: Record<string, RecommendationState>;
  setStatus: (
    id: string,
    status: RecommendationStatus,
    extra?: Partial<RecommendationState>,
  ) => void;
  approve: (id: string) => void;
  schedule: (id: string, date: number) => void;
  reject: (id: string, reason: RejectReason, note?: string) => void;
  resetAll: () => void;
}

export const useRecommendationStore = create<RecommendationStore>()(
  persist(
    (set) => {
      const put = (id: string, state: RecommendationState) => {
        set((s) => ({ overrides: { ...s.overrides, [id]: state } }));
        void dataSource.updateRecommendationStatus(id, state).catch(() => undefined);
      };
      return {
        overrides: {},
        setStatus: (id, status, extra) => put(id, { status, updatedAt: Date.now(), ...extra }),
        approve: (id) => put(id, { status: 'approved', updatedAt: Date.now() }),
        schedule: (id, date) =>
          put(id, { status: 'scheduled', scheduledFor: date, updatedAt: Date.now() }),
        reject: (id, reason, note) =>
          put(id, {
            status: 'rejected',
            rejectReason: reason,
            rejectNote: note,
            updatedAt: Date.now(),
          }),
        resetAll: () => set({ overrides: {} }),
      };
    },
    { name: `${STORAGE_PREFIX}recommendations`, storage: jsonStorage },
  ),
);
