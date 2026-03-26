/**
 * Ambient activity hints — Phase 6B Step 13
 *
 * 80+ strings grouped by mood. Displayed between diary ticks to
 * fill the dead time and make the Echo feel alive. Lowercase
 * ellipsis style for intimacy.
 *
 * Moods match the 10 palettes from useMoodAtmosphere (Step 11).
 */

const hints: Record<string, string[]> = {
  contemplative: [
    'staring out the window...',
    'lost in thought...',
    'watching the clouds drift by...',
    'tracing patterns on the table...',
    'reading the same page for the third time...',
    'sitting with a cup of tea, not drinking it...',
    'watching dust motes float in a sunbeam...',
    'wondering about roads not taken...',
  ],
  calm: [
    'breathing slowly...',
    'listening to the silence...',
    'sitting in the warm light...',
    'watching the world go by...',
    'resting with eyes half-closed...',
    'feeling the breeze through an open window...',
    'counting heartbeats...',
    'settling into the quiet...',
  ],
  excited: [
    'pacing around the room...',
    'scribbling ideas on a napkin...',
    "can't sit still...",
    'tapping a rhythm on the desk...',
    'making plans for tomorrow...',
    'grinning at nothing in particular...',
    'talking too fast...',
    'bouncing between three different thoughts...',
  ],
  happy: [
    'humming a half-remembered tune...',
    'smiling at a passing stranger...',
    'sketching something in the margins...',
    'laughing at an old memory...',
    'walking with a lighter step...',
    'savouring the moment...',
    'noticing how good the light looks today...',
    'feeling unexpectedly grateful...',
  ],
  anxious: [
    'checking the clock again...',
    'drumming fingers on the table...',
    'glancing at the door...',
    'picking at a loose thread...',
    'rehearsing conversations that haven\'t happened...',
    'unable to finish a sentence...',
    'watching shadows move on the wall...',
    'folding and unfolding a piece of paper...',
  ],
  angry: [
    'clenching and unclenching fists...',
    'staring at the wall...',
    'pacing in tight circles...',
    'biting back words...',
    'slamming a drawer shut...',
    'breathing through clenched teeth...',
    'crossing arms tightly...',
    'replaying the argument...',
  ],
  content: [
    'humming softly...',
    'tending the garden...',
    'reading by the fire...',
    'stretching lazily...',
    'watching the sunset from the porch...',
    'organising the bookshelf for fun...',
    'cooking something that smells wonderful...',
    'writing a letter to no one in particular...',
  ],
  melancholy: [
    'flipping through old photos...',
    'sitting quietly in the dark...',
    'listening to the rain...',
    'tracing a name on foggy glass...',
    'holding something that belongs to someone else...',
    'staring at an empty chair...',
    'reading old messages...',
    'watching the last light fade...',
  ],
  sad: [
    'curled up, not sleeping...',
    'looking at the ceiling...',
    'forgetting what they were about to say...',
    'letting the phone ring...',
    'standing at the window, not seeing anything...',
    'pulling the blanket tighter...',
    'pressing a palm against cold glass...',
    'sitting on the edge of the bed...',
  ],
  neutral: [
    'looking around the room...',
    'sorting through the day...',
    'adjusting to the silence...',
    'waiting for something to happen...',
    'noticing details for the first time...',
    'flipping through channels...',
    'doodling absently...',
    'stretching before standing up...',
  ],
};

/**
 * Shard-themed hint overrides. If an Echo's location name contains a
 * shard keyword, a handful of atmosphere-specific hints are mixed in.
 * Keeps the library manageable — just 3-4 per shard theme.
 */
const shardHints: Record<string, string[]> = {
  cyber: [
    'watching neon reflections in a puddle...',
    'scrolling through a holographic feed...',
    'listening to the hum of the city grid...',
    'tracing circuit patterns on the wall...',
  ],
  tokyo: [
    'watching neon reflections in a puddle...',
    'navigating the crowded alleyways...',
    'listening to distant karaoke...',
    'watching the trains pass below...',
  ],
  renaissance: [
    'studying a fresco on the ceiling...',
    'listening to a distant lute...',
    'watching candlelight flicker on stone walls...',
    'sketching in charcoal on rough paper...',
  ],
  florence: [
    'walking along the Arno at dusk...',
    'listening to church bells ring...',
    'studying a fresco on the ceiling...',
    'watching artisans at work...',
  ],
  outback: [
    'watching the red dust settle...',
    'listening to the silence of the plains...',
    'counting stars in the endless sky...',
    'sitting by the campfire embers...',
  ],
  australia: [
    'watching the red dust settle...',
    'listening to birds in the gum trees...',
    'squinting at the shimmering horizon...',
    'sitting by the campfire embers...',
  ],
};

/**
 * Pick a random activity hint for the given mood and optional location.
 * Shard-themed hints are mixed into the pool when the location matches.
 */
export function getRandomHint(
  mood: string | undefined | null,
  locationName?: string,
): string {
  const key = normaliseMoodKey(mood);
  const pool = [...(hints[key] ?? hints.neutral)];

  // Mix in shard-themed hints if location matches
  if (locationName) {
    const loc = locationName.toLowerCase();
    for (const [keyword, extras] of Object.entries(shardHints)) {
      if (loc.includes(keyword)) {
        pool.push(...extras);
        break; // Only match one shard theme
      }
    }
  }

  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Get the full hint pool size for a mood (for testing/verification).
 */
export function getHintPoolSize(mood: string | undefined | null): number {
  const key = normaliseMoodKey(mood);
  return (hints[key] ?? hints.neutral).length;
}

function normaliseMoodKey(mood: string | undefined | null): string {
  if (!mood) return 'neutral';
  const normalised = mood.toLowerCase().trim();
  if (normalised in hints) return normalised;

  // Same fuzzy aliases as useMoodAtmosphere
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

  return aliases[normalised] ?? 'neutral';
}
