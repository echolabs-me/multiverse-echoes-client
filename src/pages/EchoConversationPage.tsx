import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Save, Lock } from 'lucide-react';
import { Button } from '../components/index.ts';
import { useAuthStore, useEchoStore } from '../stores/index.ts';
import { conversations } from '../lib/api/endpoints.ts';
import type { ConversationMessage } from '../types/api.ts';

interface TierLimits {
  available: boolean;
  dailyConversations: number;
  maxMessages: number;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  Free: { available: false, dailyConversations: 0, maxMessages: 0 },
  Basic: { available: true, dailyConversations: 5, maxMessages: 20 },
  Pro: { available: true, dailyConversations: 20, maxMessages: 50 },
  Enterprise: { available: true, dailyConversations: Infinity, maxMessages: Infinity },
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
  const [saved, setSaved] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tier = user?.subscription_tier ?? 'Free';
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.Free;

  // Fetch echo if not loaded
  useEffect(() => {
    if (echoId && (!activeEcho || activeEcho.echo_id !== echoId)) {
      void fetchEcho(echoId);
    }
  }, [echoId, activeEcho, fetchEcho]);

  // Start conversation on mount
  useEffect(() => {
    if (!echoId || !limits.available) return;

    const init = async () => {
      setIsLoading(true);
      try {
        const conv = await conversations.create(echoId);
        setConversationId(conv.conversation_id);
      } catch {
        setError('conversation.errorStarting');
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [echoId, limits.available]);

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
      const echoResponse = await conversations.sendMessage(conversationId, {
        content: trimmed,
      });
      setMessages((prev) => [...prev, echoResponse]);
    } catch {
      setError('conversation.errorSending');
    } finally {
      setIsSending(false);
    }
  };

  const handleSave = async () => {
    if (!conversationId || saved) return;
    try {
      await conversations.saveAsDiary(conversationId);
      setSaved(true);
    } catch {
      setError('conversation.errorSaving');
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
        <Button onClick={() => navigate('/settings')}>{t('conversation.upgrade')}</Button>
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
    <div className="flex h-screen flex-col bg-canvas">
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
          {messages.length > 0 && (
            <button
              onClick={() => void handleSave()}
              disabled={saved}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              aria-label={t('conversation.save')}
            >
              <Save size={16} />
              {saved ? t('conversation.saved') : t('conversation.save')}
            </button>
          )}
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
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'rounded-br-sm bg-accent text-canvas'
                  : 'rounded-bl-sm bg-surface text-text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <time className="mt-1 block text-right text-[10px] opacity-60">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
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

        {error && <p className="text-center text-sm text-danger">{t(error)}</p>}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex gap-2 border-t border-border px-4 py-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            atLimit ? t('conversation.atLimit') : t('conversation.inputPlaceholder')
          }
          disabled={isSending || atLimit || !conversationId}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none disabled:opacity-40"
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
