import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SettingsPage } from '../src/pages/SettingsPage.tsx';

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: () => ({
    user: { user_id: 'u1', display_name: 'Test', email: 'test@example.com', subscription_tier: 'Free' },
    logout: vi.fn(),
  }),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

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
    getPrivacy: vi.fn().mockResolvedValue({ solo_mode: false, do_not_sell: false }),
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

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/settings']}>
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

  it('renders without crash', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });
});
