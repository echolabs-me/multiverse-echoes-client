import { create } from 'zustand';

interface SystemState {
  tickIntervalSeconds: number;
  /** Epoch millis when the server last completed a tick. 0 = unknown. */
  lastTickAt: number;
  isLoaded: boolean;
  fetchHealth: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
  tickIntervalSeconds: 120, // Fallback until fetched from server (matches config/default.toml)
  lastTickAt: 0,
  isLoaded: false,

  fetchHealth: async () => {
    try {
      const resp = await fetch('http://localhost:8080/health');
      if (resp.ok) {
        const data = (await resp.json()) as {
          tick_interval_seconds?: number;
          last_tick_at?: number;
        };
        if (data.tick_interval_seconds) {
          set({
            tickIntervalSeconds: data.tick_interval_seconds,
            lastTickAt: data.last_tick_at ?? 0,
            isLoaded: true,
          });
        }
      }
    } catch {
      // Health fetch failed — keep fallback
    }
  },
}));
