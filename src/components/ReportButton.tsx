import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react';
import { reports } from '../lib/api/endpoints.ts';
import { useToastStore } from '../stores/useToastStore.ts';

interface ReportButtonProps {
  targetType: string;
  targetId: string;
  /** Size of the flag icon in pixels. Default 14. */
  size?: number;
  /** Extra CSS classes for the wrapper button. */
  className?: string;
}

/**
 * Inline report flag button with a confirmation textarea.
 * Displays a small flag icon that expands to a reason input on click.
 */
export function ReportButton({
  targetType,
  targetId,
  size = 14,
  className = '',
}: ReportButtonProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await reports.create({
        target_type: targetType,
        target_id: targetId,
        reason: reason.trim(),
      });
      addToast(t('community.reportSent'), 'success');
      setOpen(false);
      setReason('');
    } catch {
      addToast(t('common.error'), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  if (open) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('community.reportPlaceholder')}
          maxLength={200}
          className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
            if (e.key === 'Escape') { setOpen(false); setReason(''); }
          }}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just clicked report, focus the reason input
          autoFocus
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!reason.trim() || submitting}
          className="rounded bg-accent px-2 py-1 text-xs text-canvas hover:bg-accent-hover disabled:opacity-40"
        >
          {t('common.report')}
        </button>
        <button
          onClick={() => { setOpen(false); setReason(''); }}
          className="rounded px-1.5 py-1 text-xs text-text-muted hover:text-text-primary"
        >
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className={`rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${className}`}
      aria-label={t('common.report')}
      title={t('common.report')}
    >
      <Flag size={size} />
    </button>
  );
}
