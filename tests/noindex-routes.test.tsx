import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NoIndexLayout } from '../src/components/NoIndexLayout.tsx';

/**
 * GSC "Crawled – currently not indexed" regression guard for non-public
 * routes.
 *
 * Pre-auth (register, login, verify, forgot/reset password, onboarding,
 * payment, tip) and authenticated app-shell routes (dashboard, echoes,
 * shards, feeds, community, settings, admin) must never surface in search
 * results. Without `<meta name="robots" content="noindex, nofollow">` on
 * these routes, Googlebot crawls them via external backlinks and files them
 * as low-quality duplicates of the pre-hydration SPA index.html.
 *
 * Not testing AppLayout directly because it pulls in the full auth store,
 * notification store, and ~12 sidebar components — too many mocks. Instead
 * we test the NoIndexLayout primitive that AppLayout uses the same Helmet
 * block for (see AppLayout.tsx top of return for the duplicate directive).
 */

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: { en: { translation: {} } },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function robotsMeta(): string | null {
  const meta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="robots"]',
  );
  return meta ? meta.getAttribute('content') : null;
}

beforeEach(() => {
  document.head.querySelectorAll('meta[name="robots"]').forEach((n) => n.remove());
});

describe('NoIndexLayout — robots noindex on non-public routes', () => {
  it('emits <meta name="robots" content="noindex, nofollow"> for wrapped routes', async () => {
    await act(async () => {
      render(
        <HelmetProvider>
          <I18nextProvider i18n={testI18n}>
            <MemoryRouter initialEntries={['/login']}>
              <Routes>
                <Route element={<NoIndexLayout />}>
                  <Route path="/login" element={<div data-testid="login">Login</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </I18nextProvider>
        </HelmetProvider>,
      );
    });
    expect(robotsMeta()).toBe('noindex, nofollow');
  });

  it('renders the child via <Outlet /> so wrapping does not break the route', async () => {
    const { getByTestId } = render(
      <HelmetProvider>
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route element={<NoIndexLayout />}>
                <Route path="/register" element={<div data-testid="register">Register</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </HelmetProvider>,
    );
    await act(async () => {});
    expect(getByTestId('register')).toBeInTheDocument();
  });

  it('noindex applies to every pre-auth path wrapped by NoIndexLayout', async () => {
    // Parameterized across all pre-auth routes that App.tsx now wraps.
    const preAuthPaths = [
      '/register',
      '/verify-pending',
      '/verified',
      '/login',
      '/forgot-password',
      '/reset-password',
      '/onboarding/welcome',
      '/onboarding/profile',
      '/onboarding/create-echo',
      '/payment/success',
      '/payment/cancelled',
      '/tip',
    ];
    for (const path of preAuthPaths) {
      document.head.querySelectorAll('meta[name="robots"]').forEach((n) => n.remove());
      const { unmount } = render(
        <HelmetProvider>
          <I18nextProvider i18n={testI18n}>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route element={<NoIndexLayout />}>
                  <Route path={path} element={<div />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </I18nextProvider>
        </HelmetProvider>,
      );
      await act(async () => {});
      expect(robotsMeta(), `route ${path}`).toBe('noindex, nofollow');
      unmount();
    }
  });
});
