import { create } from 'zustand';

export type ToastSeverity = 'success' | 'warning' | 'danger' | 'info';

export interface ToastOptions {
  // Append a status-page link to the toast. Use ONLY for platform-class
  // errors (5xx, network timeout, WebSocket disconnect, "service unreachable" —
  // any case where the status page is genuinely relevant). Do NOT use for
  // validation errors (file-too-large, email-taken) or business errors
  // (tier-limit-reached, permission-denied) — appending the link there reads
  // as false causation ("File too large • check status" implies the platform
  // is at fault on pure user-input failures). Rubric: if the toast message is
  // a generic catch-all like t('common.error') / t('common.errorGeneric') /
  // t('errors.INTERNAL_ERROR'), it belongs to the platform category. If the
  // message is a specific validation key, it does not.
  platformLink?: boolean;
}

export interface ToastItem {
  id: string;
  message: string;
  severity: ToastSeverity;
  platformLink: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (
    message: string,
    severity?: ToastSeverity,
    options?: ToastOptions,
  ) => void;
  removeToast: (id: string) => void;
}

const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, severity = 'info', options) => {
    const id = crypto.randomUUID();
    const platformLink = options?.platformLink ?? false;
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-(MAX_TOASTS - 1)),
        { id, message, severity, platformLink },
      ],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
