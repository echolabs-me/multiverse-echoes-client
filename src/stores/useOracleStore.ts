import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { OracleContext, OracleDeepLink, FeedbackType } from '../types/api.ts';
import { oracle, feedback } from '../lib/api/endpoints.ts';

export interface OracleMessage {
  id: string;
  role: 'user' | 'oracle';
  text: string;
  deep_links?: OracleDeepLink[];
  timestamp: number;
}

interface PendingFeedback {
  type: FeedbackType;
  summary: string;
  userMessage: string;
}

/** Parse [FEEDBACK_PENDING:Type:Summary] marker from Oracle response text. */
function parseFeedbackMarker(text: string): PendingFeedback | null {
  const match = text.match(/\[FEEDBACK_PENDING:(\w+):(.+?)\]/);
  if (!match) return null;
  const typeStr = match[1].toLowerCase();
  const feedbackType: FeedbackType =
    typeStr === 'bug' ? 'Bug'
    : typeStr === 'feature' ? 'FeatureRequest'
    : typeStr === 'frustration' ? 'Frustration'
    : typeStr === 'praise' ? 'Praise'
    : 'General';
  return { type: feedbackType, summary: match[2].trim(), userMessage: '' };
}

/** Check if a user message is confirming a pending feedback submission. */
function isConfirmation(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const patterns = ['yes', 'yep', 'yeah', 'correct', 'looks good', 'send it', 'submit', 'confirm', 'go ahead', 'do it'];
  return patterns.some((p) => lower === p || lower.startsWith(p));
}

interface OracleState {
  isOpen: boolean;
  messages: OracleMessage[];
  isLoading: boolean;
  error: string | null;
  context: OracleContext;
  pendingFeedback: PendingFeedback | null;

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

export const useOracleStore = create<OracleState>()(
  persist(
    (set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  error: null,
  context: {},
  pendingFeedback: null,

  toggle: () => set({ isOpen: !get().isOpen }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setContext: (ctx) => set({ context: ctx }),

  ask: async (question) => {
    const state = get();

    // If there's a pending feedback and the user confirms, auto-submit it.
    if (state.pendingFeedback && isConfirmation(question)) {
      const pf = state.pendingFeedback;
      const userMsg: OracleMessage = {
        id: genId(),
        role: 'user',
        text: question,
        timestamp: Date.now(),
      };
      set({ messages: [...get().messages, userMsg], isLoading: true, error: null });

      try {
        await feedback.submit({
          user_message: pf.userMessage,
          structured_summary: pf.summary,
          feedback_type: pf.type,
          context: { screen: state.context.screen ?? '', recent_events: [] },
        });
        const confirmMsg: OracleMessage = {
          id: genId(),
          role: 'oracle',
          text: `Your ${pf.type.toLowerCase()} feedback has been submitted. Thank you for helping us improve Multiverse Echoes.`,
          timestamp: Date.now(),
        };
        set({ messages: [...get().messages, confirmMsg], isLoading: false, pendingFeedback: null });
      } catch {
        const errorMsg: OracleMessage = {
          id: genId(),
          role: 'oracle',
          text: 'Something went wrong submitting your feedback. Please try again or email conduct@echolabs.me.',
          timestamp: Date.now(),
        };
        set({ messages: [...get().messages, errorMsg], isLoading: false, pendingFeedback: null });
      }
      return;
    }

    // Clear any stale pending feedback if user sent a non-confirmation message.
    if (state.pendingFeedback) {
      set({ pendingFeedback: null });
    }

    const userMsg: OracleMessage = {
      id: genId(),
      role: 'user',
      text: question,
      timestamp: Date.now(),
    };
    set({ messages: [...get().messages, userMsg], isLoading: true, error: null });

    try {
      let retries = 0;
      const maxRetries = 8;
      const deepThoughtThreshold = 6;
      const queuedText = 'The Oracle is busy guiding the multiverse right now. They\u2019ll be with you shortly.';
      const deepThoughtText = 'The Oracle is taking a while \u2014 they\u2019re deep in thought. Hang tight, they\u2019ll respond soon.';
      // Build conversation history from stored messages (last 20, excluding current).
      const history = get().messages.slice(-20).map((m) => ({
        role: m.role === 'user' ? 'user' : 'oracle',
        text: m.text,
      }));
      let response = await oracle.ask({
        question,
        context: get().context,
        history,
      });

      // Handle 202 queued response (Oracle returns __QUEUED__ marker).
      // 8 retries × 15s = 2 minutes. Show "deep in thought" after attempt 6
      // but keep retrying in the background.
      while (retries < maxRetries && response.answer === '__QUEUED__') {
        if (retries === 0) {
          const queuedMsg: OracleMessage = {
            id: genId(),
            role: 'oracle',
            text: queuedText,
            timestamp: Date.now(),
          };
          set({ messages: [...get().messages, queuedMsg], isLoading: true });
        }
        if (retries === deepThoughtThreshold) {
          const msgs = get().messages.filter((m) => m.text !== queuedText);
          const deepMsg: OracleMessage = {
            id: genId(),
            role: 'oracle',
            text: deepThoughtText,
            timestamp: Date.now(),
          };
          set({ messages: [...msgs, deepMsg], isLoading: true });
        }
        await new Promise((r) => setTimeout(r, 15_000));
        retries++;
        response = await oracle.ask({ question, context: get().context, history });
      }

      // Remove queued/deep-thought placeholder if present.
      if (retries > 0) {
        const msgs = get().messages.filter((m) => m.text !== queuedText && m.text !== deepThoughtText);
        set({ messages: msgs });
      }

      // Check if the Oracle's response contains a feedback marker.
      const marker = parseFeedbackMarker(response.answer);
      const displayText = response.answer.replace(/\[FEEDBACK_PENDING:\w+:.+?\]/, '').trim();

      const oracleMsg: OracleMessage = {
        id: genId(),
        role: 'oracle',
        text: displayText || 'The Oracle is deep in thought. Please try again shortly.',
        deep_links: response.deep_links,
        timestamp: Date.now(),
      };

      if (marker) {
        marker.userMessage = question;
        set({ messages: [...get().messages, oracleMsg], isLoading: false, pendingFeedback: marker });
      } else {
        set({ messages: [...get().messages, oracleMsg], isLoading: false });
      }
    } catch {
      set({ error: 'oracle.error', isLoading: false });
    }
  },

  clearHistory: () => set({ messages: [], error: null, pendingFeedback: null }),
}),
    {
      name: 'oracle-conversation',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist messages — transient state (isLoading, error) should reset.
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
