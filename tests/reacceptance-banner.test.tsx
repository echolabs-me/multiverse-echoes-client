import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ReacceptanceBanner } from '../src/components/ReacceptanceBanner.tsx';

// ME-ILF-001 §3.1.1 — client-side ToS re-acceptance banner. The
// banner reads `user.requires_tos_reacceptance` + `currentTosVersion`
// from the auth store and lets the user accept the latest version
// inline. The server does not block requests on a stale version, so
// the banner is the entire client-side gate.

const mocks = vi.hoisted(() => ({
  user: null as null | {
    requires_tos_reacceptance: boolean;
  },
  currentTosVersion: null as string | null,
  fetchProfile: vi.fn(async () => undefined),
  acceptTos: vi.fn(async () => ({
    tos_accepted_version: '2026-05-03',
    tos_accepted_at: '2026-05-03T00:00:00Z',
  })),
}));

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: <T,>(selector: (s: unknown) => T): T => {
    const state = {
      user: mocks.user,
      currentTosVersion: mocks.currentTosVersion,
      fetchProfile: mocks.fetchProfile,
    };
    return selector(state);
  },
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: {
    acceptTos: (...args: unknown[]) => mocks.acceptTos(...(args as [string])),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'errors.TOS_VERSION_MISMATCH':
          'The Terms of Service have been updated. Reload and accept the latest version.',
        'errors.profileRefreshFailed':
          'Could not refresh profile. Please reload the page.',
        'legal.tosUpdatedBanner':
          'The Terms of Service have been updated. Accept the latest version to keep using your account.',
        'legal.tosUpdatedAcceptButton': 'Accept',
        'legal.tosUpdatedAccepting': 'Accepting...',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderBanner() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <ReacceptanceBanner />
    </I18nextProvider>,
  );
}

describe('ReacceptanceBanner — ME-ILF-001 §3.1.1', () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.currentTosVersion = null;
    mocks.fetchProfile.mockClear();
    mocks.acceptTos.mockClear();
  });

  afterEach(() => {
    mocks.user = null;
    mocks.currentTosVersion = null;
  });

  it('renders nothing when user has no re-acceptance flag', () => {
    mocks.user = { requires_tos_reacceptance: false };
    mocks.currentTosVersion = '2026-05-03';
    const { container } = renderBanner();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when re-acceptance flag is true but currentTosVersion is null (pre-hydration safety)', () => {
    // Defensive: under correct server config + post-hydration
    // /account/me, currentTosVersion is always populated. This test
    // covers the pre-hydration window between auth-store init and
    // first profile fetch, where rendering an unsubmittable form
    // would be worse than briefly suppressing the banner.
    mocks.user = { requires_tos_reacceptance: true };
    mocks.currentTosVersion = null;
    const { container } = renderBanner();
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner copy + accept button when both signals are present', () => {
    mocks.user = { requires_tos_reacceptance: true };
    mocks.currentTosVersion = '2026-05-03';
    renderBanner();
    expect(
      screen.getByTestId('reacceptance-banner-message').textContent,
    ).toContain('updated');
    expect(
      screen.getByTestId('reacceptance-banner-accept-button').textContent,
    ).toBe('Accept');
  });

  it('clicking Accept calls account.acceptTos with the current version then refetches the profile', async () => {
    mocks.user = { requires_tos_reacceptance: true };
    mocks.currentTosVersion = '2026-05-03';
    renderBanner();
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('reacceptance-banner-accept-button'),
      );
      // Let the queued microtasks drain.
      await Promise.resolve();
    });
    expect(mocks.acceptTos).toHaveBeenCalledWith('2026-05-03');
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });

  // Lane S Block F Copilot remediation — Finding 3.
  // When acceptTos succeeds but fetchProfile rejects, the previous
  // single-try/catch left submitting=true forever. The fix wraps
  // fetchProfile in its own try/catch and resets submitting + surfaces
  // a recoverable error message so the user can retry.
  it('resets submitting and surfaces an error when fetchProfile fails after a successful acceptTos', async () => {
    mocks.user = { requires_tos_reacceptance: true };
    mocks.currentTosVersion = '2026-05-03';
    mocks.acceptTos.mockResolvedValueOnce({
      tos_accepted_version: '2026-05-03',
      tos_accepted_at: '2026-05-03T00:00:00Z',
    });
    mocks.fetchProfile.mockRejectedValueOnce(
      new Error('network failure'),
    );

    renderBanner();
    const button = screen.getByTestId(
      'reacceptance-banner-accept-button',
    ) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(button);
      // Drain the two awaited promises (acceptTos resolve, then
      // fetchProfile reject).
      await Promise.resolve();
      await Promise.resolve();
    });

    // submitting must be false again — button enabled, label restored.
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Accept');

    // Error copy must be the profile-refresh-failed message, NOT the
    // TOS_VERSION_MISMATCH message (acceptTos succeeded — the error
    // is on the refresh, not on the acceptance).
    expect(
      screen.getByTestId('reacceptance-banner-message').textContent,
    ).toBe('Could not refresh profile. Please reload the page.');

    // acceptTos was called once; fetchProfile was called once and rejected.
    expect(mocks.acceptTos).toHaveBeenCalledTimes(1);
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });
});
