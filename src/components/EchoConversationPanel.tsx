import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, X } from 'lucide-react';
import { useAuthStore } from '../stores/index.ts';
import { conversations } from '../lib/api/endpoints.ts';
import { trackEvent } from '../lib/analytics.ts';
import { formatTime } from '../lib/formatDate.ts';
import { getMoodLabel } from '../lib/moodLabel.ts';
import type { ConversationMessage } from '../types/api.ts';

interface TierLimits {
  available: boolean;
  dailyConversations: number;
  maxMessages: number;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  Free: { available: true, dailyConversations: 1, maxMessages: 10 },
  Starter: { available: true, dailyConversations: 5, maxMessages: 15 },
  Core: { available: true, dailyConversations: 10, maxMessages: 20 },
  Creator: { available: true, dailyConversations: 20, maxMessages: 50 },
  GodMode: {
    available: true,
    dailyConversations: Infinity,
    maxMessages: Infinity,
  },
};

interface EchoConversationPanelProps {
  echoId: string;
  echoName: string;
  echoMood: string;
  onClose: () => void;
  /** If provided, load this specific past conversation instead of find-or-create. */
  resumeConversationId?: string;
}

export function EchoConversationPanel({
  echoId,
  echoName,
  echoMood,
  onClose,
  resumeConversationId,
}: EchoConversationPanelProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tier = user?.subscription_tier ?? 'Free';
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.Free;

  // Load a specific past conversation or find/create an active one.
  useEffect(() => {
    if (!echoId || !limits.available) return;

    // Reset state from previous echo before loading.
    setConversationId(null);
    setMessages([]);
    setError(null);
    setInput('');

    const init = async () => {
      setIsLoading(true);
      try {
        if (resumeConversationId) {
          setConversationId(resumeConversationId);
          const msgs = await conversations.messages(resumeConversationId);
          setMessages(msgs);
          trackEvent('conversation.resumed', { echo_id: echoId });
        } else {
          const result = await conversations.findActive(echoId);
          setConversationId(result.conversation_id);
          if (result.resumed && result.messages.length > 0) {
            setMessages(result.messages);
            trackEvent('conversation.resumed', { echo_id: echoId });
          } else {
            trackEvent('conversation.started', { echo_id: echoId });
          }
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        setError(t('conversation.errorStarting', { detail }));
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [echoId, limits.available, t, resumeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after loading
  useEffect(() => {
    if (conversationId && !isLoading) {
      inputRef.current?.focus();
    }
  }, [conversationId, isLoading]);

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const atLimit =
    userMessageCount >= limits.maxMessages && isFinite(limits.maxMessages);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || !conversationId || isSending) return;

      if (
        messages.filter((m) => m.role === 'user').length >= limits.maxMessages
      ) {
        setError('conversation.messageLimitReached');
        return;
      }

      setInput('');
      setIsSending(true);
      setError(null);

      // Optimistic user message
      const optimisticUserMsg: ConversationMessage = {
        message_id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        let retries = 0;
        const maxRetries = 8;
        const deepThoughtThreshold = 6;
        let echoResponse = await conversations.sendMessage(conversationId, {
          content: trimmed,
        });

        const isQueued = (r: unknown): boolean =>
          typeof r === 'object' &&
          r !== null &&
          'status' in r &&
          (r as Record<string, unknown>).status === 'queued';

        while (retries < maxRetries && isQueued(echoResponse)) {
          if (retries === 0) {
            const queuedMsg: ConversationMessage = {
              message_id: `queued-${Date.now()}`,
              conversation_id: conversationId,
              role: 'echo',
              content: t('conversation.echoQueued'),
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, queuedMsg]);
          }
          if (retries === deepThoughtThreshold) {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) => !m.message_id.startsWith('queued-'),
              );
              return [
                ...filtered,
                {
                  message_id: `queued-deep-${Date.now()}`,
                  conversation_id: conversationId,
                  role: 'echo',
                  content: t('conversation.echoDeepThought'),
                  created_at: new Date().toISOString(),
                },
              ];
            });
          }
          await new Promise((r) => setTimeout(r, 15_000));
          retries++;
          echoResponse = await conversations.sendMessage(conversationId, {
            content: trimmed,
          });
        }

        if (retries >= maxRetries && isQueued(echoResponse)) {
          setMessages((prev) => {
            const hasDeepThought = prev.some((m) =>
              m.message_id.startsWith('queued-deep-'),
            );
            if (hasDeepThought) return prev;
            const filtered = prev.filter(
              (m) => !m.message_id.startsWith('queued-'),
            );
            return [
              ...filtered,
              {
                message_id: `fallback-${Date.now()}`,
                conversation_id: conversationId,
                role: 'echo',
                content: t('conversation.echoDeepThought'),
                created_at: new Date().toISOString(),
              },
            ];
          });
        } else {
          trackEvent('conversation.message_sent', {
            echo_id: echoId,
            message_number: userMessageCount + 1,
          });
          setMessages((prev) => {
            const filtered = prev.filter(
              (m) =>
                !m.message_id.startsWith('queued-') &&
                !m.message_id.startsWith('fallback-'),
            );
            return [...filtered, echoResponse];
          });
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        setError(t('conversation.errorSending', { detail }));
      } finally {
        setIsSending(false);
      }
    },
    [
      input,
      conversationId,
      isSending,
      messages,
      limits.maxMessages,
      t,
      echoId,
      userMessageCount,
    ],
  );

  return (
    <div className="flex h-full flex-col border-s border-border bg-canvas">
      {/* Header */}
      <header className="flex items-center gap-3 border-be border-border bg-surface px-4 py-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-text-primary">
            {echoName}
          </h2>
          <p className="text-xs text-text-secondary">
            {echoMood
              ? t('conversation.mood', { mood: getMoodLabel(echoMood) })
              : t('conversation.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFinite(limits.maxMessages) && (
            <span className="text-xs text-text-secondary">
              {t('conversation.messageCount', {
                count: userMessageCount,
                max: limits.maxMessages,
              })}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-raised hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div
        className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
        aria-live="polite"
        aria-label={t('conversation.messages')}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span
              className="inline-block size-5 animate-spin rounded-full border-2 border-accent border-bs-transparent"
              role="status"
            >
              <span className="sr-only">{t('common.loading')}</span>
            </span>
          </div>
        )}

        {!isLoading && messages.length === 0 && conversationId && (
          <div className="flex flex-col items-center gap-2 pbs-8 text-center">
            <p className="text-xs text-text-secondary">
              {t('conversation.startPrompt')}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'rounded-ee-sm bg-accent text-canvas'
                  : 'rounded-es-sm bg-surface text-text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <div className="mbs-0.5 flex items-center justify-end gap-1">
                <time className="text-[9px] opacity-60">
                  {formatTime(msg.created_at)}
                </time>
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-es-sm bg-surface px-3 py-2.5">
              <div className="flex gap-1">
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-center text-xs text-danger">{error}</p>}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex gap-2 border-bs border-border px-3 py-2"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-grow: reset height then set to scrollHeight
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !isSending && !atLimit && conversationId) {
                void handleSend(e as unknown as React.FormEvent);
              }
            }
          }}
          placeholder={
            atLimit
              ? t('conversation.atLimit')
              : t('conversation.inputPlaceholder')
          }
          disabled={isSending || atLimit || !conversationId}
          rows={1}
          className="max-h-30 flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none disabled:opacity-40"
          aria-label={t('conversation.inputPlaceholder')}
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending || atLimit || !conversationId}
          className="flex items-center justify-center rounded-full bg-accent p-2 text-canvas transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
          aria-label={t('conversation.send')}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
