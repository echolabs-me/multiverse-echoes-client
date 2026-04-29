/** Map a mood string to its accent colour (matches EchoPortrait3D MOOD_THEMES). */

const MOOD_COLORS: Record<string, string> = {
  happy: '#FF9F43',
  joyful: '#FF9F43',
  content: '#FF9F43',
  sad: '#5B7FCC',
  melancholy: '#5B7FCC',
  lonely: '#5B7FCC',
  angry: '#E74C3C',
  conflict: '#E74C3C',
  frustrated: '#E74C3C',
  anxious: '#9B59B6',
  nervous: '#9B59B6',
  worried: '#9B59B6',
  calm: '#2ECC71',
  peaceful: '#2ECC71',
  serene: '#2ECC71',
  excited: '#F39C12',
  energetic: '#F39C12',
  contemplative: '#6C8EBF',
  neutral: '#8E8E93',
};

const DEFAULT_COLOR = '#8E8E93';

export function getMoodColor(mood: string): string {
  return MOOD_COLORS[mood.toLowerCase()] ?? DEFAULT_COLOR;
}
