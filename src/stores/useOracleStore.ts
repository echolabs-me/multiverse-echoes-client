import { create } from 'zustand';
import type { OracleContext, OracleDeepLink } from '../types/api.ts';
import { oracle } from '../lib/api/endpoints.ts';

export interface OracleMessage {
  id: string;
  role: 'user' | 'oracle';
  text: string;
  deep_links?: OracleDeepLink[];
  timestamp: number;
}

interface OracleState {
  isOpen: boolean;
  messages: OracleMessage[];
  isLoading: boolean;
  error: string | null;
  context: OracleContext;

  toggle: () => void;
  open: () => void;
  close: () => void;
  setContext: (ctx: OracleContext) => void;
  ask: (question: string) => Promise<void>;
  clearHistory: () => void;
}

let nextId = 0;
function genId(): string {
  nextId += 1;
  return `oracle-msg-${String(nextId)}`;
}

export const useOracleStore = create<OracleState>((set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  error: null,
  context: {},

  toggle: () => set({ isOpen: !get().isOpen }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setContext: (ctx) => set({ context: ctx }),

  ask: async (question) => {
    const userMsg: OracleMessage = {
      id: genId(),
      role: 'user',
      text: question,
      timestamp: Date.now(),
    };
    set({ messages: [...get().messages, userMsg], isLoading: true, error: null });

    try {
      const response = await oracle.ask({
        question,
        context: get().context,
      });
      const oracleMsg: OracleMessage = {
        id: genId(),
        role: 'oracle',
        text: response.answer,
        deep_links: response.deep_links,
        timestamp: Date.now(),
      };
      set({ messages: [...get().messages, oracleMsg], isLoading: false });
    } catch {
      set({ error: 'oracle.error', isLoading: false });
    }
  },

  clearHistory: () => set({ messages: [], error: null }),
}));
