import { useEffect, useMemo } from 'react';

/**
 * Mood atmosphere system — Phase 6B Step 11
 *
 * Maps Echo mood values to colour palettes and particle behaviour.
 * Sets CSS custom properties (--mood-primary, --mood-secondary, --mood-accent,
 * --mood-particle-speed) on a target element so child CSS can react.
 *
 * Moods from the LLM (echo_intro.tera): happy, sad, anxious, calm, excited,
 * angry, contemplative, neutral. Additional moods mapped to nearest palette.
 */

export interface MoodPalette {
  primary: string;
  secondary: string;
  accent: string;
  gradientFrom: string;
  gradientTo: string;
  particleSpeed: number; // multiplier: 1 = normal, 0.5 = slow, 2 = fast
  particleDirection: 'float' | 'drift-down' | 'erratic' | 'energetic';
}

const PALETTES: Record<string, MoodPalette> = {
  contemplative: {
    primary: '#5b8fb9',
    secondary: '#1a2a3d',
    accent: '#7ab0d4',
    gradientFrom: 'rgba(91, 143, 185, 0.06)',
    gradientTo: 'rgba(26, 42, 61, 0.03)',
    particleSpeed: 0.5,
    particleDirection: 'float',
  },
  calm: {
    primary: '#5b8fb9',
    secondary: '#1a2a3d',
    accent: '#7ab0d4',
    gradientFrom: 'rgba(91, 143, 185, 0.05)',
    gradientTo: 'rgba(26, 42, 61, 0.02)',
    particleSpeed: 0.4,
    particleDirection: 'float',
  },
  excited: {
    primary: '#d4a04c',
    secondary: '#3d2a1a',
    accent: '#e8b860',
    gradientFrom: 'rgba(212, 160, 76, 0.07)',
    gradientTo: 'rgba(61, 42, 26, 0.03)',
    particleSpeed: 1.8,
    particleDirection: 'energetic',
  },
  happy: {
    primary: '#d4a04c',
    secondary: '#3d2e1a',
    accent: '#e8c070',
    gradientFrom: 'rgba(212, 160, 76, 0.06)',
    gradientTo: 'rgba(61, 46, 26, 0.03)',
    particleSpeed: 1.4,
    particleDirection: 'energetic',
  },
  anxious: {
    primary: '#b07860',
    secondary: '#332820',
    accent: '#c89080',
    gradientFrom: 'rgba(176, 120, 96, 0.06)',
    gradientTo: 'rgba(51, 40, 32, 0.04)',
    particleSpeed: 1.6,
    particleDirection: 'erratic',
  },
  angry: {
    primary: '#c45b5b',
    secondary: '#331a1a',
    accent: '#d47070',
    gradientFrom: 'rgba(196, 91, 91, 0.06)',
    gradientTo: 'rgba(51, 26, 26, 0.03)',
    particleSpeed: 2.0,
    particleDirection: 'erratic',
  },
  content: {
    primary: '#6baf7a',
    secondary: '#1a3322',
    accent: '#88c896',
    gradientFrom: 'rgba(107, 175, 122, 0.05)',
    gradientTo: 'rgba(26, 51, 34, 0.02)',
    particleSpeed: 0.6,
    particleDirection: 'float',
  },
  melancholy: {
    primary: '#8b6faa',
    secondary: '#261a33',
    accent: '#a888c4',
    gradientFrom: 'rgba(139, 111, 170, 0.06)',
    gradientTo: 'rgba(38, 26, 51, 0.03)',
    particleSpeed: 0.4,
    particleDirection: 'drift-down',
  },
  sad: {
    primary: '#7a6f9e',
    secondary: '#221a30',
    accent: '#9488b4',
    gradientFrom: 'rgba(122, 111, 158, 0.06)',
    gradientTo: 'rgba(34, 26, 48, 0.03)',
    particleSpeed: 0.3,
    particleDirection: 'drift-down',
  },
  neutral: {
    primary: '#9ba8b4',
    secondary: '#1e2830',
    accent: '#b0bcc6',
    gradientFrom: 'rgba(155, 168, 180, 0.04)',
    gradientTo: 'rgba(30, 40, 48, 0.02)',
    particleSpeed: 0.7,
    particleDirection: 'float',
  },
};

// Default palette when no mood is set or mood is unrecognised.
const DEFAULT_PALETTE = PALETTES.neutral;

/**
 * Normalise the raw mood string from the LLM to a known palette key.
 * The LLM sometimes returns moods like "Contemplative", "content", "Happy" —
 * we lowercase and strip whitespace, then fall back to the nearest match.
 */
function normaliseMood(raw: string | undefined | null): string {
  if (!raw) return 'neutral';
  const normalised = raw.toLowerCase().trim();

  // Direct match
  if (normalised in PALETTES) return normalised;

  // Fuzzy mapping for common LLM variations
  const aliases: Record<string, string> = {
    joyful: 'happy',
    elated: 'excited',
    enthusiastic: 'excited',
    hopeful: 'content',
    peaceful: 'calm',
    serene: 'calm',
    worried: 'anxious',
    nervous: 'anxious',
    tense: 'anxious',
    frustrated: 'angry',
    irritated: 'angry',
    reflective: 'contemplative',
    thoughtful: 'contemplative',
    pensive: 'contemplative',
    nostalgic: 'melancholy',
    lonely: 'melancholy',
    sorrowful: 'sad',
    satisfied: 'content',
    relaxed: 'calm',
    curious: 'contemplative',
    determined: 'excited',
    grateful: 'content',
    bored: 'neutral',
    indifferent: 'neutral',
  };

  if (normalised in aliases) return aliases[normalised];

  // Check if any palette key is a substring
  for (const key of Object.keys(PALETTES)) {
    if (normalised.includes(key)) return key;
  }

  return 'neutral';
}

export function getMoodPalette(mood: string | undefined | null): MoodPalette {
  const key = normaliseMood(mood);
  return PALETTES[key] ?? DEFAULT_PALETTE;
}

/**
 * Hook: applies mood-derived CSS custom properties to a container element.
 * Returns the current palette for use in canvas/JS rendering.
 */
export function useMoodAtmosphere(
  containerRef: React.RefObject<HTMLElement | null>,
  mood: string | undefined | null,
): MoodPalette {
  const palette = useMemo(() => getMoodPalette(mood), [mood]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.setProperty('--mood-primary', palette.primary);
    el.style.setProperty('--mood-secondary', palette.secondary);
    el.style.setProperty('--mood-accent', palette.accent);
    el.style.setProperty('--mood-particle-speed', String(palette.particleSpeed));
  }, [containerRef, palette]);

  return palette;
}
