/**
 * Hook to manage the "Quiet Universe" ambient soundscape on Dashboard.
 *
 * Starts on mount (if enabled), stops on unmount.
 * Reacts to sound settings changes (volume, enabled).
 * Does not play if system-level mute is active.
 *
 * Reference: ME-CDS-001 §8.1, ME-ACC-001.
 */

import { useEffect } from 'react';
import {
  startSoundscape,
  stopSoundscape,
  setSoundscapeVolume,
} from '@/lib/ambientSoundscape';
import { useSoundStore } from '@/lib/sounds';

export function useAmbientSoundscape(): void {
  const enabled = useSoundStore((s) => s.enabled);
  const volume = useSoundStore((s) => s.volume);

  useEffect(() => {
    if (!enabled || volume <= 0) {
      stopSoundscape();
      return;
    }

    startSoundscape(volume);
    return () => {
      stopSoundscape();
    };
  }, [enabled, volume]);

  // Keep volume in sync with settings changes.
  useEffect(() => {
    if (enabled) {
      setSoundscapeVolume(volume);
    }
  }, [enabled, volume]);
}
