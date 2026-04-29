import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Closes the coverage gap noted in community-pulse.test.tsx:17-19 and
 * opened by commit 2cdf3d6, which deleted dashboard-feed.test.tsx. The
 * `t('communityFeed.title')` heading is rendered at three sites in
 * AppLayout.tsx (lines 294, 309, 492); none were covered after the
 * dashboard-feed deletion. This file asserts that contract directly.
 *
 * Scope is intentionally narrow: the heading text is the contract, not
 * the surrounding AppLayout plumbing (sidebars, atmospherics, feed data).
 * All child components are stubbed to null, all stores are mocked to the
 * minimal shape AppLayout reads from them.
 */

// ─── Store mocks ────────────────────────────────────────────────────────
// AppLayout.tsx:148 reads isAuthenticated via selector. If this is false,
// the layout renders `<Navigate to="/login" />` and no heading ever
// mounts, so the auth guard MUST be satisfied for these assertions.
vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ isAuthenticated: true }),
    { getState: () => ({ isAuthenticated: true, logout: vi.fn() }) },
  ),
}));

// AppLayout.tsx:151 (selector for unreadCount badge) +
// AppLayout.tsx:196/199 (getState().fetchNotifications in mount effect +
// 60s polling). Both entry points need to be mocked.
vi.mock('../src/stores/useNotificationStore.ts', () => ({
  useNotificationStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ unreadCount: 0 }),
    {
      getState: () => ({
        fetchNotifications: vi.fn().mockResolvedValue(undefined),
      }),
    },
  ),
}));

// MoodAtmosphereWrapper (AppLayout.tsx:116) reads palette via selector.
// null palette skips the gradient + particle layer — exactly what the
// heading-contract test wants.
vi.mock('../src/stores/useMoodPaletteStore.ts', () => ({
  useMoodPaletteStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ palette: null }),
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

// ─── Child component stubs ──────────────────────────────────────────────
// The heading is rendered by AppLayout itself, not by any child. Stubbing
// children isolates the assertion and prevents their own store / API
// dependencies from bleeding in.
vi.mock('../src/components/OracleSidebar.tsx', () => ({
  OracleSidebar: () => null,
}));
vi.mock('../src/components/CommunitySidebar.tsx', () => ({
  CommunitySidebar: () => null,
}));
vi.mock('../src/components/TickTimer.tsx', () => ({
  TickTimer: () => null,
}));
vi.mock('../src/components/EchoSidebar.tsx', () => ({
  EchoSidebar: () => null,
}));
vi.mock('../src/components/CommunityPulseCard.tsx', () => ({
  CommunityPulseCard: () => null,
}));
vi.mock('../src/components/MoodParticles.tsx', () => ({
  MoodParticles: () => null,
}));

// isTabletDevice() is toggled per test to reach each of the two heading
// render branches (tablet vs desktop). Re-assignable module-scope flag so
// it can be set inside each `it` before render.
let mockIsTablet = false;
vi.mock('../src/lib/deviceDetect.ts', () => ({
  isTabletDevice: () => mockIsTablet,
}));

// Import AFTER mocks are registered.
import { AppLayout } from '../src/components/AppLayout.tsx';

// ─── i18next ────────────────────────────────────────────────────────────
// Distinctive translation string so the assertion cannot be satisfied by
// i18next's missing-key fallback (which echoes the key name).
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'communityFeed.title': 'COMMUNITY_PULSE_HEADING',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-outlet" />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('AppLayout communityFeed.title heading', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // jsdom does not implement matchMedia. AppLayout.tsx:169-173 reads it
    // synchronously during useState init, so it must exist before render.
    // Default returns `matches:false` (non-mobile viewport) — individual
    // tests do not need to override this.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })) as unknown as typeof window.matchMedia;
    mockIsTablet = false;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders the heading in the tablet left pane (AppLayout.tsx:294)', async () => {
    // Tablet branch guard: !isMobileViewport && isTablet && showEchoPanes.
    // /dashboard satisfies showEchoPanes (AppLayout.tsx:205).
    mockIsTablet = true;
    await act(async () => {
      renderAt('/dashboard');
    });
    // Tablet branch renders exactly one Community Pulse heading. The
    // desktop branch is behind `!isTablet` so it does not render here.
    const headings = screen.getAllByText('COMMUNITY_PULSE_HEADING');
    expect(headings).toHaveLength(1);
  });

  it('renders the heading twice on desktop: the ≥1920px aside (AppLayout.tsx:309) and DesktopPulseSection (AppLayout.tsx:492)', async () => {
    // Desktop branch guard: !isMobileViewport && !isTablet && showEchoPanes.
    // Both heading sites (line 309 aside, line 492 DesktopPulseSection)
    // render into the DOM in this branch. CSS (`hidden min-[1920px]:flex`
    // on the aside, `min-[1920px]:hidden` on the section) picks which is
    // visible — but both are present in the tree, which is what the
    // heading-contract test asserts.
    mockIsTablet = false;
    await act(async () => {
      renderAt('/dashboard');
    });
    const headings = screen.getAllByText('COMMUNITY_PULSE_HEADING');
    expect(headings).toHaveLength(2);
  });
});
