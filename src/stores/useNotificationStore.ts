import { create } from 'zustand';
import type { Notification } from '../types/api.ts';
import { notifications } from '../lib/api/endpoints.ts';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const items = await notifications.list();
      set({
        notifications: items,
        unreadCount: items.filter((n) => !n.read).length,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    await notifications.markRead(id);
    const updated = get().notifications.map((n) =>
      n.notification_id === id ? { ...n, read: true } : n,
    );
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  addNotification: (notification) => {
    set({
      notifications: [notification, ...get().notifications],
      unreadCount: get().unreadCount + (notification.read ? 0 : 1),
    });
  },
}));
