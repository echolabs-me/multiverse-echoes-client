import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { request } from '../lib/api/client.ts';

/**
 * Persistent feedback button — always visible on every page.
 * Opens a modal to submit feedback which creates a GitHub Issue.
 */
export function FeedbackButton() {
  const { t } = useTranslation();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isAuthenticated) return null;

  const handleSubmit = async () => {
    if (message.trim().length < 5) return;
    setSubmitting(true);
    try {
      await request('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          message: message.trim(),
          page: location.pathname,
        }),
      });
      setSubmitted(true);
      setMessage('');
      setTimeout(() => {
        setSubmitted(false);
        setOpen(false);
      }, 2500);
    } catch {
      // Still show thank you — feedback is best-effort
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setOpen(false);
      }, 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button — bottom-right corner */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full bg-accent/90 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-accent transition-colors"
        aria-label={t('feedback.button')}
      >
        <MessageSquare size={14} />
        {t('feedback.button')}
      </button>

      {/* Modal overlay */}
      {open && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        >
          <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-canvas p-5 shadow-2xl">
            {submitted ? (
              <div className="text-center py-6">
                <p className="text-lg font-medium text-text-primary">{t('feedback.thankYou')}</p>
                <p className="mt-1 text-sm text-text-secondary">{t('feedback.weRead')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">{t('feedback.title')}</h3>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-text-secondary mb-3">{t('feedback.subtitle')}</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('feedback.placeholder')}
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-text-muted">{message.length}/2000</span>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || message.trim().length < 5}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? t('common.loading') : t('feedback.submit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
