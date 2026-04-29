/**
 * Dashboard entry chime — "Quiet Universe"
 *
 * A short, subtle chime (< 1 second) that plays once when the Dashboard mounts.
 * Uses Web Audio API: soft sine wave with quick exponential fade.
 * No continuous loop — plays once and stops.
 *
 * Reference: ME-CDS-001 §8.1, ME-ACC-001.
 */

/** Chime frequency in Hz (G5 — bright but not harsh). */
const CHIME_FREQ = 784;

/** Second harmonic for richness (an octave above, very quiet). */
const HARMONIC_FREQ = 1568;

/** Total chime duration in seconds. */
const CHIME_DURATION = 0.6;

let hasPlayed = false;

/**
 * Play a short entry chime. Idempotent per session — only plays once
 * until resetChime() is called (on unmount).
 */
export function startSoundscape(volume: number): void {
  if (hasPlayed) return;
  hasPlayed = true;

  const ctx = new AudioContext();
  const now = ctx.currentTime;

  // Primary tone.
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = CHIME_FREQ;

  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(volume * 0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + CHIME_DURATION);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + CHIME_DURATION);

  // Soft harmonic for shimmer.
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = HARMONIC_FREQ;

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(volume * 0.08, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + CHIME_DURATION * 0.7);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + CHIME_DURATION);

  // Close the AudioContext after the chime finishes.
  setTimeout(() => void ctx.close(), (CHIME_DURATION + 0.1) * 1000);
}

/**
 * No-op for the chime (no continuous sound to stop).
 * Resets the play guard so the chime can fire again on next mount.
 */
export function stopSoundscape(): void {
  hasPlayed = false;
}

/**
 * No-op — volume is set at play time, not continuously.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setSoundscapeVolume(_volume: number): void {
  // Chime is fire-and-forget; volume only applies on next play.
}

/**
 * Check if the chime has been played this session.
 */
export function isSoundscapePlaying(): boolean {
  return false; // Never continuously playing.
}
