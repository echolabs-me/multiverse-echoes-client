import { describe, it, expect, beforeEach } from 'vitest';
import { getComputedTokenColor } from '../src/lib/tokenColor.ts';

describe('getComputedTokenColor', () => {
  beforeEach(() => {
    // Set CSS custom properties on the document root for testing
    document.documentElement.style.setProperty('--canvas', '#0f1923');
    document.documentElement.style.setProperty('--accent', '#d4915c');
    document.documentElement.style.setProperty('--text-primary', '#e8e0d8');
  });

  it('reads a dark-mode token value from document.documentElement', () => {
    const color = getComputedTokenColor('--canvas');
    expect(color).toBe('#0f1923');
  });

  it('reads the accent token', () => {
    const color = getComputedTokenColor('--accent');
    expect(color).toBe('#d4915c');
  });

  it('returns empty string for an undefined token', () => {
    const color = getComputedTokenColor('--nonexistent-token');
    expect(color).toBe('');
  });

  it('reads light-mode token when overridden', () => {
    // Simulate light mode override
    document.documentElement.style.setProperty('--canvas', '#faf6f1');
    const color = getComputedTokenColor('--canvas');
    expect(color).toBe('#faf6f1');
  });

  it('trims whitespace from computed value', () => {
    document.documentElement.style.setProperty('--test-token', '  #abc123  ');
    const color = getComputedTokenColor('--test-token');
    expect(color).toBe('#abc123');
  });
});
