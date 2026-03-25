import { create } from 'zustand';

export type ToastSeverity = 'success' | 'warning' | 'danger' | 'info';

export interface ToastItem {
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
