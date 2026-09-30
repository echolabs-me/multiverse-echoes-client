import { create } from 'zustand';
import { getBaseUrl } from '../lib/api/client.ts';
import type { HealthResponse } from '../types/generated.ts';

interface SystemState {
  tickIntervalSeconds: number;
  /** Epoch millis when the server last completed a tick. 0 = unknown. */
  lastTickAt: number;
  isLoaded: boolean;
  fetchHealth: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  tickIntervalSeconds: 120, // Fallback until fetched from server (matches config/default.toml)
  lastTickAt: 0,
  isLoaded: false,

  fetchHealth: async () => {
    try {
      const resp = await fetch(`${getBaseUrl()}/health`);
      if (resp.ok) {
        const data = (await resp.json()) as HealthResponse;
        if (data.tick_interval_seconds) {
          set({
            tickIntervalSeconds: data.tick_interval_seconds,
            lastTickAt: data.last_tick_at,
            isLoaded: true,
          });
        }
      } else {
        throw new Error('Not ok');
      }
    } catch {
      // Health fetch failed — retry in 5s if not loaded
      if (!get().isLoaded) {
        setTimeout(() => {
          void get().fetchHealth();
        }, 5000);
      }
    }
  },
}));
