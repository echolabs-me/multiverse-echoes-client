import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { WebsiteLayout } from '../src/components/website/WebsiteLayout.tsx';
import { HreflangTags } from '../src/components/website/HreflangTags.tsx';

/**
 * GSC "Duplicate without user-selected canonical" regression guard.
 *
 * CF Pages 308-redirects `/foo` -> `/foo/`. If our canonical/hreflang/og:url
 * tags emit the no-slash form, Google flags the page as duplicate because
 * the declared canonical URL immediately redirects back to the crawl URL.
 * These tests lock in the trailing-slash canonical form on every URL form
 * a user might hit.
 */

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ isAuthenticated: false }),
    { getState: () => ({ isAuthenticated: false }) },
  ),
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'auth.joinWaitlist': 'Join the Waitlist',
        'common.openMenu': 'Open menu',
        'common.closeMenu': 'Close menu',
        'website.nav.home': 'Home',
        'website.nav.features': 'Features',
        'website.nav.pricing': 'Pricing',
        'website.nav.about': 'About',
        'website.nav.contact': 'Contact',
        'website.nav.language': 'Language',
        'website.nav.dashboard': 'Dashboard',
        'website.nav.enter': 'Enter',
        'website.hero.subheadline': 'ALSP.',
        'website.footer.terms': 'Terms',
        'website.footer.privacy': 'Privacy',
        'website.footer.accessibility': 'Accessibility',
        'website.footer.copyright': '(c) 2026 EchoLabsME',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderAtPath(initialEntry: string) {
  return render(
    <HelmetProvider>
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<WebsiteLayout />}>
              {/* Match the pathname portion of the URL so the route
                  renders regardless of query/hash. */}
              <Route path="/bn/contact" element={<div data-testid="child" />} />
              <Route path="/contact" element={<div data-testid="child" />} />
              <Route path="/home" element={<div data-testid="child" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </HelmetProvider>,
  );
}

function canonicalHrefFromHead(): string | null {
  const link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  return link ? link.getAttribute('href') : null;
}

function hreflangHrefs(): Record<string, string> {
  const links = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]'),
  );
  const out: Record<string, string> = {};
  for (const link of links) {
    const hl = link.getAttribute('hreflang');
    const href = link.getAttribute('href');
    if (hl && href) out[hl] = href;
  }
  return out;
}

function ogUrlFromHead(): string | null {
  const meta = document.head.querySelector<HTMLMetaElement>(
    'meta[property="og:url"]',
  );
  return meta ? meta.getAttribute('content') : null;
}

beforeEach(() => {
  // Helmet persists tags across renders within the same document — clear
  // them so each test case starts from a clean head.
  document.head.querySelectorAll('link[rel="canonical"]').forEach((n) => n.remove());
  document.head.querySelectorAll('link[rel="alternate"]').forEach((n) => n.remove());
  document.head
    .querySelectorAll('meta[property="og:url"]')
    .forEach((n) => n.remove());
});

describe('Canonical tag — four URL forms produce the identical trailing-slash canonical', () => {
  const EXPECTED = 'https://echolabsme.com/bn/contact/';

  it('/bn/contact (no trailing slash) -> canonical has trailing slash', async () => {
    await act(async () => {
      renderAtPath('/bn/contact');
    });
    expect(canonicalHrefFromHead()).toBe(EXPECTED);
  });

  it('/bn/contact/ (trailing slash) -> canonical unchanged', async () => {
    await act(async () => {
      renderAtPath('/bn/contact/');
    });
    expect(canonicalHrefFromHead()).toBe(EXPECTED);
  });

  it('/bn/contact?lng=bn (query string) -> canonical has no query and trailing slash', async () => {
    await act(async () => {
      renderAtPath('/bn/contact?lng=bn');
    });
    expect(canonicalHrefFromHead()).toBe(EXPECTED);
  });

  it('/bn/contact#anchor (hash) -> canonical has no hash and trailing slash', async () => {
    await act(async () => {
      renderAtPath('/bn/contact#anchor');
    });
    expect(canonicalHrefFromHead()).toBe(EXPECTED);
  });

  it('og:url matches canonical (same trailing-slash form)', async () => {
    await act(async () => {
      renderAtPath('/bn/contact');
    });
    expect(ogUrlFromHead()).toBe(EXPECTED);
  });
});

describe('Hreflang alternates — every href carries a trailing slash', () => {
  it('/bn/contact renders hreflang URLs ending in /', async () => {
    await act(async () => {
      renderAtPath('/bn/contact');
    });
    const hrefs = hreflangHrefs();
    // 21 locale entries (en, zh-Hans, ..., ms). x-default points at the
    // flag picker (`/`), which is root and doesn't gain a slash.
    const nonDefaultLocales = Object.entries(hrefs).filter(
      ([hl]) => hl !== 'x-default',
    );
    expect(nonDefaultLocales.length).toBe(21);
    for (const [hl, href] of nonDefaultLocales) {
      expect(href.endsWith('/'), `hreflang=${hl} href=${href}`).toBe(true);
    }
    // Specific regression locks for a couple of known-tricky locales.
    expect(hrefs.bn).toBe('https://echolabsme.com/bn/contact/');
    expect(hrefs.en).toBe('https://echolabsme.com/contact/');
    expect(hrefs['zh-Hans']).toBe('https://echolabsme.com/zh-Hans/contact/');
    expect(hrefs['pt-BR']).toBe('https://echolabsme.com/pt-BR/contact/');
  });

  it('/contact (English, unprefixed) renders hreflang URLs ending in /', async () => {
    await act(async () => {
      renderAtPath('/contact');
    });
    const hrefs = hreflangHrefs();
    expect(hrefs.en).toBe('https://echolabsme.com/contact/');
    expect(hrefs.bn).toBe('https://echolabsme.com/bn/contact/');
  });

  it('HreflangTags alone (without WebsiteLayout) also produces trailing-slash URLs', async () => {
    // Narrower regression guard: isolates the HreflangTags component so a
    // future refactor that moves canonical emission out of WebsiteLayout
    // can't mask an HreflangTags regression here.
    await act(async () => {
      render(
        <HelmetProvider>
          <I18nextProvider i18n={testI18n}>
            <MemoryRouter initialEntries={['/es/plans']}>
              <Routes>
                <Route path="/es/plans" element={<HreflangTags />} />
              </Routes>
            </MemoryRouter>
          </I18nextProvider>
        </HelmetProvider>,
      );
    });
    const hrefs = hreflangHrefs();
    expect(hrefs.es).toBe('https://echolabsme.com/es/plans/');
    expect(hrefs.en).toBe('https://echolabsme.com/plans/');
  });
});
