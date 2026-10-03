import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';
import { useInFlightStore } from '../src/stores/useInFlightStore.ts';

// The in-flight store is one for the whole app, so a marker a test left
// held (a request that never settles) would hold a control in the next
// test. Each test starts with nothing held (R288.8).
beforeEach(() => {
  useInFlightStore.setState({ held: new Set() });
});

// Quiet default for unmocked fetch.
//
// Vitest 3's vite-node module runner silently swallowed unhandled fetch
// rejections; vitest 4's Module Runner surfaces them, so tests that fire
// background fetches without awaiting/catching (e.g. effects mounted in a
// `render()` that then unmount before the promise settles) emit
// `ECONNREFUSED localhost:3000` to stderr — happy-dom's default
// `location.origin` lands fetch on Node's real network stack.
//
// Each test that exercises real network behaviour mocks `fetch` (or the
// `api.*` endpoint modules) directly and that mock wins because `vi.fn` is
// re-applied in the test's own `beforeEach`. This setup is the silent
// floor for the tests that don't.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.reject(
        new Error(
          'Unmocked fetch in tests/. Mock the relevant `api.*` endpoint ' +
            'module in your test, or override `globalThis.fetch` for this ' +
            'spec. See tests/setup.ts.',
        ),
      ),
    ),
  );
});
