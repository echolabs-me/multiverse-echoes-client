import { create } from 'zustand';
import type { MoodPalette } from '../hooks/useMoodAtmosphere.ts';

interface MoodPaletteState {
  palette: MoodPalette | null;
  setPalette: (palette: MoodPalette) => void;
}

export const useMoodPaletteStore = create<MoodPaletteState>((set) => ({
  palette: null,
  setPalette: (palette) => set({ palette }),
}));
