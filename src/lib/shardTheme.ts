/**
 * Map shard names to environment themes.
 * Shared between components — kept separate to satisfy react-refresh.
 */

export type ShardTheme =
  | 'cyber-tokyo'
  | 'nomad-australia'
  | 'renaissance-florence'
  | 'personal'
  | 'default';

export function shardNameToTheme(name: string): ShardTheme {
  const lower = name.toLowerCase();
  if (lower.includes('cyber') || lower.includes('tokyo')) return 'cyber-tokyo';
  if (lower.includes('nomad') || lower.includes('australia'))
    return 'nomad-australia';
  if (lower.includes('renaissance') || lower.includes('florence'))
    return 'renaissance-florence';
  if (lower.includes('personal')) return 'personal';
  return 'default';
}

/**
 * Deterministic pseudo-random number from a seed integer.
 * Used for procedural geometry placement (avoids Math.random in render).
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}
