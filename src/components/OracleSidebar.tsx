import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles, Send, Trash2, ChevronLeft, ExternalLink, Flag } from 'lucide-react';
import { reports } from '../lib/api/endpoints.ts';
import { useToastStore } from '../stores/useToastStore.ts';
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const addToast = useToastStore((s) => s.addToast);
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

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleDeepLink = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Utility bar — tab bar in AppLayout provides the main header */}
      <div className="flex items-center justify-end gap-1 border-b border-border px-3 py-1.5">
        <span className="mr-auto text-[11px] text-text-secondary">
          {t('oracle.rateLimit', { limit: String(rateLimit) })}
        </span>
        <button
          onClick={() => setReportOpen(!reportOpen)}
          className={`rounded-md p-1 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${reportOpen ? 'text-danger' : 'text-text-muted hover:text-text-secondary'}`}
          aria-label={t('oracle.reportProblem')}
          title={t('oracle.reportProblem')}
        >
          <Flag size={13} />
        </button>
        <button
          onClick={clearHistory}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t('oracle.clearHistory')}
          title={t('oracle.clearHistory')}
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={onCollapse}
          className="hidden md:inline-flex lg:hidden rounded-md p-1 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t('oracle.collapse', 'Collapse Oracle')}
          title={t('oracle.collapse', 'Collapse Oracle')}
        >
          <ChevronLeft size={13} className="rotate-180" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-label={t('oracle.conversation')}
      >
        {/* Inline report form */}
        {reportOpen && (
          <div className="mx-2 mb-3 rounded-lg border border-danger/30 bg-surface p-3">
            <p className="mb-2 text-xs font-semibold text-danger">{t('oracle.reportProblem')}</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t('community.reportPlaceholder')}
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-border bg-canvas px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                onClick={() => { setReportOpen(false); setReportReason(''); }}
                className="rounded px-2 py-1 text-[11px] text-text-muted hover:text-text-primary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (!reportReason.trim()) return;
                  try {
                    await reports.create({
                      target_type: 'content',
                      target_id: '00000000-0000-0000-0000-000000000000',
                      reason: `[Oracle] ${reportReason.trim()}`,
                    });
                    addToast(t('community.reportSent'), 'success');
                    setReportOpen(false);
                    setReportReason('');
                  } catch {
                    addToast(t('common.error'), 'danger');
                  }
                }}
                disabled={!reportReason.trim()}
                className="rounded bg-danger px-2 py-1 text-[11px] font-medium text-white hover:bg-danger/80 disabled:opacity-40"
              >
                {t('common.report')}
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 pt-8 text-center">
            <Sparkles size={32} className="text-accent opacity-50" />
            <p className="text-xs text-text-secondary">
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
          className="flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
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
