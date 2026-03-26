import { describe, it, expect } from 'vitest';
import { getRandomHint, getHintPoolSize } from '../src/lib/activityHints.ts';

/**
 * Phase 6B Testing — Activity Hints Logic
 *
 * Tests getRandomHint, hint pool sizes, shard-keyword matching,
 * and edge cases.
 */

const ALL_MOODS = [
  'contemplative',
  'calm',
  'excited',
  'happy',
  'anxious',
  'angry',
  'content',
  'melancholy',
  'sad',
  'neutral',
] as const;

describe('getRandomHint', () => {
  describe('returns a non-empty string for all 10 moods', () => {
    for (const mood of ALL_MOODS) {
      it(`returns a hint for "${mood}"`, () => {
        const hint = getRandomHint(mood);
        expect(hint).toBeTruthy();
        expect(typeof hint).toBe('string');
        expect(hint.length).toBeGreaterThan(0);
      });
    }
  });

  describe('never returns undefined for edge cases', () => {
    it('undefined mood returns a hint', () => {
      const hint = getRandomHint(undefined);
      expect(hint).toBeTruthy();
    });

    it('null mood returns a hint', () => {
      const hint = getRandomHint(null);
      expect(hint).toBeTruthy();
    });

    it('empty string mood returns a hint', () => {
      const hint = getRandomHint('');
      expect(hint).toBeTruthy();
    });

    it('unknown mood returns a hint (falls back to neutral)', () => {
      const hint = getRandomHint('xyzzy');
      expect(hint).toBeTruthy();
    });
  });
});

describe('getHintPoolSize', () => {
  describe('all 10 moods have at least 6 hints', () => {
    for (const mood of ALL_MOODS) {
      it(`"${mood}" has >= 6 hints`, () => {
        expect(getHintPoolSize(mood)).toBeGreaterThanOrEqual(6);
      });
    }
  });

  it('all moods have exactly 8 hints', () => {
    for (const mood of ALL_MOODS) {
      expect(getHintPoolSize(mood)).toBe(8);
    }
  });

  it('unknown mood falls back to neutral pool size', () => {
    expect(getHintPoolSize('nonsense')).toBe(getHintPoolSize('neutral'));
  });
});

describe('shard-keyword matching', () => {
  it('"Cyberpunk Shard" includes cyber-themed hints in the pool', () => {
    // Run many times to see if shard hint appears (probabilistic but reliable with large sample)
    const hints = new Set<string>();
    for (let i = 0; i < 200; i++) {
      hints.add(getRandomHint('neutral', 'Cyberpunk Shard'));
    }
    // Cyber shard hints include "neon reflections", "holographic feed", etc.
    const hasCyberHint = [...hints].some(
      (h) => h.includes('neon') || h.includes('holographic') || h.includes('circuit') || h.includes('city grid'),
    );
    expect(hasCyberHint).toBe(true);
  });

  it('shard keyword matching is case-insensitive', () => {
    const hints = new Set<string>();
    for (let i = 0; i < 200; i++) {
      hints.add(getRandomHint('calm', 'TOKYO DISTRICT'));
    }
    const hasTokyoHint = [...hints].some(
      (h) => h.includes('karaoke') || h.includes('alleyways') || h.includes('trains') || h.includes('neon'),
    );
    expect(hasTokyoHint).toBe(true);
  });

  it('"Renaissance Quarter" mixes in renaissance hints', () => {
    const hints = new Set<string>();
    for (let i = 0; i < 200; i++) {
      hints.add(getRandomHint('happy', 'Renaissance Quarter'));
    }
    const hasRenaissanceHint = [...hints].some(
      (h) => h.includes('fresco') || h.includes('lute') || h.includes('candlelight') || h.includes('charcoal'),
    );
    expect(hasRenaissanceHint).toBe(true);
  });

  it('"Florence Market" mixes in florence hints', () => {
    const hints = new Set<string>();
    for (let i = 0; i < 200; i++) {
      hints.add(getRandomHint('content', 'Florence Market'));
    }
    const hasFlorenceHint = [...hints].some(
      (h) => h.includes('Arno') || h.includes('church bells') || h.includes('artisans'),
    );
    expect(hasFlorenceHint).toBe(true);
  });

  it('"Outback Station" mixes in outback hints', () => {
    const hints = new Set<string>();
    for (let i = 0; i < 200; i++) {
      hints.add(getRandomHint('calm', 'Outback Station'));
    }
    const hasOutbackHint = [...hints].some(
      (h) => h.includes('red dust') || h.includes('plains') || h.includes('campfire') || h.includes('stars'),
    );
    expect(hasOutbackHint).toBe(true);
  });

  it('unknown shard name returns only mood hints (no crash, no empty)', () => {
    const hint = getRandomHint('happy', 'Atlantis Depths');
    expect(hint).toBeTruthy();
    expect(typeof hint).toBe('string');
  });

  it('no location returns only mood hints', () => {
    const hint = getRandomHint('sad');
    expect(hint).toBeTruthy();
  });

  describe('fuzzy aliases work with shard hints', () => {
    it('"joyful" with cyber location includes cyber hints', () => {
      const hints = new Set<string>();
      for (let i = 0; i < 200; i++) {
        hints.add(getRandomHint('joyful', 'Cyber City'));
      }
      const hasCyberHint = [...hints].some(
        (h) => h.includes('neon') || h.includes('holographic'),
      );
      expect(hasCyberHint).toBe(true);
    });
  });
});
