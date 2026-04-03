import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Lock } from 'lucide-react';
import { Button, ReportButton } from '../components/index.ts';
import { useAuthStore, useEchoStore } from '../stores/index.ts';
import { conversations } from '../lib/api/endpoints.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { ConversationMessage } from '../types/api.ts';

interface TierLimits {
  available: boolean;
  dailyConversations: number;
  maxMessages: number;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  Free: { available: true, dailyConversations: 1, maxMessages: 10 },
  Core: { available: true, dailyConversations: 5, maxMessages: 20 },
  Creator: { available: true, dailyConversations: 20, maxMessages: 50 },
  GodMode: { available: true, dailyConversations: Infinity, maxMessages: Infinity },
};

export function EchoConversationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoId } = useParams<{ echoId: string }>();
  const user = useAuthStore((s) => s.user);
  const { activeEcho, fetchEcho } = useEchoStore();

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

  // Fetch echo if not loaded
  useEffect(() => {
    if (echoId && (!activeEcho || activeEcho.echo_id !== echoId)) {
      void fetchEcho(echoId);
    }
  }, [echoId, activeEcho, fetchEcho]);

  // Find active conversation or create a new one on mount / echo switch.
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
        const result = await conversations.findActive(echoId);
        setConversationId(result.conversation_id);
        if (result.resumed && result.messages.length > 0) {
          setMessages(result.messages);
          trackEvent('conversation.resumed', { echo_id: echoId });
        } else {
          trackEvent('conversation.started', { echo_id: echoId });
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        setError(t('conversation.errorStarting', { detail }));
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [echoId, limits.available, t]);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !conversationId || isSending) return;

    if (messages.filter((m) => m.role === 'user').length >= limits.maxMessages) {
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
      // Send message with auto-retry on 202 (LLM busy with tick).
      // 8 retries × 15s = 2 minutes coverage. Show "deep in thought" after
      // attempt 6 but keep retrying — user should never be left without a response.
      let retries = 0;
      const maxRetries = 8;
      const deepThoughtThreshold = 6;
      let echoResponse = await conversations.sendMessage(conversationId, {
        content: trimmed,
      });

      // Detect 202 queued response (has 'status' field instead of normal message fields).
      const isQueued = (r: unknown): boolean =>
        typeof r === 'object' && r !== null && 'status' in r && (r as Record<string, unknown>).status === 'queued';

      while (retries < maxRetries && isQueued(echoResponse)) {
        // Show queued message while waiting.
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
        // After deepThoughtThreshold attempts, swap to "deep in thought" message
        // but keep retrying in the background.
        if (retries === deepThoughtThreshold) {
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.message_id.startsWith('queued-'));
            return [...filtered, {
              message_id: `queued-deep-${Date.now()}`,
              conversation_id: conversationId,
              role: 'echo',
              content: t('conversation.echoDeepThought'),
              created_at: new Date().toISOString(),
            }];
          });
        }
        // Wait then retry silently.
        await new Promise((r) => setTimeout(r, 15_000));
        retries++;
        echoResponse = await conversations.sendMessage(conversationId, {
          content: trimmed,
        });
      }

      if (retries >= maxRetries && isQueued(echoResponse)) {
        // Still queued after all retries — keep "deep in thought" message visible.
        setMessages((prev) => {
          const hasDeepThought = prev.some((m) => m.message_id.startsWith('queued-deep-'));
          if (hasDeepThought) return prev;
          const filtered = prev.filter((m) => !m.message_id.startsWith('queued-'));
          return [...filtered, {
            message_id: `fallback-${Date.now()}`,
            conversation_id: conversationId,
            role: 'echo',
            content: t('conversation.echoDeepThought'),
            created_at: new Date().toISOString(),
          }];
        });
      } else {
        // Got a real response — replace any queued/deep-thought message.
        trackEvent('conversation.message_sent', { echo_id: echoId, message_number: userMessageCount + 1 });
        setMessages((prev) => {
          const filtered = prev.filter((m) =>
            !m.message_id.startsWith('queued-') &&
            !m.message_id.startsWith('fallback-')
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
  };

  // Free tier gate
  if (!limits.available) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
        <Lock size={48} className="text-text-muted" />
        <h1 className="text-xl font-semibold text-text-primary">
          {t('conversation.tierGateTitle')}
        </h1>
        <p className="max-w-md text-center text-text-secondary">
          {t('conversation.tierGateDesc')}
        </p>
        <Button onClick={() => navigate('/plans')}>{t('conversation.upgrade')}</Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const echoName = activeEcho?.name ?? t('conversation.echo');
  const echoMood = activeEcho?.current_mood ?? '';
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const atLimit = userMessageCount >= limits.maxMessages && isFinite(limits.maxMessages);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button
          onClick={() => navigate(`/echoes/${echoId}`)}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text-primary">{echoName}</h1>
          {echoMood && (
            <p className="text-xs text-text-muted">
              {t('conversation.mood', { mood: echoMood })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isFinite(limits.maxMessages) && (
            <span className="text-xs text-text-muted">
              {t('conversation.messageCount', {
                count: userMessageCount,
                max: limits.maxMessages,
              })}
            </span>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div
        className="flex-1 space-y-4 overflow-y-auto px-4 py-6"
        aria-live="polite"
        aria-label={t('conversation.messages')}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" role="status">
              <span className="sr-only">{t('common.loading')}</span>
            </span>
          </div>
        )}

        {!isLoading && messages.length === 0 && conversationId && (
          <div className="flex flex-col items-center gap-3 pt-12 text-center">
            <p className="text-sm text-text-muted">{t('conversation.startPrompt')}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'rounded-br-sm bg-accent text-canvas'
                  : 'rounded-bl-sm bg-surface text-text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <div className="mt-1 flex items-center justify-end gap-1">
                <time className="text-[10px] opacity-60">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                {msg.role === 'echo' && !msg.message_id.startsWith('queued-') && !msg.message_id.startsWith('temp-') && !msg.message_id.startsWith('fallback-') && (
                  <ReportButton targetType="content" targetId={msg.message_id} size={12} />
                )}
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-surface px-4 py-3">
              <div className="flex gap-1">
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-center text-sm text-danger">{error}</p>}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex gap-2 border-t border-border px-4 py-3"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
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
            atLimit ? t('conversation.atLimit') : t('conversation.inputPlaceholder')
          }
          disabled={isSending || atLimit || !conversationId}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none disabled:opacity-40"
          style={{ maxHeight: '150px' }}
          aria-label={t('conversation.inputPlaceholder')}
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending || atLimit || !conversationId}
          className="flex items-center justify-center rounded-full bg-accent p-2.5 text-canvas transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
          aria-label={t('conversation.send')}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
