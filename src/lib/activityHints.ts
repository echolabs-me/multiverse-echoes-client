/**
 * Ambient activity hints — Phase 6B Step 13
 *
 * Strings are stored in locale files under `activityHints.*`. This module
 * picks a random hint from the correct mood group and returns the
 * translated string via i18n.
 *
 * Moods match the 10 palettes from useMoodAtmosphere (Step 11).
 */
import i18n from '../i18n';

const HINTS_PER_MOOD = 8;

const SHARD_THEMES: Record<string, { key: string; count: number }> = {
  cyber:       { key: 'cyber', count: 4 },
  tokyo:       { key: 'tokyo', count: 4 },
  renaissance: { key: 'renaissance', count: 4 },
  florence:    { key: 'florence', count: 4 },
  outback:     { key: 'outback', count: 4 },
  australia:   { key: 'australia', count: 4 },
};

/**
 * Normalise a free-form mood string from the LLM to one of the 10 core
 * palette keys. Fuzzy alias matching covers common LLM variations.
 */
const MOOD_ALIASES: Record<string, string> = {
  happy: 'happy', joyful: 'happy', content: 'content', satisfied: 'content',
  sad: 'sad', lonely: 'sad', melancholy: 'melancholy', nostalgic: 'melancholy',
  angry: 'angry', frustrated: 'angry', anxious: 'anxious', nervous: 'anxious',
  worried: 'anxious', calm: 'calm', peaceful: 'calm', serene: 'calm',
  excited: 'excited', energetic: 'excited', elated: 'excited',
  contemplative: 'contemplative', curious: 'contemplative', reflective: 'contemplative',
  neutral: 'neutral',
};

function normaliseMoodKey(mood: string | undefined | null): string {
  if (!mood) return 'neutral';
  return MOOD_ALIASES[mood.toLowerCase()] ?? 'neutral';
}

/**
 * Pick a random activity hint for the given mood and optional location.
 * Returns a translated string from the current locale's activityHints.
 */
export function getRandomHint(
  mood: string | undefined | null,
  locationName?: string,
): string {
  const key = normaliseMoodKey(mood);

  // Build a pool of i18n keys for this mood
  const pool: string[] = [];
  for (let j = 0; j < HINTS_PER_MOOD; j++) {
    pool.push(`activityHints.${key}.${j}`);
  }

  // Mix in shard-themed hints if location matches
  if (locationName) {
    const loc = locationName.toLowerCase();
    for (const [keyword, theme] of Object.entries(SHARD_THEMES)) {
      if (loc.includes(keyword)) {
        for (let j = 0; j < theme.count; j++) {
          pool.push(`activityHints.shard.${theme.key}.${j}`);
        }
        break;
      }
    }
  }

  // Pick random and resolve via i18n
  const randomKey = pool[Math.floor(Math.random() * pool.length)];
  return i18n.t(randomKey, { defaultValue: 'living their life...' });
}
