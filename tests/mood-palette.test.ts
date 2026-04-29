import { describe, it, expect } from 'vitest';
import { getMoodPalette, type MoodPalette } from '../src/hooks/useMoodAtmosphere.ts';

/**
 * Phase 6B Testing — Mood Palette Logic
 *
 * Tests getMoodPalette for all 10 primary moods, 20+ fuzzy aliases,
 * unknown strings, and edge cases (empty/undefined/null).
 */

const PRIMARY_MOODS = [
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

function isPalette(p: MoodPalette): boolean {
  return (
    typeof p.primary === 'string' &&
    typeof p.secondary === 'string' &&
    typeof p.accent === 'string' &&
    typeof p.gradientFrom === 'string' &&
    typeof p.gradientTo === 'string' &&
    typeof p.particleSpeed === 'number' &&
    typeof p.particleDirection === 'string'
  );
}

describe('getMoodPalette', () => {
  describe('primary moods return valid palettes', () => {
    for (const mood of PRIMARY_MOODS) {
      it(`returns a valid palette for "${mood}"`, () => {
        const palette = getMoodPalette(mood);
        expect(isPalette(palette)).toBe(true);
        expect(palette.primary).toMatch(/^#[0-9a-f]{6}$/);
      });
    }
  });

  describe('each primary mood has a distinct palette', () => {
    it('contemplative and calm share primary but differ in speed', () => {
      const a = getMoodPalette('contemplative');
      const b = getMoodPalette('calm');
      expect(a.particleSpeed).not.toBe(b.particleSpeed);
    });

    it('happy and angry have different primary colours', () => {
      expect(getMoodPalette('happy').primary).not.toBe(
        getMoodPalette('angry').primary,
      );
    });
  });

  describe('fuzzy alias mapping', () => {
    const aliases: [string, string][] = [
      ['joyful', 'happy'],
      ['elated', 'excited'],
      ['enthusiastic', 'excited'],
      ['hopeful', 'content'],
      ['peaceful', 'calm'],
      ['serene', 'calm'],
      ['worried', 'anxious'],
      ['nervous', 'anxious'],
      ['tense', 'anxious'],
      ['frustrated', 'angry'],
      ['irritated', 'angry'],
      ['reflective', 'contemplative'],
      ['thoughtful', 'contemplative'],
      ['pensive', 'contemplative'],
      ['nostalgic', 'melancholy'],
      ['lonely', 'melancholy'],
      ['sorrowful', 'sad'],
      ['satisfied', 'content'],
      ['relaxed', 'calm'],
      ['curious', 'contemplative'],
      ['determined', 'excited'],
      ['grateful', 'content'],
      ['bored', 'neutral'],
      ['indifferent', 'neutral'],
    ];

    for (const [alias, expected] of aliases) {
      it(`"${alias}" maps to "${expected}" palette`, () => {
        const aliasPalette = getMoodPalette(alias);
        const expectedPalette = getMoodPalette(expected);
        expect(aliasPalette.primary).toBe(expectedPalette.primary);
        expect(aliasPalette.secondary).toBe(expectedPalette.secondary);
        expect(aliasPalette.particleDirection).toBe(
          expectedPalette.particleDirection,
        );
      });
    }
  });

  describe('case insensitivity', () => {
    it('"Happy" (capitalised) maps to happy palette', () => {
      expect(getMoodPalette('Happy').primary).toBe(
        getMoodPalette('happy').primary,
      );
    });

    it('"ANXIOUS" (all caps) maps to anxious palette', () => {
      expect(getMoodPalette('ANXIOUS').primary).toBe(
        getMoodPalette('anxious').primary,
      );
    });

    it('"Pensive" (capitalised alias) maps to contemplative', () => {
      expect(getMoodPalette('Pensive').primary).toBe(
        getMoodPalette('contemplative').primary,
      );
    });
  });

  describe('fallback to neutral', () => {
    it('unknown mood string falls back to neutral', () => {
      const neutral = getMoodPalette('neutral');
      expect(getMoodPalette('flibbertigibbet').primary).toBe(neutral.primary);
    });

    it('empty string falls back to neutral', () => {
      const neutral = getMoodPalette('neutral');
      expect(getMoodPalette('').primary).toBe(neutral.primary);
    });

    it('undefined falls back to neutral', () => {
      const neutral = getMoodPalette('neutral');
      expect(getMoodPalette(undefined).primary).toBe(neutral.primary);
    });

    it('null falls back to neutral', () => {
      const neutral = getMoodPalette('neutral');
      expect(getMoodPalette(null).primary).toBe(neutral.primary);
    });
  });

  describe('particle behaviour', () => {
    it('sad mood has drift-down particles', () => {
      expect(getMoodPalette('sad').particleDirection).toBe('drift-down');
    });

    it('angry mood has erratic particles', () => {
      expect(getMoodPalette('angry').particleDirection).toBe('erratic');
    });

    it('happy mood has energetic particles', () => {
      expect(getMoodPalette('happy').particleDirection).toBe('energetic');
    });

    it('calm mood has float particles', () => {
      expect(getMoodPalette('calm').particleDirection).toBe('float');
    });
  });
});
