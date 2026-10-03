import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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
const mockLogout = vi.hoisted(() => vi.fn());
// The mock answers `subscribe` as the store does; it never changes, so it
// notifies nobody (R296.1).
vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ isAuthenticated: true, logout: mockLogout }),
    {
      getState: () => ({ isAuthenticated: true, logout: mockLogout }),
      subscribe: () => () => {},
    },
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
import { DeleteAccountPage } from '../src/pages/DeleteAccountPage.tsx';
import { account } from '../src/lib/api/endpoints.ts';
import { useInFlightStore } from '../src/stores/useInFlightStore.ts';
import { markers } from '../src/lib/inFlightMarkers.ts';

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
            <Route
              path="/settings/delete-account"
              element={<DeleteAccountPage />}
            />
          </Route>
          <Route path="/login" element={<div data-testid="login-page" />} />
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

describe('AppLayout logout (R265)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    mockLogout.mockReset();
    mockLogout.mockReturnValue(new Promise(() => {}));
  });

  // A spy a test sets on an endpoint is restored after it, here rather than
  // in the test body, so a failing test restores it too (R288.7, R294.4).
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Opens the delete page with DELETE typed into its field. */
  async function deletePageReady() {
    mockIsTablet = false;
    await act(async () => {
      renderAt('/settings/delete-account');
    });
    fireEvent.change(screen.getByPlaceholderText('DELETE'), {
      target: { value: 'DELETE' },
    });
  }

  // A held write belongs to the session now (R296.1).
  const holdLogout = () => {
    const { session, hold } = useInFlightStore.getState();
    return hold(session, markers.logout());
  };

  it('a double click sends one logout', async () => {
    mockIsTablet = false;
    await act(async () => {
      renderAt('/dashboard');
    });
    // The test i18n has no `auth.logout`, so the label is the key.
    const logout = screen.getByRole('button', { name: 'auth.logout' });
    await act(async () => {
      fireEvent.click(logout);
      fireEvent.click(logout);
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("the delete-account page's logout in flight disables the sidebar's, and one logout is sent (R288.5)", async () => {
    vi.spyOn(account, 'deleteAccount').mockResolvedValue(undefined as never);
    mockIsTablet = false;
    await act(async () => {
      renderAt('/settings/delete-account');
    });
    fireEvent.change(screen.getByPlaceholderText('DELETE'), {
      target: { value: 'DELETE' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'settings.deleteAccount' }),
      );
    });
    const logout = screen.getByRole('button', { name: 'auth.logout' });
    expect(logout).toBeDisabled();
    await act(async () => {
      fireEvent.click(logout);
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('a logout held elsewhere disables the delete button (R294.2)', async () => {
    holdLogout();
    await deletePageReady();
    expect(
      screen.getByRole('button', { name: 'settings.deleteAccount' }),
    ).toBeDisabled();
  });

  it('a logout held elsewhere when the deletion lands: the delete page sends no logout and does not navigate (R294.3)', async () => {
    let deleted!: () => void;
    vi.spyOn(account, 'deleteAccount').mockReturnValue(
      new Promise<void>((resolve) => {
        deleted = resolve;
      }) as never,
    );
    await deletePageReady();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'settings.deleteAccount' }),
      );
    });
    holdLogout();
    await act(async () => {
      deleted();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });
});
