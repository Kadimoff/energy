import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnomalyStatus } from '../data/types';
import { dataSource } from '../data/sources';
import { jsonStorage, STORAGE_PREFIX } from './storage';

export interface AnomalyComment {
  id: string;
  text: string;
  author: string;
  at: number;
}

export interface AnomalyStore {
  status: Record<string, AnomalyStatus>;
  assignee: Record<string, string>;
  comments: Record<string, AnomalyComment[]>;
  setStatus: (id: string, status: AnomalyStatus) => void;
  assign: (id: string, user: string) => void;
  addComment: (id: string, text: string, author: string) => void;
}

export const useAnomalyStore = create<AnomalyStore>()(
  persist(
    (set) => ({
      status: {},
      assignee: {},
      comments: {},
      setStatus: (id, status) => {
        set((s) => ({ status: { ...s.status, [id]: status } }));
        void dataSource.updateAnomalyStatus(id, status).catch(() => undefined);
      },
      assign: (id, user) => set((s) => ({ assignee: { ...s.assignee, [id]: user } })),
      addComment: (id, text, author) =>
        set((s) => ({
          comments: {
            ...s.comments,
            [id]: [
              ...(s.comments[id] ?? []),
              { id: `${id}:${Date.now()}`, text, author, at: Date.now() },
            ],
          },
        })),
    }),
    { name: `${STORAGE_PREFIX}anomalies`, storage: jsonStorage },
  ),
);
