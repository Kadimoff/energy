import { create } from 'zustand';
import type { CopilotAnswer } from '@/services/CopilotService';

export type ChatMsg =
  { id: number; role: 'user'; text: string } | { id: number; role: 'ai'; answer: CopilotAnswer };

/** Conversation kept for the session, so closing the panel does not lose it. */
export const useCopilotChat = create<{
  messages: ChatMsg[];
  add: (m: ChatMsg) => void;
  clear: () => void;
}>()((set) => ({
  messages: [],
  add: (m) => set((s) => ({ messages: [...s.messages, m] })),
  clear: () => set({ messages: [] }),
}));
