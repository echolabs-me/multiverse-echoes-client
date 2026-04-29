import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * End-to-end regression test for the auth-hydration crash-loop class
 * flagged in the ErrorBoundary audit (c9b39b9). Pre-fix:
 *
 *   1. User's localStorage contains a corrupted value at a known key
 *   2. Some module-level hydration `JSON.parse(...)` throws at boot
 *   3. ErrorBoundary catches and shows fallback UI with reload button
 *   4. Reload re-hits the same corruption → crash → fallback → loop
 *   5. User is stuck unless they manually clear site data
 *
 * Post-fix (this commit): every hydration point routes through
 * `safeStorage`, which catches + clears the specific corrupted key
 * and proceeds with a fallback value. Next boot is clean.
 *
 * Tests below seed corruption into each known hydration surface and
 * import the consuming module. Import itself must not throw. The
 * corrupted key must be cleared as a side-effect of the fallback
 * path.
 *
 * Because Vitest module caching makes re-imports tricky, these tests
 * use `vi.resetModules()` per case to force a fresh module load on
 * each import — simulating the page-reload crash path exactly.
 */

describe('hydration crash-loop recovery', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('useEchoStore boot with corrupted me_echo_order does not throw', async () => {
    // Exact real-world class: malformed JSON in the custom-order key.
    localStorage.setItem('me_echo_order', '{this is not valid}');

    // Importing the store used to crash here because the fetchEchoes
    // path was wrapped in try/catch but the JSON.parse was inside — a
    // throwing parse at call time (once fetchEchoes ran) would
    // silently swallow. But the real crash-loop is if a module-level
    // JSON.parse exists in ANY hydration point. We test both: import
    // doesn't throw + calling a method that touches the key doesn't
    // throw.
    const { useEchoStore } = await import('../src/stores/useEchoStore.ts');
    expect(useEchoStore.getState()).toBeDefined();
    // The corrupted key gets cleared on first read through safeGetJSON.
    // Simulate that read:
    const { safeGetJSON } = await import('../src/lib/safeStorage.ts');
    const order = safeGetJSON<string[]>('me_echo_order', []);
    expect(order).toEqual([]);
    expect(localStorage.getItem('me_echo_order')).toBe(null);
  });

  it('auth boot with unreadable localStorage does not throw', async () => {
    // Simulate SecurityError on every storage op. This is the sandbox
    // / private-browsing failure mode — module import must still
    // succeed and land the user in an unauthenticated state.
    const originalLS = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
        removeItem: () => {
          throw new Error('SecurityError');
        },
        clear: () => {},
        key: () => null,
        length: 0,
      } as unknown as Storage,
      writable: true,
      configurable: true,
    });

    try {
      const { getAccessToken } = await import('../src/lib/api/client.ts');
      // Import completed — no crash-loop seed planted.
      expect(getAccessToken()).toBe(null);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLS,
        writable: true,
        configurable: true,
      });
    }
  });

  it('auth boot with well-formed localStorage hydrates normally', async () => {
    // Regression protection — the happy-path behaviour must not
    // change just because we routed through safeStorage.
    localStorage.setItem('access_token', 'valid-token-abc');
    localStorage.setItem('refresh_token', 'valid-refresh-xyz');

    const { getAccessToken } = await import('../src/lib/api/client.ts');
    expect(getAccessToken()).toBe('valid-token-abc');
  });
});
