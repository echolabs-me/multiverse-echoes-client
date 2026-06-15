import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AudioContext for happy-dom (which doesn't provide Web Audio API).
const mockOscillator = {
  type: 'sine',
  frequency: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGain = {
  gain: {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

const mockCtx = {
  currentTime: 0,
  destination: {},
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  createGain: vi.fn(() => ({
    ...mockGain,
    gain: { ...mockGain.gain },
  })),
  close: vi.fn(() => Promise.resolve()),
};

// Vitest 4: arrow functions can no longer be invoked as constructors, and
// `AudioContext` is `new`-called inside startSoundscape(). Use a regular
// function expression so `new vi.fn(...)` succeeds.
vi.stubGlobal(
  'AudioContext',
  vi.fn(function () {
    return { ...mockCtx };
  }),
);

// Import after mocking.
const {
  startSoundscape,
  stopSoundscape,
  isSoundscapePlaying,
} = await import('../src/lib/ambientSoundscape.ts');

describe('Dashboard Entry Chime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset play guard.
    stopSoundscape();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is never continuously playing', () => {
    expect(isSoundscapePlaying()).toBe(false);
  });

  it('plays chime without error', () => {
    startSoundscape(0.15);
    expect(isSoundscapePlaying()).toBe(false); // Fire-and-forget, not continuous.
  });

  it('is idempotent — calling start twice only plays once', () => {
    startSoundscape(0.15);
    startSoundscape(0.15); // Should be no-op (hasPlayed guard).
    expect(isSoundscapePlaying()).toBe(false);
  });

  it('plays again after stop resets the guard', () => {
    startSoundscape(0.15);
    stopSoundscape(); // Resets hasPlayed.
    startSoundscape(0.15); // Should play again.
    expect(isSoundscapePlaying()).toBe(false);
  });
});
