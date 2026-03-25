/**
 * Ambient Soundscape — "Quiet Universe"
 *
 * Generative ambient loop that evolves slowly using Web Audio API.
 * Warm, analog-inspired tones. No harsh digital beeps.
 * Default volume 15%, adjustable. No information conveyed by sound alone.
 *
 * Architecture: 3 detuned sine oscillators forming a warm pad chord,
 * shaped by a low-pass filter and slow LFO modulation. Fades in/out
 * smoothly to avoid harsh transitions.
 *
 * Reference: ME-CDS-001 §8.1, ME-ACC-001.
 */

/** Base frequencies for the warm pad chord (C major 7th voicing, low register). */
const BASE_FREQS = [130.81, 164.81, 196.0]; // C3, E3, G3

/** Detune amounts in cents for organic warmth. */
const DETUNE = [0, 7, -5];

/** LFO rate in Hz (very slow evolution). */
const LFO_RATE = 0.05;

/** Low-pass filter cutoff (Hz) — removes harsh overtones. */
const FILTER_CUTOFF = 800;

/** Fade duration in seconds. */
const FADE_DURATION = 2.0;

interface SoundscapeNodes {
  ctx: AudioContext;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  filter: BiquadFilterNode;
  masterGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

let nodes: SoundscapeNodes | null = null;
let isPlaying = false;

/**
 * Start the ambient soundscape.
 * Idempotent — calling while already playing is a no-op.
 */
export function startSoundscape(volume: number): void {
  if (isPlaying) return;

  const ctx = new AudioContext();

  // Master gain (controlled by user volume).
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0; // Start silent, fade in.
  masterGain.connect(ctx.destination);

  // Low-pass filter for warmth.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = FILTER_CUTOFF;
  filter.Q.value = 0.7;
  filter.connect(masterGain);

  // LFO for slow filter modulation (evolving texture).
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = LFO_RATE;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 200; // Modulate filter cutoff by ±200 Hz.
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  // 3 detuned oscillators forming the pad chord.
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  for (let i = 0; i < BASE_FREQS.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = BASE_FREQS[i]!;
    osc.detune.value = DETUNE[i]!;

    const gain = ctx.createGain();
    gain.gain.value = 0.15; // Each voice quiet, combined is warm.

    osc.connect(gain);
    gain.connect(filter);
    osc.start();

    oscillators.push(osc);
    gains.push(gain);
  }

  // Fade in.
  masterGain.gain.linearRampToValueAtTime(
    volume,
    ctx.currentTime + FADE_DURATION,
  );

  nodes = { ctx, oscillators, gains, filter, masterGain, lfo, lfoGain };
  isPlaying = true;
}

/**
 * Stop the ambient soundscape with a smooth fade-out.
 */
export function stopSoundscape(): void {
  if (!isPlaying || !nodes) return;

  const { ctx, oscillators, lfo, masterGain } = nodes;

  // Fade out.
  masterGain.gain.linearRampToValueAtTime(
    0.001,
    ctx.currentTime + FADE_DURATION,
  );

  // Stop oscillators after fade.
  setTimeout(() => {
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    }
    try {
      lfo.stop();
    } catch {
      // Already stopped.
    }
    void ctx.close();
    nodes = null;
    isPlaying = false;
  }, FADE_DURATION * 1000 + 100);
}

/**
 * Update the soundscape volume (0.0–1.0).
 */
export function setSoundscapeVolume(volume: number): void {
  if (!nodes) return;
  const clamped = Math.max(0, Math.min(1, volume));
  nodes.masterGain.gain.linearRampToValueAtTime(
    clamped,
    nodes.ctx.currentTime + 0.1,
  );
}

/**
 * Check if the soundscape is currently playing.
 */
export function isSoundscapePlaying(): boolean {
  return isPlaying;
}
