import { create } from 'zustand';

/**
 * Notification sound system — CDS-001 §8.2
 *
 * 7 default sound events. Audio played via Web Audio API.
 * Volume from user preference (default 15%). Fully disableable.
 * Every sound event has a matching visual notification (ACC-001 §3.1).
 */

export type SoundEvent =
  | 'notification'
  | 'life_event'
  | 'echo_born'
  | 'message'
  | 'travel'
  | 'influence'
  | 'system'
  | 'diary_entry';

interface SoundState {
  enabled: boolean;
  volume: number; // 0.0 – 1.0 (default 0.15)
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  play: (event: SoundEvent) => void;
}

// Placeholder frequencies for each sound event (sine wave beeps).
// Real sound files will be loaded in a future step.
const frequencies: Record<SoundEvent, number> = {
  notification: 880,
  life_event: 660,
  echo_born: 1047,
  message: 784,
  travel: 523,
  influence: 988,
  system: 440,
  diary_entry: 587,
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequency: number, volume: number, durationMs = 150) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gainNode.gain.value = volume;

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + durationMs / 1000,
  );
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export const useSoundStore = create<SoundState>((set, get) => ({
  enabled: localStorage.getItem('sound_enabled') === 'true',
  volume: parseFloat(localStorage.getItem('sound_volume') ?? '0.15'),

  setEnabled: (enabled) => {
    localStorage.setItem('sound_enabled', String(enabled));
    set({ enabled });
  },

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem('sound_volume', String(clamped));
    set({ volume: clamped });
  },

  play: (event) => {
    const { enabled, volume } = get();
    if (!enabled || volume <= 0) return;

    const freq = frequencies[event];
    playTone(freq, volume);
  },
}));
