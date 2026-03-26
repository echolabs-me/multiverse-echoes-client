import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles, Send, Trash2, ChevronLeft, ExternalLink } from 'lucide-react';
import { useOracleStore } from '../stores/useOracleStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import type { OracleMessage } from '../stores/useOracleStore.ts';

const RATE_LIMITS: Record<string, number> = {
  Free: 3,
  Core: 10,
  Creator: 10,
  GodMode: 10,
};

interface OracleSidebarProps {
  onCollapse: () => void;
}

export function OracleSidebar({ onCollapse }: OracleSidebarProps) {
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
  } = useOracleStore();
  const user = useAuthStore((s) => s.user);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    void ask(trimmed);
  };

  const handleDeepLink = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">
            {t('oracle.title')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            aria-label={t('oracle.clearHistory')}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onCollapse}
            className="hidden md:inline-flex rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            aria-label={t('oracle.collapse', 'Collapse Oracle')}
          >
            <ChevronLeft size={14} className="rotate-180" />
          </button>
        </div>
      </div>

      {/* Rate limit info */}
      <div className="border-b border-border px-3 py-1.5 text-[11px] text-text-muted">
        {t('oracle.rateLimit', { limit: String(rateLimit) })}
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-label={t('oracle.conversation')}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 pt-8 text-center">
            <Sparkles size={32} className="text-accent opacity-50" />
            <p className="text-xs text-text-muted">
              {t('oracle.welcomeMessage')}
            </p>
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

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-border px-3 py-2.5"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('oracle.inputPlaceholder')}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
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
