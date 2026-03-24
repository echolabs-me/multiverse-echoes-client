import { create } from 'zustand';
import type { FeedItem } from '../types/api.ts';
import { feeds } from '../lib/api/endpoints.ts';

interface FeedState {
  personalFeed: FeedItem[];
  socialFeed: FeedItem[];
  isLoading: boolean;

  fetchPersonalFeed: (echoId?: string) => Promise<void>;
  fetchSocialFeed: () => Promise<void>;
}

export const useFeedStore = create<FeedState>((set) => ({
  personalFeed: [],
  socialFeed: [],
  isLoading: false,

  fetchPersonalFeed: async (echoId) => {
    set({ isLoading: true });
    const items = await feeds.personal(echoId);
    set({ personalFeed: items, isLoading: false });
  },

  fetchSocialFeed: async () => {
    set({ isLoading: true });
    const items = await feeds.social();
    set({ socialFeed: items, isLoading: false });
  },
}));
