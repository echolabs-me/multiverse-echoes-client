import { create } from 'zustand';
import type { Shard } from '../types/api.ts';
import { shards } from '../lib/api/endpoints.ts';

interface ShardState {
  shardList: Shard[];
  activeShard: Shard | null;
  isLoading: boolean;

  fetchShards: (params?: { type?: string; tags?: string; sort?: string }) => Promise<void>;
  fetchShard: (id: string) => Promise<void>;
  setActiveShard: (shard: Shard | null) => void;
}

export const useShardStore = create<ShardState>((set) => ({
  shardList: [],
  activeShard: null,
  isLoading: false,

  fetchShards: async (params) => {
    set({ isLoading: true });
    try {
      const list = await shards.list(params);
      set({ shardList: list, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchShard: async (id) => {
    const shard = await shards.get(id);
    set({ activeShard: shard });
  },

  setActiveShard: (shard) => set({ activeShard: shard }),
}));
