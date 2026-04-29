import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SettingsPage } from '../src/pages/SettingsPage.tsx';

// ME-MIS-001 §5.2 Surface D — Account → Subscription pending-deletion
// list. Renders SettingsPage with `?tab=account` so the AccountSection
// mounts (which is where `PendingDeletionsCard` lives). The card
// fetches echoes + shards, filters down to hibernated + archived, and
// renders them sorted by deletion date ascending.

const mocks = vi.hoisted(() => {
  return {
    echoesList: [] as unknown[],
    shardsList: [] as unknown[],
    // `throwOn` flips the echoes.list() mock from resolve → reject,
    // which is what the amended PendingDeletionsCard needs to reach
    // the `error` state. Per-test beforeEach resets to false.
    throwOn: false,
    getSessions: async () => [] as unknown[],
    getPrivacy: async () => ({ solo_mode: false, do_not_sell: false }),
    getNotificationPreferences: async () => ({}),
  };
});

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: {
    updateProfile: vi.fn(),
    getSessions: () => mocks.getSessions(),
    changePassword: vi.fn(),
    revokeSession: vi.fn(),
    getPrivacy: () => mocks.getPrivacy(),
    updatePrivacy: vi.fn(),
    getNotificationPreferences: () => mocks.getNotificationPreferences(),
    updateNotificationPreferences: vi.fn(),
    cancelDeletion: vi.fn(),
    // SettingsPage.tsx:819 fires `accountApi.discordStatus()` on the
    // mount effect of a sibling section component. Missing this
    // would surface as an unhandled rejection + test suite failure.
    discordStatus: vi.fn().mockResolvedValue({ linked: false }),
    linkDiscord: vi.fn(),
    unlinkDiscord: vi.fn(),
  },
  echoes: {
    list: async () => {
      if (mocks.throwOn) throw new Error('stub network failure');
      return mocks.echoesList;
    },
  },
  shards: {
    list: async () => mocks.shardsList,
  },
  feedback: {
    myFeedback: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/lib/api/client.ts', () => ({
  request: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: {
        user_id: 'u1',
        display_name: 'Test',
        email: 't@example.com',
        subscription_tier: 'Core',
      },
      logout: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
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
        'settings.myFeedback': 'Feedback',
        'settings.subscriptionTier': 'Subscription Tier',
        'settings.managePlan': 'Manage plan',
        'settings.changePassword': 'Change Password',
        'settings.currentPassword': 'Current password',
        'settings.newPassword': 'New password',
        'settings.confirmNewPassword': 'Confirm new password',
        'settings.passwordMismatchChange': 'Passwords do not match',
        'settings.passwordSaved': 'Password saved',
        'settings.sessions': 'Sessions',
        'settings.currentSession': 'Current',
        'settings.sessionRevoked': 'Revoked',
        'settings.noSessions': 'No sessions',
        'settings.revokeSession': 'Revoke',
        'settings.deleteAccountWarning': 'This will permanently delete your account',
        'settings.deleteAccount': 'Delete Account',
        'settings.cancelling': 'Cancelling',
        'settings.cancelDeletion': 'Cancel',
        'settings.deleteAccountGrace': '30 days',
        'settings.notSet': 'Not set',
        'auth.email': 'Email',
        'onboarding.timezone': 'Timezone',
        'common.back': 'Back',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
        // Surface D keys under test.
        'tiers.deletion.pendingList.title': 'Pending deletions',
        'tiers.deletion.pendingList.empty':
          'No Echoes or Shards are scheduled for deletion.',
        'tiers.deletion.pendingList.echoLabel': 'Echo',
        'tiers.deletion.pendingList.shardLabel': 'Private Shard',
        'tiers.deletion.pendingList.deletesOn': 'Deletes {{date}}',
        'tiers.deletion.pendingList.loading': 'Loading pending deletions…',
        'tiers.deletion.pendingList.loadError': "Couldn't load pending deletions.",
        'tiers.deletion.pendingList.retry': 'Retry',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  // The AccountSection (where PendingDeletionsCard lives) is gated by
  // `activeTab === 'account'`. SettingsPage reads the `tab` query
  // param at mount (SettingsPage.tsx:65), so `?tab=account` gets us
  // directly onto the surface under test.
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/settings?tab=account']}>
        <SettingsPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PendingDeletionsCard — ME-MIS-001 §5.2 Surface D', () => {
  beforeEach(() => {
    mocks.echoesList = [];
    mocks.shardsList = [];
    mocks.throwOn = false;
  });

  it('renders the empty state when no Echoes or Shards are pending', async () => {
    const result = await act(async () => renderPage());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(
      await result.findByText('No Echoes or Shards are scheduled for deletion.'),
    ).toBeInTheDocument();
  });

  it('lists hibernated Echoes and archived Shards sorted by deletion date ascending', async () => {
    // Two items, intentionally out-of-order in the source arrays so
    // the assertion proves the sort happened:
    //   - Shard archived 2026-04-01 → deletes 2026-06-30 (soonest)
    //   - Echo hibernated 2026-03-01 → deletes 2026-05-30 (2nd? no, earlier)
    // Wait — echoDeletionDate is hibernated_at + 90d. Let's make it:
    //   - Shard archived_at 2026-04-01, archive_expires_at 2026-07-01
    //   - Echo hibernated_at 2026-02-01 (→ deletes 2026-05-02)
    // Sorted ascending the Echo should appear first.
    mocks.echoesList = [
      {
        echo_id: 'e-lily',
        name: 'Lily',
        status: 'Hibernated',
        current_mood: 'neutral',
        current_tick: 0,
        current_shard_id: 'sh-x',
        persona_text: '',
        what_if_prompt: '',
        birth_hash: 'h',
        created_at: '2026-01-01T00:00:00Z',
        avatar_url: null,
        physical_description: null,
        hibernated_at: '2026-02-01T00:00:00Z',
      },
    ];
    mocks.shardsList = [
      {
        shard_id: 'sh-atlantis',
        name: 'Atlantis',
        shard_type: 'Private',
        status: 'Archived',
        description: '',
        current_active_count: 0,
        current_hibernated_count: 0,
        max_active_echoes: 5,
        banner_image: null,
        created_at: '2026-01-01T00:00:00Z',
        content_locale: 'en',
        provisioning_type: 'Archived',
        archived_at: '2026-04-01T00:00:00Z',
        archive_expires_at: '2026-07-01T00:00:00Z',
      },
    ];
    const result = await act(async () => renderPage());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Both entries rendered.
    expect(await result.findByText('Lily')).toBeInTheDocument();
    expect(result.getByText('Atlantis')).toBeInTheDocument();
    // Labels render.
    expect(result.getByText('Echo')).toBeInTheDocument();
    expect(result.getByText('Private Shard')).toBeInTheDocument();
    // Sort order: Lily (deletes 2026-05-02) before Atlantis (deletes
    // 2026-07-01). Query the two rendered name elements and compare
    // their document order.
    const lily = result.getByText('Lily');
    const atlantis = result.getByText('Atlantis');
    const order = lily.compareDocumentPosition(atlantis);
    // DOCUMENT_POSITION_FOLLOWING = 0x04 — atlantis is after lily.
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits active Echoes and Included Shards from the list', async () => {
    mocks.echoesList = [
      {
        echo_id: 'e-active',
        name: 'Awake',
        status: 'Active',
        current_mood: 'neutral',
        current_tick: 0,
        current_shard_id: 'sh-x',
        persona_text: '',
        what_if_prompt: '',
        birth_hash: 'h',
        created_at: '2026-01-01T00:00:00Z',
        avatar_url: null,
        physical_description: null,
        hibernated_at: null,
      },
    ];
    mocks.shardsList = [
      {
        shard_id: 'sh-live',
        name: 'Living',
        shard_type: 'Private',
        status: 'Active',
        description: '',
        current_active_count: 0,
        current_hibernated_count: 0,
        max_active_echoes: 5,
        banner_image: null,
        created_at: '2026-01-01T00:00:00Z',
        content_locale: 'en',
        provisioning_type: 'Included',
        archived_at: null,
        archive_expires_at: null,
      },
    ];
    const result = await act(async () => renderPage());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(
      await result.findByText('No Echoes or Shards are scheduled for deletion.'),
    ).toBeInTheDocument();
    expect(result.queryByText('Awake')).not.toBeInTheDocument();
    expect(result.queryByText('Living')).not.toBeInTheDocument();
  });

  // ── Error + retry coverage (amend 1) ──────────────────────────

  it('renders the error + retry surface when the fetch rejects', async () => {
    mocks.throwOn = true;
    const result = await act(async () => renderPage());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const alert = await result.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load pending deletions.");
    expect(result.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('recovers via Retry when the second fetch succeeds', async () => {
    mocks.throwOn = true;
    mocks.echoesList = [
      {
        echo_id: 'e-retry',
        name: 'RetriedEcho',
        status: 'Hibernated',
        current_mood: 'neutral',
        current_tick: 0,
        current_shard_id: 'sh-x',
        persona_text: '',
        what_if_prompt: '',
        birth_hash: 'h',
        created_at: '2026-01-01T00:00:00Z',
        avatar_url: null,
        physical_description: null,
        hibernated_at: '2026-02-01T00:00:00Z',
      },
    ];
    const result = await act(async () => renderPage());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await result.findByRole('alert')).toBeInTheDocument();
    // Flip the mock so the second attempt succeeds, click Retry,
    // wait one microtask flush for the refetch to resolve.
    mocks.throwOn = false;
    const retry = result.getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.click(retry);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.queryByRole('alert')).not.toBeInTheDocument();
    expect(await result.findByText('RetriedEcho')).toBeInTheDocument();
  });

  it('keeps the error surface when the retry also fails', async () => {
    mocks.throwOn = true;
    const result = await act(async () => renderPage());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const firstAlert = await result.findByRole('alert');
    expect(firstAlert).toBeInTheDocument();
    // Leave the mock in failure mode, click Retry, and confirm the
    // error surface re-renders after the second failed attempt.
    const retry = result.getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.click(retry);
      await new Promise((r) => setTimeout(r, 0));
    });
    const secondAlert = await result.findByRole('alert');
    expect(secondAlert.textContent).toContain(
      "Couldn't load pending deletions.",
    );
    expect(result.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
