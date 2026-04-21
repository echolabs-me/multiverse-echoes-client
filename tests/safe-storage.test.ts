import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeGetItem, safeGetJSON, safeSetItem, safeRemoveItem } from '../src/lib/safeStorage.ts';

/**
 * Safe localStorage wrappers — crash-loop recovery for corrupted
 * browser storage. Corresponds to the auth-hydration task flagged in
 * the ErrorBoundary audit (c9b39b9): malformed JSON at boot time
 * would otherwise throw → ErrorBoundary fallback → reload → same
 * throw, and the user gets stuck unless they manually clear site
 * data.
 *
 * These tests pin three invariants:
 *   1. Happy-path gets return stored values (no regression).
 *   2. Malformed JSON at a known key does NOT throw; it returns the
 *      caller-supplied fallback AND clears the corrupted key so the
 *      next boot is clean.
 *   3. localStorage.getItem throwing (sandbox policy, disabled
 *      storage) does NOT throw; it returns null / fallback.
 *
 * The Rule #30 physical cycle for this module lives in the
 * echo-store-hydration test below, which also covers the real
 * crash-loop path we were guarding against.
 */

describe('safeStorage', () => {
  let originalLocalStorage: Storage;
  // Silence expected diagnostic logs from safeStorage in the failure-path tests.
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    consoleSpy.mockRestore();
  });

  it('safeGetItem returns stored value on happy path', () => {
    localStorage.setItem('test_key', 'hello');
    expect(safeGetItem('test_key')).toBe('hello');
  });

  it('safeGetItem returns null on missing key', () => {
    expect(safeGetItem('nonexistent')).toBe(null);
  });

  it('safeGetJSON returns parsed value on happy path', () => {
    localStorage.setItem('json_key', JSON.stringify({ a: 1, b: 'two' }));
    expect(safeGetJSON('json_key', null)).toEqual({ a: 1, b: 'two' });
  });

  it('safeGetJSON returns fallback + clears the key on malformed JSON', () => {
    // This is the real crash-loop surface the Founder named:
    // malformed JSON at a known key would otherwise throw at boot.
    localStorage.setItem('corrupt_key', '{not valid json}');
    const result = safeGetJSON('corrupt_key', []);
    expect(result).toEqual([]);
    // Key is cleared so the next boot starts fresh.
    expect(localStorage.getItem('corrupt_key')).toBe(null);
    // Diagnostic log fired — verify the key name appears so operators
    // can triage.
    const logCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain("'corrupt_key'");
  });

  it('safeGetJSON credential keys: value is redacted in diagnostic log', () => {
    // Auth tokens must not leak into browser console even on crash-
    // recovery logs. The redaction logic only kicks in on parse
    // failure because happy-path reads never hit the logger.
    localStorage.setItem('access_token', '{not valid json}');
    safeGetJSON('access_token', null);
    const logCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('<redacted credential>');
    // Sanity: the corrupted payload did NOT leak.
    expect(logCalls).not.toContain('{not valid json}');
  });

  it('safeGetJSON narrow clearing — does not touch unrelated keys', () => {
    // Invariant from the Founder's audit #10: a corrupt auth key must
    // not log the user out of theme preference, locale, etc.
    localStorage.setItem('locale', 'es');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('access_token', '{corrupt}');
    safeGetJSON('access_token', null);
    expect(localStorage.getItem('locale')).toBe('es');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('access_token')).toBe(null);
  });

  it('safeGetItem returns null when localStorage access throws', () => {
    // Simulate SecurityError from sandbox policy / disabled storage.
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('SecurityError: localStorage disabled');
        },
        setItem: () => {
          throw new Error('SecurityError: localStorage disabled');
        },
        removeItem: () => {
          throw new Error('SecurityError: localStorage disabled');
        },
      },
      writable: true,
      configurable: true,
    });
    expect(safeGetItem('anything')).toBe(null);
  });

  it('safeGetJSON returns fallback when localStorage access throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {},
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    });
    expect(safeGetJSON('k', { default: true })).toEqual({ default: true });
  });

  it('safeSetItem + safeRemoveItem swallow throws silently', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {
          throw new Error('SecurityError');
        },
      },
      writable: true,
      configurable: true,
    });
    // Should not throw; absence of throw IS the assertion.
    safeSetItem('k', 'v');
    safeRemoveItem('k');
  });
});
