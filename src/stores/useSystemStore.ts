import { create } from 'zustand';

interface SystemState {
  tickIntervalSeconds: number;
  isLoaded: boolean;
  fetchHealth: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
  tickIntervalSeconds: 60, // Fallback until fetched from server
  isLoaded: false,

  fetchHealth: async () => {
    try {
      const resp = await fetch('http://localhost:8080/health');
      if (resp.ok) {
        const data = (await resp.json()) as { tick_interval_seconds?: number };
        if (data.tick_interval_seconds) {
          set({ tickIntervalSeconds: data.tick_interval_seconds, isLoaded: true });
        }
      }
    } catch {
      // Health fetch failed — keep fallback
    }
  },
}));
