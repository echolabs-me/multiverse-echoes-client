import { describe, it, expect } from 'vitest';
import { getRandomHint } from '../src/lib/activityHints.ts';
import en from '../src/locales/en.json';

/**
 * Phase 6B Testing — Activity Hints Logic
 *
 * Tests getRandomHint, hint pool sizes, shard-keyword matching,
 * and edge cases.
 *
 * The JS-level getHintPoolSize function was removed in commit 7770536
 * when hints migrated to i18n (activityHints.* keys in locale bundles).
 * Pool-size assertions now read the en.json bundle directly — the
 * bundle is the source of truth for per-mood hint variety.
 */
const activityHints = en.activityHints as Record<
  string,
  Record<string, string>
>;

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

describe('hint pool size (en.json activityHints.*)', () => {
  describe('all 10 moods have at least 6 hints', () => {
    for (const mood of ALL_MOODS) {
      it(`"${mood}" has >= 6 hints`, () => {
        expect(Object.keys(activityHints[mood]).length).toBeGreaterThanOrEqual(6);
      });
    }
  });

  it('all moods have exactly 8 hints', () => {
    // Matches HINTS_PER_MOOD = 8 in activityHints.ts:12 — the source
    // loop builds activityHints.<mood>.0 through .7. Locale bundle
    // structure and source constant must stay in sync; this asserts the
    // locale side of the invariant.
    for (const mood of ALL_MOODS) {
      expect(Object.keys(activityHints[mood]).length).toBe(8);
    }
  });

  it('unknown mood resolves to the neutral pool', () => {
    // normaliseMoodKey in activityHints.ts:37 falls unknown moods back
    // to 'neutral'. Calling getRandomHint('nonsense') many times must
    // produce only strings that exist in the neutral pool (not any
    // other mood's pool, not the defaultValue).
    const neutralPool = new Set(Object.values(activityHints.neutral));
    for (let i = 0; i < 50; i++) {
      const hint = getRandomHint('nonsense');
      expect(neutralPool.has(hint)).toBe(true);
    }
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
