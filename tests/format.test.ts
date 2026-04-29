import { describe, it, expect } from 'vitest';
import { formatUsdCents } from '../src/lib/format.ts';

describe('formatUsdCents', () => {
  it('renders zero as $0.00', () => {
    expect(formatUsdCents(0)).toBe('$0.00');
  });

  it('renders 100 cents as $1.00', () => {
    expect(formatUsdCents(100)).toBe('$1.00');
  });

  it('renders large amounts with thousands separator', () => {
    expect(formatUsdCents(99999900)).toBe('$999,999.00');
  });

  it('renders negative amounts with leading minus', () => {
    expect(formatUsdCents(-12345)).toBe('-$123.45');
  });

  it('honours custom locale (de-DE) for digit grouping + currency placement', () => {
    // de-DE places the currency symbol after the value, separated by NBSP.
    // Use a regex match that allows any whitespace between the digits and
    // the dollar sign so the test stays robust to NBSP vs regular space.
    expect(formatUsdCents(100, 'de-DE')).toMatch(/^1,00\s\$$/);
  });
});
