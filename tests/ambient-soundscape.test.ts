import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AudioContext for happy-dom (which doesn't provide Web Audio API).
const mockOscillator = {
  type: 'sine',
  frequency: { value: 0 },
  detune: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGain = {
  gain: {
    value: 0,
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

const mockFilter = {
  type: 'lowpass',
  frequency: { value: 0 },
  Q: { value: 0 },
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
  createBiquadFilter: vi.fn(() => ({
    ...mockFilter,
    frequency: { value: 0 },
    Q: { value: 0 },
    connect: vi.fn(),
  })),
  close: vi.fn(() => Promise.resolve()),
};

vi.stubGlobal('AudioContext', vi.fn(() => ({ ...mockCtx })));

// Import after mocking.
const {
  startSoundscape,
  stopSoundscape,
  isSoundscapePlaying,
} = await import('../src/lib/ambientSoundscape.ts');

describe('Ambient Soundscape', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset by stopping and advancing past fade.
    stopSoundscape();
    vi.advanceTimersByTime(5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not playing initially', () => {
    expect(isSoundscapePlaying()).toBe(false);
  });

  it('starts playing when called', () => {
    startSoundscape(0.15);
    expect(isSoundscapePlaying()).toBe(true);
  });

  it('is idempotent — calling start twice does not error', () => {
    startSoundscape(0.15);
    startSoundscape(0.15);
    expect(isSoundscapePlaying()).toBe(true);
  });

  it('stops after fade-out', () => {
    startSoundscape(0.15);
    stopSoundscape();
    // Still playing during fade.
    expect(isSoundscapePlaying()).toBe(true);
    // After fade.
    vi.advanceTimersByTime(5000);
    expect(isSoundscapePlaying()).toBe(false);
  });
});
