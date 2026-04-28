import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AboutPage } from '../src/pages/AboutPage.tsx';

// AboutPage.tsx calls fetch(`${WAITLIST_API}/waitlist/count`) where
// WAITLIST_API = 'https://api.echolabs.me' resolves to the me-waitlist
// Cloudflare Worker host. The Worker is the production source of truth
// (D1-backed, real signup count); the Rust API at api.echolabsme.com
// holds only test entries per the WaitlistPage docstring. If this
// composition ever drifts, AboutPage would either lose its display
// number or silently start showing test data — both cases lock here.
//
// Mock globalThis.fetch so we can both (a) record the URL the page
// actually fetches and (b) feed the page a deterministic count for
// the social-proof number assertion. Mirrors the pattern in
// client/tests/waitlist.test.tsx.
const originalFetch = globalThis.fetch;
const fetchCalls: string[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    fetchCalls.push(url);
    if (url.endsWith('/waitlist/count')) {
      return Promise.resolve(
        new Response(JSON.stringify({ total: 1234 }), { status: 200 }),
      );
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// AboutPage uses a handful of website.about.* keys for body copy. Tests
// don't assert on copy strings (i18next falls back to the key itself
// when missing), so an empty resources block is sufficient — the test
// surface is the network call composition + the rendered count number.
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: { en: { translation: {} } },
  lng: 'en',
  interpolation: { escapeValue: false },
  fallbackLng: 'en',
});

function renderPage() {
  return render(
    <HelmetProvider>
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      </I18nextProvider>
    </HelmetProvider>,
  );
}

describe('AboutPage', () => {
  it('fetches the waitlist count from the me-waitlist Cloudflare Worker host (api.echolabs.me), not the Rust API host', async () => {
    await act(async () => {
      renderPage();
    });
    // The Worker host is intentional per AboutPage's design — D1-backed
    // production signup count. The Rust API at api.echolabsme.com also
    // exposes /waitlist/count but holds only test entries. If this
    // assertion ever flips to api.echolabsme.com, AboutPage would
    // silently display test data instead of the real waitlist number;
    // surface that early.
    expect(fetchCalls).toContain('https://api.echolabs.me/waitlist/count');
  });

  it('renders the live waitlist count (formatted with locale separator) from the count endpoint response', async () => {
    await act(async () => {
      renderPage();
    });
    // AboutPage.tsx renders {waitlistTotal.toLocaleString()} after the
    // count fetch resolves; mock returns 1234 → "1,234" in the en locale.
    expect(await screen.findByText('1,234')).toBeInTheDocument();
  });
});
