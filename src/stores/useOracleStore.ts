import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import i18n from '../i18n.ts';
import type {
  OracleContext,
  OracleDeepLink,
  FeedbackType,
} from '../types/api.ts';
import { oracle, feedback } from '../lib/api/endpoints.ts';
import { detectConfirmationIntent } from '../lib/confirmationIntent.ts';

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

/** Parse [FEEDBACK_PENDING:Type:Summary] marker from Oracle response text.
 *  Type may be multi-word (e.g. "Cosmetic Issue") — the LLM doesn't always
 *  stick to single-word types, so we match liberally and normalize. */
function parseFeedbackMarker(text: string): PendingFeedback | null {
  const match = text.match(/\[FEEDBACK_PENDING:([^:]+):(.+?)\]/);
  if (!match) return null;
  const typeStr = match[1].toLowerCase().trim();
  const feedbackType: FeedbackType = typeStr.includes('bug')
    ? 'Bug'
    : typeStr.includes('feature')
      ? 'FeatureRequest'
      : typeStr.includes('frustrat')
        ? 'Frustration'
        : typeStr.includes('praise')
          ? 'Praise'
          : 'General';
  return { type: feedbackType, summary: match[2].trim(), userMessage: '' };
}

/** Check if a user message is confirming a pending feedback submission. */
function isConfirmation(text: string): boolean {
  return detectConfirmationIntent(text) === true;
}

interface OracleState {
  isOpen: boolean;
  messages: OracleMessage[];
  isLoading: boolean;
  error: string | null;
  context: OracleContext;
  pendingFeedback: PendingFeedback | null;
  /** Pre-set feedback type from button click (Bug or FeatureRequest). */
  feedbackMode: FeedbackType | null;

  toggle: () => void;
  open: () => void;
  close: () => void;
  setContext: (ctx: OracleContext) => void;
  ask: (question: string) => Promise<void>;
  clearHistory: () => void;
  /** Start feedback flow with a pre-set type (from button click). */
  startFeedback: (type: FeedbackType) => void;
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
      feedbackMode: null,

