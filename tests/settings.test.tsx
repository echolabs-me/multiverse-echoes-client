import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SettingsPage } from '../src/pages/SettingsPage.tsx';
import { account, feedback } from '../src/lib/api/endpoints.ts';
import { formatDate, formatDateTime } from '../src/lib/formatDate.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { useAuthStore } from '../src/stores/useAuthStore.ts';
import type { User } from '../src/types/api.ts';

// A zustand store with the auth store's shape, so the page reads it as it
// reads the real one and a test can sign one account out and another in,
// or load a profile (R296.1).
vi.mock('../src/stores/useAuthStore.ts', async () => {
  const { create } = await import('zustand');
  return {
    useAuthStore: create<{
      user: User | null;
      isAuthenticated: boolean;
      logout: () => void;
    }>(() => ({
      user: signedIn('u1'),
      isAuthenticated: true,
      logout: vi.fn(),
    })),
  };
});

function signedIn(userId: string): User {
  return {
    user_id: userId,
    email: 'test@example.com',
    email_verified: true,
    display_name: 'Test',
    display_name_slug: 'test',
    account_type: 'Standard',
    subscription_tier: 'Free',
    created_at: '2026-10-03T00:00:00Z',
    updated_at: '2026-10-03T00:00:00Z',
    last_login_at: '2026-10-03T00:00:00Z',
    account_status: 'Active',
    locale: 'en',
    timezone: null,
    onboarding_complete: true,
    tos_accepted_at: '2026-10-03T00:00:00Z',
    tos_version: '2026-05-03',
    privacy_accepted_at: '2026-10-03T00:00:00Z',
    privacy_version: '2026-05-03',
    current_tos_version: '2026-05-03',
    requires_tos_reacceptance: false,
    echo_count_limit: 1,
    solo_mode: false,
    deletion_scheduled_at: null,
    do_not_sell: false,
    analytics_opt_out: false,
    bio: null,
    avatar_url: null,
    profile_visibility: 'Public',
  };
}

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
    discordStatus: vi
      .fn()
      .mockResolvedValue({ linked: false, discord_username: null }),
    linkDiscord: vi.fn(),
    unlinkDiscord: vi.fn(),
  },
  feedback: {
    myFeedback: vi.fn().mockResolvedValue([]),
  },
}));

