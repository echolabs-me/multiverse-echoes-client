import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SettingsPage } from '../src/pages/SettingsPage.tsx';
import { account } from '../src/lib/api/endpoints.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: () => ({
    user: { user_id: 'u1', display_name: 'Test', email: 'test@example.com', subscription_tier: 'Free' },
    logout: vi.fn(),
  }),
}));

// The page reads the store through a selector, so the mock applies it.
vi.mock('../src/stores/useToastStore.ts', () => {
  const state = { addToast: vi.fn() };
  return {
    useToastStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

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

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: {
    updateProfile: vi.fn(),
    getSessions: vi.fn().mockResolvedValue([]),
    changePassword: vi.fn(),
    revokeSession: vi.fn(),
    getPrivacy: vi.fn().mockResolvedValue({
      solo_mode: false,
      do_not_sell: false,
      analytics_opt_out: false,
      community_opt_out: false,
      community_opt_out_cleanup_pending: false,
      profile_visibility: 'Public',
    }),
    updatePrivacy: vi.fn(),
    getNotificationPreferences: vi.fn().mockResolvedValue({}),
    updateNotificationPreferences: vi.fn(),
    cancelDeletion: vi.fn(),
  },
}));

vi.mock('../src/lib/api/client.ts', () => ({
  request: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'settings.title': 'Settings',
        'settings.profile': 'Profile',
        'settings.account': 'Account',
        'settings.privacy': 'Privacy',
        'settings.notificationPrefs': 'Notifications',
        'settings.appearance': 'Appearance',
        'settings.apiKeys': 'API Keys',
        'settings.dangerZone': 'Danger Zone',
        'settings.displayNameSaved': 'Saved',
        'settings.changePassword': 'Change Password',
        'settings.currentPassword': 'Current password',
        'settings.newPassword': 'New password',
        'settings.confirmNewPassword': 'Confirm new password',
        'settings.passwordMismatchChange': 'Passwords do not match',
        'settings.sessions': 'Sessions',
        'settings.currentSession': 'Current',
        'settings.sessionRevoked': 'Revoked',
        'settings.noSessions': 'No sessions',
        'settings.revokeSession': 'Revoke',
        'settings.discord': 'Discord',
        'settings.discordComingSoon': 'Coming soon',
        'settings.linkDiscord': 'Link Discord',
        'settings.soloMode': 'Solo Mode',
        'settings.soloModeDesc': 'Hide your echoes from other users',
        'settings.communityOptOut': 'Community opt-out',
        'settings.communityOptOutDesc':
          'Turning it on removes your name from your past channel messages. Turning it off again does not restore it.',
        'settings.communityOptOutPending':
          'Your setting is saved, but removing your name did not finish.',
        'settings.communityOptOutRetry': 'Try again',
        'settings.exportData': 'Export Data',
        'settings.privacyPolicy': 'Privacy Policy',
        'settings.theme': 'Theme',
        'settings.darkMode': 'Dark',
        'settings.lightMode': 'Light',
        'settings.customThemes': 'Custom Themes',
        'settings.3dEnvironments': '3D Environments',
        'settings.enable3D': 'Enable 3D',
        'settings.3dDescription': '3D shard previews',
        'settings.language': 'Language',
        'settings.languageNote': 'Language setting',
        'settings.apiKeyComingSoon': 'Coming soon',
        'settings.createApiKey': 'Create API Key',
        'settings.deleteAccountWarning': 'This will permanently delete your account',
        'settings.deleteAccount': 'Delete Account',
        'settings.deleteAccountConfirm': 'Type DELETE to confirm',
        'settings.cancelDeletion': 'Cancel Deletion',
        'settings.deleteAccountGrace': '30-day grace period',
        'settings.sound': 'Sound',
        'settings.soundEnabled': 'Sound enabled',
        'settings.soundVolume': 'Volume',
        'settings.inAppOnly': 'In-App Only',
        'settings.inAppAndEmail': 'In-App + Email',
        'settings.off': 'Off',
        'settings.prefEchoLifeEvent': 'Echo Life Events',
        'settings.prefDiary': 'Diary',
        'settings.prefCommunity': 'Community',
        'settings.prefFollowers': 'Followers',
        'settings.prefSystem': 'System',
        'settings.prefTravel': 'Travel',
        'settings.prefInfluence': 'Influence',
        'settings.prefDigest': 'Daily Digest',
        'settings.notSet': 'Not set',
        'auth.displayName': 'Display name',
        'auth.email': 'Email',
        'auth.passwordHint': 'At least 12 characters',
        'onboarding.timezone': 'Timezone',
        'common.back': 'Back',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

const PENDING_NOTICE =
  'Your setting is saved, but removing your name did not finish.';

/** A privacy response with the community opt-out flags set as given. */
function privacy(community_opt_out: boolean, cleanup_pending: boolean) {
  return {
    solo_mode: false,
    do_not_sell: false,
    analytics_opt_out: false,
    community_opt_out,
    community_opt_out_cleanup_pending: cleanup_pending,
    profile_visibility: 'Public' as const,
  };
}

function renderPage(path = '/settings') {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[path]}>
        <SettingsPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('SettingsPage', () => {
  it('renders settings tabs', async () => {
    await act(async () => {
      renderPage();
    });
    const profileElements = screen.getAllByText('Profile');
    expect(profileElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  it('shows the community opt-out toggle with what turning it on does', async () => {
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    const toggle = screen.getByRole('checkbox', { name: 'Community opt-out' });
    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText(
        'Turning it on removes your name from your past channel messages. Turning it off again does not restore it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(PENDING_NOTICE)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('turns the community opt-out on and shows the stored setting', async () => {
    vi.mocked(account.updatePrivacy).mockResolvedValueOnce({
      ...privacy(true, false),
      updated_at: '2026-09-30T00:00:00Z',
    });
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    const toggle = screen.getByRole('checkbox', { name: 'Community opt-out' });
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(account.updatePrivacy).toHaveBeenCalledWith({ community_opt_out: true });
    expect(toggle).toBeChecked();
  });

  it('reads a stored opt-out as on', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValueOnce(privacy(true, false));
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    expect(screen.getByRole('checkbox', { name: 'Community opt-out' })).toBeChecked();
  });

  it('shows an unfinished clean-up with the toggle on, the notice and a retry', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValueOnce(privacy(true, true));
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    expect(screen.getByRole('checkbox', { name: 'Community opt-out' })).toBeChecked();
    expect(screen.getByText(PENDING_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('retries the clean-up by sending the opt-out on again, and drops the notice once it finishes', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValueOnce(privacy(true, true));
    vi.mocked(account.updatePrivacy).mockClear();
    vi.mocked(account.updatePrivacy).mockResolvedValueOnce({
      ...privacy(true, false),
      updated_at: '2026-09-30T00:00:00Z',
    });
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });
    expect(account.updatePrivacy).toHaveBeenCalledTimes(1);
    expect(account.updatePrivacy).toHaveBeenCalledWith({ community_opt_out: true });
    expect(screen.queryByText(PENDING_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Community opt-out' })).toBeChecked();
  });

  it('re-reads the stored settings after a failed request', async () => {
    vi.mocked(account.getPrivacy).mockClear();
    vi.mocked(account.getPrivacy)
      .mockResolvedValueOnce(privacy(false, false))
      .mockResolvedValueOnce(privacy(true, true));
    vi.mocked(account.updatePrivacy).mockRejectedValueOnce(new Error('503'));
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    const toggle = screen.getByRole('checkbox', { name: 'Community opt-out' });
    expect(toggle).not.toBeChecked();
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(account.getPrivacy).toHaveBeenCalledTimes(2);
    expect(toggle).toBeChecked();
    expect(screen.getByText(PENDING_NOTICE)).toBeInTheDocument();
  });

  it('tells the user when the privacy settings cannot be read', async () => {
    const { addToast } = (
      useToastStore as unknown as () => { addToast: ReturnType<typeof vi.fn> }
    )();
    addToast.mockClear();
    vi.mocked(account.getPrivacy).mockRejectedValueOnce(new Error('500'));
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('Error', 'danger', {
      platformLink: true,
    });
  });

  it('renders without crash', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });
});
