/**
 * Map an engine mood string to its i18n-translated display label.
 *
 * Engine moods are free-form English strings from the LLM. This normalises
 * common synonyms to the canonical keys defined in `moods.*` locale entries,
 * then returns the translated label via `i18next.t()`.
 *
 * If the mood doesn't match any known synonym, the raw string is returned
 * with its first letter capitalised (graceful degradation for any new moods
 * the LLM invents before we add them here).
 */
import i18n from '../i18n';

const MOOD_ALIASES: Record<string, string> = {
  happy: 'happy',
  joyful: 'happy',
  content: 'content',
  satisfied: 'content',
  sad: 'sad',
  lonely: 'sad',
  melancholy: 'melancholy',
  nostalgic: 'melancholy',
  angry: 'angry',
  frustrated: 'angry',
  conflict: 'angry',
  anxious: 'anxious',
  nervous: 'anxious',
  worried: 'anxious',
  restless: 'restless',
  calm: 'calm',
  peaceful: 'calm',
  serene: 'calm',
  excited: 'excited',
  energetic: 'excited',
  elated: 'excited',
  contemplative: 'contemplative',
  curious: 'contemplative',
  reflective: 'contemplative',
  neutral: 'neutral',
};

export function getMoodLabel(mood: string): string {
  const key = MOOD_ALIASES[mood.toLowerCase()];
  if (key) {
    return i18n.t(`moods.${key}`);
  }
  // Graceful fallback: capitalise unknown mood
  return mood.charAt(0).toUpperCase() + mood.slice(1).toLowerCase();
}