      toggle: () => set({ isOpen: !get().isOpen }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      setContext: (ctx) => set({ context: ctx }),

      startFeedback: (type) => {
        const prompt =
          type === 'Bug'
            ? i18n.t('oracle.feedbackBugPrompt')
            : i18n.t('oracle.feedbackFeaturePrompt');
        const oracleMsg: OracleMessage = {
          id: genId(),
          role: 'oracle',
          text: prompt,
          timestamp: Date.now(),
        };
        set({
          isOpen: true,
          feedbackMode: type,
          messages: [...get().messages, oracleMsg],
        });
      },

      ask: async (question) => {
        const state = get();

        // If there's a pending feedback, check for locale-aware confirmation/denial.
        if (
          state.pendingFeedback &&
          detectConfirmationIntent(question) === false
        ) {
          // Explicit denial — cancel the pending feedback, don't send to Oracle.
          set({ pendingFeedback: null });
          return;
        }
        if (state.pendingFeedback && isConfirmation(question)) {
          const pf = state.pendingFeedback;
          const userMsg: OracleMessage = {
            id: genId(),
            role: 'user',
            text: question,
            timestamp: Date.now(),
          };
          set({
            messages: [...get().messages, userMsg],
            isLoading: true,
            error: null,
          });

          try {
            const result = await feedback.submit({
              user_message: pf.userMessage,
              structured_summary: pf.summary,
              feedback_type: pf.type,
              context: {
                screen: state.context.screen ?? '',
                recent_events: [],
              },
            });
            // Use the server's response message — it tells the user whether the
            // GH Issue was actually created or if it failed.
            const serverMsg =
              result.message ??
              i18n.t('oracle.feedbackFallback', {
                type: pf.type.toLowerCase(),
              });
            const confirmMsg: OracleMessage = {
              id: genId(),
              role: 'oracle',
              text: serverMsg,
              timestamp: Date.now(),
            };
            set({
              messages: [...get().messages, confirmMsg],
              isLoading: false,
              pendingFeedback: null,
            });
          } catch {
            const errorMsg: OracleMessage = {
              id: genId(),
              role: 'oracle',
              text: i18n.t('oracle.feedbackError'),
              timestamp: Date.now(),
            };
            set({
              messages: [...get().messages, errorMsg],
              isLoading: false,
              pendingFeedback: null,
            });
          }
          return;
        }

        // Clear any stale pending feedback if user sent a non-confirmation message.
        if (state.pendingFeedback) {
          set({ pendingFeedback: null });
        }

        // Button-initiated feedback: user's message is the feedback content.
        // Submit directly without going through the Oracle LLM.
        if (state.feedbackMode) {
          const fType = state.feedbackMode;
          const userMsg: OracleMessage = {
            id: genId(),
            role: 'user',
            text: question,
            timestamp: Date.now(),
          };
          set({
            messages: [...get().messages, userMsg],
            isLoading: true,
            error: null,
          });

          try {
            const result = await feedback.submit({
              user_message: question,
              structured_summary: question.slice(0, 200),
              feedback_type: fType,
              context: {
                screen: state.context.screen ?? '',
                recent_events: [],
              },
            });
            const serverMsg =
              result.message ??
              i18n.t('oracle.feedbackFallback', { type: fType.toLowerCase() });
            const confirmMsg: OracleMessage = {
              id: genId(),
              role: 'oracle',
              text: serverMsg,
              timestamp: Date.now(),
            };
            set({
              messages: [...get().messages, confirmMsg],
              isLoading: false,
              feedbackMode: null,
            });
          } catch {
            const errorMsg: OracleMessage = {
              id: genId(),
              role: 'oracle',
              text: i18n.t('oracle.feedbackError'),
              timestamp: Date.now(),
            };
            set({
              messages: [...get().messages, errorMsg],
              isLoading: false,
              feedbackMode: null,
            });
          }
          return;
        }

        const userMsg: OracleMessage = {
          id: genId(),
          role: 'user',
          text: question,
          timestamp: Date.now(),
        };
        set({
          messages: [...get().messages, userMsg],
          isLoading: true,
          error: null,
        });

        try {
          let retries = 0;
          const maxRetries = 8;
          const deepThoughtThreshold = 6;
          const queuedText =
            'The Oracle is busy guiding the multiverse right now. They\u2019ll be with you shortly.';
          const deepThoughtText =
            'The Oracle is taking a while \u2014 they\u2019re deep in thought. Hang tight, they\u2019ll respond soon.';
          // Build conversation history from stored messages (last 20, excluding current).
          const history = get()
            .messages.slice(-20)
            .map((m) => ({
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
              set({
                messages: [...get().messages, queuedMsg],
                isLoading: true,
              });
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
            response = await oracle.ask({
              question,
              context: get().context,
              history,
            });
          }

          // Remove queued/deep-thought placeholder if present.
          if (retries > 0) {
            const msgs = get().messages.filter(
              (m) => m.text !== queuedText && m.text !== deepThoughtText,
            );
            set({ messages: msgs });
          }

          // Check if the Oracle's response contains a feedback marker.
          const marker = parseFeedbackMarker(response.answer);
          const displayText = response.answer
            .replace(/\[FEEDBACK_PENDING:[^\]]+\]/, '')
            .trim();

          const oracleMsg: OracleMessage = {
            id: genId(),
            role: 'oracle',
            text:
              displayText ||
              'The Oracle is deep in thought. Please try again shortly.',
            deep_links: response.deep_links,
            timestamp: Date.now(),
          };

          if (marker) {
            marker.userMessage = question;
            set({
              messages: [...get().messages, oracleMsg],
              isLoading: false,
              pendingFeedback: marker,
            });
          } else {
            set({ messages: [...get().messages, oracleMsg], isLoading: false });
          }
        } catch {
          set({ error: 'oracle.error', isLoading: false });
        }
      },

      clearHistory: () =>
        set({
          messages: [],
          error: null,
          pendingFeedback: null,
          feedbackMode: null,
        }),
    }),
    {
      name: 'oracle-conversation',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist messages — transient state (isLoading, error) should reset.
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