// The real error class: the translator tells a server error from any
// other by it (R264).
vi.mock('../src/lib/api/client.ts', async (importOriginal) => ({
  ApiRequestError: (
    await importOriginal<typeof import('../src/lib/api/client.ts')>()
  ).ApiRequestError,
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
        'settings.deleteAccountWarning':
          'This will permanently delete your account',
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
        // R284.5: each label and its value are one key. The test text
        // differs from what code once wrote, so a join in code fails here.
        'settings.feedbackSubmittedOn': 'Sent {{date}}',
        'settings.feedbackResolutionValue': 'Resolved as: {{notes}}',
        'settings.sessionName': 'Login {{id}}',
        'settings.sessionLastActive': 'Seen {{date}}',
        // Rule 14: the Discord section's own sentence is a key.
        'settings.discordLinkDesc': 'Join your Discord here.',
        // R284.5: the preference's label is one key.
        'settings.prefSelectLabel': 'Choose for {{label}}',
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

// A test that sets a write's answer leaves it set, and a reset at the end
// of a test body does not run when the test fails, so each test's writes
// are reset here (R288.7).
afterEach(() => {
  vi.mocked(account.updatePrivacy).mockReset();
  vi.mocked(account.updateNotificationPreferences).mockReset();
  useAuthStore.setState({ user: signedIn('u1'), isAuthenticated: true });
});

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
    expect(account.updatePrivacy).toHaveBeenCalledWith({
      community_opt_out: true,
    });
    expect(toggle).toBeChecked();
  });

  it('reads a stored opt-out as on', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValueOnce(privacy(true, false));
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    expect(
      screen.getByRole('checkbox', { name: 'Community opt-out' }),
    ).toBeChecked();
  });

  it('shows an unfinished clean-up with the toggle on, the notice and a retry', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValueOnce(privacy(true, true));
    await act(async () => {
      renderPage('/settings?tab=privacy');
    });
    expect(
      screen.getByRole('checkbox', { name: 'Community opt-out' }),
    ).toBeChecked();
    expect(screen.getByText(PENDING_NOTICE)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
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
    expect(account.updatePrivacy).toHaveBeenCalledWith({
      community_opt_out: true,
    });
    expect(screen.queryByText(PENDING_NOTICE)).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Community opt-out' }),
    ).toBeChecked();
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

  it("shows a feedback item's date and resolution as one key's text each, with its value (R284.5)", async () => {
    vi.mocked(feedback.myFeedback).mockResolvedValueOnce([
      {
        feedback_id: 'f1',
        user_id: 'u1',
        feedback_type: 'Bug',
        user_message: 'The page broke.',
        structured_summary: 'A page broke.',
        context: { screen: 'settings', recent_events: [] },
        status: 'Resolved',
        priority: null,
        github_issue_url: null,
        resolution_notes: 'Fixed in the next build.',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-02T00:00:00Z',
      },
    ]);
    await act(async () => {
      renderPage('/settings?tab=feedback');
    });
    expect(
      screen.getByText(`Sent ${formatDate('2026-10-01T00:00:00Z')}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Resolved as: Fixed in the next build.'),
    ).toBeInTheDocument();
  });

  it("shows a session's name and last activity as one key's text each, with its value (R284.5)", async () => {
    vi.mocked(account.getSessions).mockResolvedValueOnce([
      {
        session_id: 'abcdef0123456789',
        created_at: '2026-10-01T00:00:00Z',
        last_active: '2026-10-02T08:30:00Z',
        current: false,
      },
    ]);
    await act(async () => {
      renderPage('/settings?tab=account');
    });
    expect(screen.getByText('Login abcdef01...')).toBeInTheDocument();
    expect(
      screen.getByText(`Seen ${formatDateTime('2026-10-02T08:30:00Z')}`),
    ).toBeInTheDocument();
  });

  describe('each write sends once (R265)', () => {
    const never = () => new Promise<never>(() => {});

    // A checkbox's change also comes from a click.
    async function twice(el: HTMLElement) {
      await act(async () => {
        fireEvent.click(el);
        fireEvent.click(el);
      });
    }

    it('revoking a session', async () => {
      vi.mocked(account.getSessions).mockResolvedValueOnce([
        {
          session_id: 'abcdef0123456789',
          created_at: '2026-10-01T00:00:00Z',
          last_active: '2026-10-02T08:30:00Z',
          current: false,
        },
      ]);
      vi.mocked(account.revokeSession).mockReturnValueOnce(never());
      await act(async () => {
        renderPage('/settings?tab=account');
      });
      const revoke = screen.getByRole('button', { name: 'Revoke' });
      await twice(revoke);
      expect(account.revokeSession).toHaveBeenCalledTimes(1);
      expect(revoke).toBeDisabled();
    });

    it('the privacy toggles and the opt-out retry', async () => {
      vi.mocked(account.getPrivacy).mockResolvedValueOnce(privacy(true, true));
      vi.mocked(account.updatePrivacy).mockReturnValue(never());
      await act(async () => {
        renderPage('/settings?tab=privacy');
      });
      const solo = screen.getByLabelText('Solo Mode');
      await twice(solo);
      expect(account.updatePrivacy).toHaveBeenCalledTimes(1);
      expect(solo).toBeDisabled();

      // The toggle and the Retry button send the same write, so they hold
      // one marker.
      const optOut = screen.getByLabelText('Community opt-out');
      const retry = screen.getByRole('button', { name: 'Try again' });
      await twice(retry);
      expect(account.updatePrivacy).toHaveBeenCalledTimes(2);
      expect(retry).toBeDisabled();
      expect(optOut).toBeDisabled();

      const doNotSell = screen.getByLabelText('settings.doNotSellLabel');
      await twice(doNotSell);
      expect(account.updatePrivacy).toHaveBeenCalledTimes(3);
      expect(doNotSell).toBeDisabled();
    });

    it('the community opt-out toggle', async () => {
      vi.mocked(account.updatePrivacy).mockReturnValue(never());
      await act(async () => {
        renderPage('/settings?tab=privacy');
      });
      const optOut = screen.getByLabelText('Community opt-out');
      await twice(optOut);
      expect(account.updatePrivacy).toHaveBeenCalledTimes(1);
      expect(optOut).toBeDisabled();
    });

    it('a notification preference', async () => {
      vi.mocked(account.getNotificationPreferences).mockResolvedValueOnce({
        echo_life_events: 'InApp',
        daily_digest: 'InApp',
        social: 'InApp',
        community: 'InApp',
        shard_activity: 'InApp',
        platform: 'InApp',
        marketplace: 'InApp',
        billing: 'InApp',
        moderation: 'InApp',
        account: 'InApp',
      } as never);
      vi.mocked(account.updateNotificationPreferences).mockReturnValueOnce(
        never(),
      );
      await act(async () => {
        renderPage('/settings?tab=notifications');
      });
      const [first] = screen.getAllByRole('combobox');
      expect(first.getAttribute('aria-label')).toMatch(/^Choose for \S/);
      await act(async () => {
        fireEvent.change(first, { target: { value: 'Off' } });
        fireEvent.change(first, { target: { value: 'InAppAndEmail' } });
      });
      expect(account.updateNotificationPreferences).toHaveBeenCalledTimes(1);
      expect(first).toBeDisabled();
    });

    it('two preferences saved together, the first response arriving last, both show their saved values (R285.4)', async () => {
      const prefs = {
        echo_life_events: 'InApp',
        daily_digest: 'InApp',
        social: 'InApp',
        community: 'InApp',
        shard_activity: 'InApp',
        platform: 'InApp',
        marketplace: 'InApp',
        billing: 'InApp',
        moderation: 'InApp',
        account: 'InApp',
      };
      vi.mocked(account.getNotificationPreferences).mockResolvedValueOnce(
        prefs as never,
      );
      // Each response carries every preference, as the server holds them
      // when it answers.
      const answers: Array<(v: unknown) => void> = [];
      vi.mocked(account.updateNotificationPreferences).mockImplementation(
        () =>
          new Promise((resolve) => {
            answers.push(resolve as (v: unknown) => void);
          }) as never,
      );
      await act(async () => {
        renderPage('/settings?tab=notifications');
      });
      const [lifeEvents, digest] = screen.getAllByRole('combobox');
      await act(async () => {
        fireEvent.change(lifeEvents, { target: { value: 'Off' } });
      });
      await act(async () => {
        fireEvent.change(digest, { target: { value: 'InAppAndEmail' } });
      });
      expect(answers).toHaveLength(2);
      await act(async () => {
        answers[1]({ ...prefs, daily_digest: 'InAppAndEmail' });
      });
      // The first save's answer comes last, written before the second
      // save reached the server.
      await act(async () => {
        answers[0]({ ...prefs, echo_life_events: 'Off' });
      });
      expect(lifeEvents).toHaveValue('Off');
      expect(digest).toHaveValue('InAppAndEmail');
    });

    it("shows the Discord section's sentence from its key (Rule 14)", async () => {
      await act(async () => {
        renderPage('/settings?tab=account');
      });
      expect(screen.getByText('Join your Discord here.')).toBeInTheDocument();
    });

    it('linking Discord', async () => {
      vi.mocked(account.linkDiscord).mockReturnValueOnce(never());
      await act(async () => {
        renderPage('/settings?tab=account');
      });
      const link = screen.getByRole('button', { name: 'Link Discord' });
      await twice(link);
      expect(account.linkDiscord).toHaveBeenCalledTimes(1);
      expect(link).toBeDisabled();
    });

    it('unlinking Discord', async () => {
      vi.mocked(account.discordStatus).mockResolvedValueOnce({
        linked: true,
        discord_username: 'tester',
      } as never);
      vi.mocked(account.unlinkDiscord).mockReturnValueOnce(never());
      await act(async () => {
        renderPage('/settings?tab=account');
      });
      const unlink = screen.getByRole('button', {
        name: 'settings.unlinkDiscord',
      });
      await twice(unlink);
      expect(account.unlinkDiscord).toHaveBeenCalledTimes(1);
      expect(unlink).toBeDisabled();
    });
  });

  describe('a held write belongs to the session that sent it (R296.1)', () => {
    const never = () => new Promise<never>(() => {});
    const doNotSell = () => screen.getByLabelText('settings.doNotSellLabel');

    /** Sets the auth store as the app does, one change at a time. */
    async function auth(state: { user?: User | null; isAuthenticated?: boolean }) {
      await act(async () => {
        useAuthStore.setState(state);
      });
    }

    /**
     * Account u1 signs out, and u2 signs in on the same tab: the sign-in
     * sets `isAuthenticated`, and u2's profile arrives after it.
     */
    async function switchAccount() {
      await auth({ user: null, isAuthenticated: false });
      await auth({ isAuthenticated: true });
      await auth({ user: signedIn('u2') });
    }

    /** Turns Do Not Sell on with a request that never settles. */
    async function sendHeldWrite() {
      vi.mocked(account.updatePrivacy).mockReturnValue(never());
      await act(async () => {
        renderPage('/settings?tab=privacy');
      });
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(doNotSell()).toBeDisabled();
    }

    it('a write sent while the profile loads stays held when the profile arrives', async () => {
      // A sign-in sets `isAuthenticated` before the profile is read, so the
      // session starts with no user id.
      await auth({ user: null, isAuthenticated: false });
      await auth({ isAuthenticated: true });
      await sendHeldWrite();

      await auth({ user: signedIn('u1') });
      expect(doNotSell()).toBeDisabled();
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(account.updatePrivacy).toHaveBeenCalledTimes(1);
    });

    it('the user id changing to another id, signed in throughout, starts a new session', async () => {
      await sendHeldWrite();

      await auth({ user: signedIn('u2') });
      expect(doNotSell()).toBeEnabled();
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(account.updatePrivacy).toHaveBeenCalledTimes(2);
    });

    it('the user id going absent and coming back as another id starts a new session', async () => {
      await sendHeldWrite();

      await auth({ user: null });
      expect(doNotSell()).toBeDisabled();
      await auth({ user: signedIn('u2') });
      expect(doNotSell()).toBeEnabled();
    });

    it("a write in flight for one account leaves the next account's control enabled, and its write is sent", async () => {
      vi.mocked(account.updatePrivacy).mockReturnValue(never());
      await act(async () => {
        renderPage('/settings?tab=privacy');
      });
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(doNotSell()).toBeDisabled();

      await switchAccount();
      expect(doNotSell()).toBeEnabled();
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(account.updatePrivacy).toHaveBeenCalledTimes(2);
      expect(doNotSell()).toBeDisabled();
    });

    it("the first account's request settling leaves the next account's write held", async () => {
      let settleFirst!: () => void;
      vi.mocked(account.updatePrivacy)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            settleFirst = () => resolve(privacy(false, false));
          }),
        )
        .mockReturnValue(never());
      await act(async () => {
        renderPage('/settings?tab=privacy');
      });
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      await switchAccount();
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(doNotSell()).toBeDisabled();

      await act(async () => {
        settleFirst();
      });
      expect(doNotSell()).toBeDisabled();
      await act(async () => {
        fireEvent.click(doNotSell());
      });
      expect(account.updatePrivacy).toHaveBeenCalledTimes(2);
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
