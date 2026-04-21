import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.ts';
import type { ToastItem, ToastSeverity } from '../stores/useToastStore.ts';

const severityConfig: Record<
  ToastSeverity,
  { icon: typeof CheckCircle; bg: string; border: string }
> = {
  success: { icon: CheckCircle, bg: 'bg-success/10', border: 'border-success/30' },
  warning: { icon: AlertCircle, bg: 'bg-warning/10', border: 'border-warning/30' },
  danger: { icon: XCircle, bg: 'bg-danger/10', border: 'border-danger/30' },
  info: { icon: Info, bg: 'bg-info/10', border: 'border-info/30' },
};

function ToastEntry({ toast }: { toast: ToastItem }) {
  const { t } = useTranslation();
  const removeToast = useToastStore((s) => s.removeToast);
  const config = severityConfig[toast.severity];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      role="alert"
      className={`flex animate-slide-in items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${config.bg} ${config.border}`}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm text-text-primary">
        <span>{toast.message}</span>
        {toast.platformLink && (
          <>
            {' '}
            <a
              href="https://status.echolabsme.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-text-muted hover:text-text-primary"
            >
              {t('common.checkStatusLinkShort')}
            </a>
          </>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-text-muted transition-color-opacity hover:text-text-primary"
        aria-label={t('common.dismiss')}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed end-4 top-4 z-50 flex w-80 flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
