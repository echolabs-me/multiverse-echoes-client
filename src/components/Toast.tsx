import { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { create } from 'zustand';

type ToastSeverity = 'success' | 'warning' | 'danger' | 'info';

interface ToastItem {
  id: string;
  message: string;
  severity: ToastSeverity;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, severity?: ToastSeverity) => void;
  removeToast: (id: string) => void;
}

const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, severity = 'info') => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts.slice(-(MAX_TOASTS - 1)), { id, message, severity }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

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
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${config.bg} ${config.border}`}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-text-muted hover:text-text-primary"
        aria-label="Dismiss"
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
      className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
