import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { account } from '../src/lib/api/endpoints.ts';
import { useAuthStore } from '../src/stores/useAuthStore.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { ReacceptanceBanner } from '../src/components/ReacceptanceBanner.tsx';
import { SettingsPage } from '../src/pages/SettingsPage.tsx';
import type { User } from '../src/types/api.ts';

/**
 * R283.1: `fetchProfile` throws a failure, and each caller shows it. These
 * run the real auth store, with only the endpoints stood in for, so a store
 * that swallows the failure fails them.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  auth: { login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  account: {
    getProfile: vi.fn(),
    acceptTos: vi.fn(),
    cancelDeletion: vi.fn(),
    getSessions: vi.fn().mockResolvedValue([]),
    getPrivacy: vi.fn().mockResolvedValue({
      solo_mode: false,
      do_not_sell: false,
      analytics_opt_out: false,
      community_opt_out: false,
      community_opt_out_cleanup_pending: false,
      profile_visibility: 'Public',
    }),
    getNotificationPreferences: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../src/lib/api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/api/client.ts')>()),
  request: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

vi.mock('../src/stores/useThemeStore.ts', () => ({
  useThemeStore: () => ({
    base: 'dark',
    setBase: vi.fn(),
    overrides: [],
    activeOverrideId: null,
    applyOverride: vi.fn(),
    disable3D: false,
    setDisable3D: vi.fn(),
  }),
}));

vi.mock('../src/lib/sounds.ts', () => ({
  useSoundStore: () => ({
    enabled: true,
    volume: 50,
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
  }),
}));

const text = (key: string) => i18n.t(key);

const baseUser = {
  user_id: 'u1',
  display_name: 'Test',
  email: 'test@example.com',
  subscription_tier: 'Free',
} as unknown as User;

beforeEach(() => {
  vi.mocked(account.getProfile).mockReset();
  vi.mocked(account.acceptTos).mockReset();
  vi.mocked(account.cancelDeletion).mockReset();
  useToastStore.setState({ toasts: [] });
});

describe('a failed profile refresh after the terms are accepted (R283.1)', () => {
  it("shows clientErrors.profileRefreshFailed's text, and the button can be pressed again", async () => {
    useAuthStore.setState({
      user: { ...baseUser, requires_tos_reacceptance: true },
      currentTosVersion: '2026-05-03',
    });
    vi.mocked(account.acceptTos).mockResolvedValue({
      tos_accepted_version: '2026-05-03',
      tos_accepted_at: '2026-05-03T00:00:00Z',
    });
    vi.mocked(account.getProfile).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    render(
      <I18nextProvider i18n={i18n}>
        <ReacceptanceBanner />
      </I18nextProvider>,
    );
    const button = screen.getByTestId(
      'reacceptance-banner-accept-button',
    ) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByTestId('reacceptance-banner-message').textContent).toBe(
      text('clientErrors.profileRefreshFailed'),
    );
    expect(button.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });
    expect(account.acceptTos).toHaveBeenCalledTimes(2);
    expect(account.getProfile).toHaveBeenCalledTimes(2);
  });
});

describe('a failed profile refresh after a deletion is cancelled (R283.1)', () => {
  it('shows its error and leaves the success toast', async () => {
    useAuthStore.setState({
      user: {
        ...baseUser,
        account_status: 'PendingDeletion',
        deletion_scheduled_at: '2026-11-01T00:00:00Z',
      },
      currentTosVersion: null,
    });
    vi.mocked(account.cancelDeletion).mockResolvedValue(undefined as never);
    vi.mocked(account.getProfile).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    await act(async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/settings?tab=danger']}>
            <SettingsPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: text('settings.cancelDeletion') }),
      );
    });

    const toasts = useToastStore
      .getState()
      .toasts.map((t) => [t.message, t.severity]);
    expect(toasts).toEqual([
      [text('settings.deletionCancelled'), 'success'],
      [text('clientErrors.profileRefreshFailed'), 'danger'],
    ]);
  });
});
