import { create } from 'zustand';
import type { RecommendationStatus } from '@/data/types';

/**
 * Last human decision, shown as a short notice with the before / after
 * month-end forecast (both values come from the forecast view model).
 */
export interface DecisionNoticeState {
  notice: { seq: number; recId: string; status: RecommendationStatus } | null;
  push: (recId: string, status: RecommendationStatus) => void;
  clear: () => void;
}

let seq = 0;

export const useDecisionNotice = create<DecisionNoticeState>()((set) => ({
  notice: null,
  push: (recId, status) => set({ notice: { seq: ++seq, recId, status } }),
  clear: () => set({ notice: null }),
}));
