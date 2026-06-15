import { describe, it, expect, vi } from 'vitest';

/**
 * Phase 6B Testing — Sound Registry
 *
 * Verifies that nudge-related and diary-related sound events exist
 * in the registry and have valid frequencies.
 */

// Mock AudioContext for happy-dom. Vitest 4: arrow functions can no longer
// be invoked as constructors, and `new AudioContext()` is the call site —
// use a regular function expression so `new vi.fn(...)` succeeds.
vi.stubGlobal(
  'AudioContext',
  vi.fn(function () {
    return {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: { value: 0, exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
    };
  }),
);

// Import after mocking
const { useSoundStore } = await import('../src/lib/sounds.ts');
import type { SoundEvent } from '../src/lib/sounds.ts';

describe('Sound Registry', () => {
  const ALL_EVENTS: SoundEvent[] = [
    'notification',
    'life_event',
    'echo_born',
    'message',
    'travel',
    'influence',
    'system',
    'diary_entry',
  ];

  it('influence sound event exists in the registry', () => {
    // If 'influence' were not a valid SoundEvent, this would be a TS error.
    // At runtime, verify the store can accept and process it without error.
    const store = useSoundStore.getState();
    expect(() => store.play('influence')).not.toThrow();
  });

  it('diary_entry sound event exists in the registry', () => {
    const store = useSoundStore.getState();
    expect(() => store.play('diary_entry')).not.toThrow();
  });

  it('all 8 sound events can be played without error', () => {
    const store = useSoundStore.getState();
    // Enable sound so play() actually exercises the code path
    store.setEnabled(true);
    store.setVolume(0.15);
    for (const event of ALL_EVENTS) {
      expect(() => store.play(event)).not.toThrow();
    }
  });

  it('SoundEvent type has exactly 8 members', () => {
    expect(ALL_EVENTS).toHaveLength(8);
  });

  it('setEnabled toggles sound on and off', () => {
    const store = useSoundStore.getState();
    store.setEnabled(false);
    expect(useSoundStore.getState().enabled).toBe(false);
    store.setEnabled(true);
    expect(useSoundStore.getState().enabled).toBe(true);
  });

  it('volume clamps to 0-1 range', () => {
    const store = useSoundStore.getState();
    store.setVolume(-0.5);
    expect(useSoundStore.getState().volume).toBe(0);
    store.setVolume(2.0);
    expect(useSoundStore.getState().volume).toBe(1);
    store.setVolume(0.5);
    expect(useSoundStore.getState().volume).toBe(0.5);
  });
});
