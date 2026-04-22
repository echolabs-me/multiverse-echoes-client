import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n.ts';

/**
 * Map `navigator.language` (e.g. "en-US", "zh-CN", "pt-BR") to one of the 21
 * shipped locales. Returns 'en' for any language outside the shipped set so
 * the caller always has a valid rendering target.
 *
 * Chinese uses region-to-script heuristics:
 *   TW / HK / MO / explicit Hant → zh-Hant
 *   everything else (including CN, SG, MY) → zh-Hans
 * Portuguese maps to pt-BR (the only pt variant shipped).
 */
export function detectShippedLocale(
  nav: string | undefined | null,
): SupportedLocale {
  if (!nav) return 'en';
  const shipped = SUPPORTED_LOCALES as readonly string[];
  if (shipped.includes(nav)) return nav as SupportedLocale;

  const lower = nav.toLowerCase();
  if (lower.startsWith('zh')) {
    const upper = nav.toUpperCase();
    if (
      upper.includes('HANT') ||
      upper.includes('TW') ||
      upper.includes('HK') ||
      upper.includes('MO')
    ) {
      return 'zh-Hant';
    }
    return 'zh-Hans';
  }

  if (lower.startsWith('pt')) return 'pt-BR';

  const base = lower.split('-')[0];
  if (shipped.includes(base)) return base as SupportedLocale;
  return 'en';
}

/**
 * In-place Fisher-Yates shuffle. Accepts an optional RNG so tests can
 * supply a seeded generator. Does not mutate the input.
 */
export function shuffle<T>(
  input: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Static fallback slot picks when prefers-reduced-motion is active. Preserves
 * the original hardcoded subheader's three-script intent (Latin + Han +
 * Devanagari) across every slot-1 locale so reduced-motion visitors always
 * see three distinct scripts.
 */
export function staticFallbackSlots(
  slot1: SupportedLocale,
): [SupportedLocale, SupportedLocale] {
  if (slot1 === 'en') return ['zh-Hans', 'hi'];
  if (slot1 === 'zh-Hans') return ['en', 'hi'];
  if (slot1 === 'hi') return ['en', 'zh-Hans'];
  return ['en', 'zh-Hans'];
}
