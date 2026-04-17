import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { WebsiteLayout } from '../src/components/website/WebsiteLayout.tsx';

// WebsiteNav.tsx:13 reads useAuthStore.getState().isAuthenticated. Provide
// a stub so the nav renders in its unauthenticated branch (shows Waitlist
// CTA + "Enter" link) — the footer contract we're testing is the same
// regardless of auth state.
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

// Keys grep-verified against WebsiteNav.tsx + WebsiteFooter.tsx. The two
// Privacy + Terms labels below (website.footer.privacy / .terms) are the
// assertions under test. Other keys are plumbing so nav + footer render.
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
        // Footer link labels — source contract under test.
        'website.footer.terms': 'Terms',
        'website.footer.privacy': 'Privacy',
        'website.footer.accessibility': 'Accessibility',
        'website.footer.copyright': '© 2026 EchoLabsME Pte. Ltd.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderLayout() {
  // WebsiteLayout renders WebsiteNav + <Outlet /> + WebsiteFooter. Mount
  // it inside a parent Route so <Outlet /> has a child to render (kept
  // intentionally empty — the footer contract is what we're asserting).
  return render(
    <HelmetProvider>
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route element={<WebsiteLayout />}>
              <Route path="/home" element={<div data-testid="child" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </HelmetProvider>,
  );
}

describe('WebsiteLayout', () => {
  it('footer renders Privacy link to /privacy', async () => {
    await act(async () => {
      renderLayout();
    });
    // WebsiteFooter.tsx:93-95 renders <Link to="/privacy">{t('website.footer.privacy')}</Link>.
    const link = screen.getByRole('link', { name: 'Privacy' });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('footer renders Terms link to /terms', async () => {
    await act(async () => {
      renderLayout();
    });
    // WebsiteFooter.tsx:90-92 renders <Link to="/terms">{t('website.footer.terms')}</Link>.
    const link = screen.getByRole('link', { name: 'Terms' });
    expect(link).toHaveAttribute('href', '/terms');
  });
});
