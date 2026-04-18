import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles, Send, Trash2, ExternalLink, MessageCircle } from 'lucide-react';
import { useOracleStore } from '../stores/useOracleStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import type { OracleMessage } from '../stores/useOracleStore.ts';

const RATE_LIMITS: Record<string, number> = {
  Free: 3,
  Starter: 6,
  Core: 10,
  Creator: 10,
  GodMode: 10,
};

const SUGGESTED_QUESTIONS = [
  'oracle.suggestion1',
  'oracle.suggestion2',
  'oracle.suggestion3',
];

export function OracleSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ echoId?: string; shardId?: string }>();

  const {
    messages,
    isLoading,
    error,
    ask,
    clearHistory,
    setContext,
    startFeedback,
  } = useOracleStore();
  const user = useAuthStore((s) => s.user);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tier = user?.subscription_tier ?? 'Free';
  const rateLimit = RATE_LIMITS[tier] ?? 3;

  // Update context when route changes
  useEffect(() => {
    setContext({
      echo_id: params.echoId,
      shard_id: params.shardId,
      screen: location.pathname,
    });
  }, [params.echoId, params.shardId, location.pathname, setContext]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    void ask(trimmed);
  };

  const handleSuggestedQuestion = (key: string) => {
    if (isLoading) return;
    void ask(t(key));
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleDeepLink = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header — premium branding with accent left border */}
      <div className="border-b border-border border-s-2 border-s-accent px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
              <Sparkles size={22} className="text-accent" />
            </div>
            <h2 className="text-sm font-bold text-accent">
              {t('oracle.title')}
            </h2>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={clearHistory}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              aria-label={t('oracle.clearHistory')}
              title={t('oracle.clearHistory')}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-text-secondary">
          {t('oracle.tagline')}
        </p>
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-label={t('oracle.conversation')}
      >
        {/* Empty state with suggested questions */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Sparkles size={24} className="text-accent" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed px-2">
              {t('oracle.welcomeMessage')}
            </p>
            <div className="flex w-full flex-col gap-1.5 px-1">
              {SUGGESTED_QUESTIONS.map((key) => (
                <button
                  key={key}
                  onClick={() => handleSuggestedQuestion(key)}
                  disabled={isLoading}
                  className="rounded-full border border-accent/30 px-3 py-1.5 text-start text-[11px] text-text-secondary transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent disabled:opacity-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onDeepLink={handleDeepLink}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            {t('oracle.thinking')}
          </div>
        )}

        {error && (
          <p className="text-xs text-danger">{t(error)}</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Persistent feedback buttons */}
      <div className="flex gap-1.5 border-t border-border px-3 pt-2 pb-1">
        <button
          onClick={() => startFeedback('Bug')}
          disabled={isLoading}
          className="flex-1 rounded-md border-2 border-red-500 bg-red-500/10 px-2 py-1.5 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <MessageCircle size={10} />
            {t('oracle.feedbackPillReport')}
          </span>
        </button>
        <button
          onClick={() => startFeedback('FeatureRequest')}
          disabled={isLoading}
          className="flex-1 rounded-md border-2 border-red-500 bg-red-500/10 px-2 py-1.5 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <MessageCircle size={10} />
            {t('oracle.feedbackPillShare')}
          </span>
        </button>
      </div>

      {/* Input + rate limit */}
      <div>
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 px-3 pt-2.5 pb-1.5"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={t('oracle.inputPlaceholder')}
            className="flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            aria-label={t('oracle.inputPlaceholder')}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center rounded-md bg-accent px-3 py-2 text-canvas transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
            aria-label={t('oracle.send')}
          >
            <Send size={14} />
          </button>
        </form>
        <p className="px-3 pb-2 text-[9px] text-text-secondary">
          {t('oracle.rateLimit', { limit: String(rateLimit) })}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onDeepLink,
}: {
  message: OracleMessage;
  onDeepLink: (path: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
          isUser
            ? 'bg-accent text-canvas'
            : 'bg-surface text-text-primary'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.deep_links && message.deep_links.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1">
            {message.deep_links.map((link) => (
              <button
                key={link.path}
                onClick={() => onDeepLink(link.path)}
                className="inline-flex items-center gap-1 text-[10px] underline opacity-80 transition-opacity hover:opacity-100"
              >
                <ExternalLink size={10} />
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
