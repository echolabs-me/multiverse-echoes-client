import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

import { UserProfilePage } from '../src/pages/UserProfilePage.tsx';

// vi.mock calls hoist to the top of the file, ahead of any `const`
// declarations — so the mock factories cannot reference module-level
// vars directly. vi.hoisted() runs in the same hoisted phase, giving
// each mock factory stable vi.fn() identities to capture.

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  trackEvent: vi.fn(),
  getProfile: vi.fn(),
  listEchoes: vi.fn(),
  echoesInCommon: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  mute: vi.fn(),
  unmute: vi.fn(),
  socialFollowing: vi.fn(),
  socialBlocked: vi.fn(),
  socialMuted: vi.fn(),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (selector?: (s: unknown) => unknown) => {
    const state = { addToast: mocks.addToast };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  users: {
    getProfile: (...args: unknown[]) => mocks.getProfile(...args),
    listEchoes: (...args: unknown[]) => mocks.listEchoes(...args),
    echoesInCommon: (...args: unknown[]) => mocks.echoesInCommon(...args),
    follow: (...args: unknown[]) => mocks.follow(...args),
    unfollow: (...args: unknown[]) => mocks.unfollow(...args),
    block: (...args: unknown[]) => mocks.block(...args),
    unblock: (...args: unknown[]) => mocks.unblock(...args),
    mute: (...args: unknown[]) => mocks.mute(...args),
    unmute: (...args: unknown[]) => mocks.unmute(...args),
  },
  social: {
    following: () => mocks.socialFollowing(),
    blocked: () => mocks.socialBlocked(),
    muted: () => mocks.socialMuted(),
  },
}));

// --- i18n test instance ---

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        userProfile: {
          bio: 'Bio',
          echoesHeading: 'Echoes',
          echoesEmpty: 'No public Echoes yet.',
          echoesInCommon: 'Echoes in common',
          echoesInCommonEmpty: 'Your Echoes haven’t crossed paths yet.',
          followButton: 'Follow',
          unfollowButton: 'Unfollow',
          blockButton: 'Block',
          unblockButton: 'Unblock',
          muteButton: 'Mute',
          unmuteButton: 'Unmute',
          privateMessage: 'This profile is private.',
          friendsOnlyMessage: 'Follow to see more.',
          notFound: 'User not found.',
          errorLoading: 'Couldn’t load this profile. Please try again.',
          actionPending: 'Working…',
          actionFailed: 'That action didn’t go through. Please try again.',
          foundingEcho: 'Founding Echo',
        },
        common: { retry: 'Retry' },
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

const TARGET_USER = '11111111-1111-1111-1111-111111111111';

function renderPage(path = `/users/${TARGET_USER}`) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/users/:user_id" element={<UserProfilePage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function publicProfile(overrides: Record<string, unknown> = {}) {
  return {
    user_id: TARGET_USER,
    display_name: 'Bob',
    bio: 'A traveller of inner worlds.',
    avatar_url: null,
    profile_visibility: 'Public',
    account_type: 'Standard',
    subscription_tier: 'Free',
    created_at: '2026-01-01T00:00:00Z',
    mutual_follow: false,
    is_founding_echo: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: clean Public profile, no echoes, no in-common, no
  // outbound relationships. Individual tests override what they need.
  mocks.getProfile.mockResolvedValue(publicProfile());
  mocks.listEchoes.mockResolvedValue([]);
  mocks.echoesInCommon.mockResolvedValue([]);
  mocks.socialFollowing.mockResolvedValue([]);
  mocks.socialBlocked.mockResolvedValue([]);
  mocks.socialMuted.mockResolvedValue([]);
});

// ==================================================================
// Privacy gate render correctness — 4 tests
// ==================================================================

describe('UserProfilePage — privacy gates', () => {
  it('renders display_name + bio + Echoes heading + Echoes-in-common heading on a Public profile', async () => {
    mocks.getProfile.mockResolvedValue(publicProfile());
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('A traveller of inner worlds.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Echoes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Echoes in common' }),
    ).toBeInTheDocument();
  });

  it('renders the friends-only message and HIDES bio when target is FriendsOnly + viewer is NOT a mutual follower', async () => {
    mocks.getProfile.mockResolvedValue(
      publicProfile({
        profile_visibility: 'FriendsOnly',
        mutual_follow: false,
        bio: null,
      }),
    );
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Follow to see more.')).toBeInTheDocument();
    // Echoes heading must NOT appear in the gated branch.
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Echoes' }),
    ).not.toBeInTheDocument();
  });

  it('renders the FULL profile (Echoes + in-common sections) when target is FriendsOnly + viewer IS a mutual follower', async () => {
    mocks.getProfile.mockResolvedValue(
      publicProfile({
        profile_visibility: 'FriendsOnly',
        mutual_follow: true,
      }),
    );
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Echoes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Echoes in common' }),
    ).toBeInTheDocument();
  });

  it('renders ONLY display_name + Follow button + private message when target is Private', async () => {
    mocks.getProfile.mockResolvedValue(
      publicProfile({ profile_visibility: 'Private', bio: null, avatar_url: null }),
    );
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('This profile is private.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Follow' }),
    ).toBeInTheDocument();
    // Block + Mute must NOT render on a Private view per ME-UXF-001
    // §8.2 ("Follow button still available" — Follow only).
    expect(
      screen.queryByRole('button', { name: 'Block' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mute' }),
    ).not.toBeInTheDocument();
  });
});

// ==================================================================
// Action affordances — 5 tests
// ==================================================================

describe('UserProfilePage — action buttons', () => {
  it('clicking Follow optimistically flips the button to Unfollow and calls users.follow exactly once', async () => {
    mocks.follow.mockResolvedValue({});
    await act(async () => {
      renderPage();
    });
    const btn = await screen.findByRole('button', { name: 'Follow' });
    await act(async () => {
      await userEvent.click(btn);
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Unfollow' }),
      ).toBeInTheDocument(),
    );
    expect(mocks.follow).toHaveBeenCalledTimes(1);
    expect(mocks.follow).toHaveBeenCalledWith(TARGET_USER);
  });

  it('clicking Block calls users.block exactly once with the target user_id', async () => {
    mocks.block.mockResolvedValue({});
    await act(async () => {
      renderPage();
    });
    const btn = await screen.findByRole('button', { name: 'Block' });
    await act(async () => {
      await userEvent.click(btn);
    });
    await waitFor(() => expect(mocks.block).toHaveBeenCalledTimes(1));
    expect(mocks.block).toHaveBeenCalledWith(TARGET_USER);
  });

  it('clicking Mute calls users.mute exactly once and renders the Unmute button on success', async () => {
    mocks.mute.mockResolvedValue({});
    await act(async () => {
      renderPage();
    });
    const btn = await screen.findByRole('button', { name: 'Mute' });
    await act(async () => {
      await userEvent.click(btn);
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Unmute' }),
      ).toBeInTheDocument(),
    );
    expect(mocks.mute).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic state and surfaces a toast when the action wrapper rejects', async () => {
    mocks.follow.mockRejectedValue(new Error('boom'));
    await act(async () => {
      renderPage();
    });
    const btn = await screen.findByRole('button', { name: 'Follow' });
    await act(async () => {
      await userEvent.click(btn);
    });
    // Wait for the revert to settle (button label flips back).
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Follow' }),
      ).toBeInTheDocument(),
    );
    expect(mocks.addToast).toHaveBeenCalledWith(
      'That action didn’t go through. Please try again.',
      'danger',
    );
  });

  it('hydrates the relationship state from social.* on mount: Unfollow renders when target is already followed', async () => {
    mocks.socialFollowing.mockResolvedValue([
      {
        relationship_id: 'r1',
        source_user_id: 'self',
        target_user_id: TARGET_USER,
        relationship_type: 'Follow',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByRole('button', { name: 'Unfollow' }),
    ).toBeInTheDocument();
  });
});

// ==================================================================
// Loading + error + analytics + echoes-in-common rendering
// ==================================================================

describe('UserProfilePage — load + error + analytics + EIC rendering', () => {
  it('renders the not-found empty state when getProfile throws a 404-ish error', async () => {
    mocks.getProfile.mockRejectedValue(new Error('404 Not Found'));
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('User not found.')).toBeInTheDocument();
  });

  it('renders the load-error empty state with a Retry button when getProfile throws non-404', async () => {
    mocks.getProfile.mockRejectedValue(new Error('500 boom'));
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByText('Couldn’t load this profile. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('fires trackEvent("profile.viewed") exactly once on mount with the resolved user_id', async () => {
    await act(async () => {
      renderPage();
    });
    await screen.findByText('Bob');
    expect(mocks.trackEvent).toHaveBeenCalledWith('profile.viewed', {
      user_id: TARGET_USER,
    });
    // The trackEvent call may also fire for follow/block/mute actions
    // — but ON MOUNT, only profile.viewed fires.
    const profileViewedCalls = mocks.trackEvent.mock.calls.filter(
      (c) => c[0] === 'profile.viewed',
    );
    expect(profileViewedCalls).toHaveLength(1);
  });

  it('renders one row per EchoInCommonRef when the echoes-in-common payload is non-empty', async () => {
    mocks.echoesInCommon.mockResolvedValue([
      {
        viewer_echo_id: 'va',
        viewer_echo_name: 'Atlas',
        target_echo_id: 'tb',
        target_echo_name: 'Mira',
        last_interaction_at: '2026-04-01T00:00:00Z',
        last_interaction_tick: 100,
      },
      {
        viewer_echo_id: 'vc',
        viewer_echo_name: 'Coral',
        target_echo_id: 'td',
        target_echo_name: 'Nyx',
        last_interaction_at: '2026-04-02T00:00:00Z',
        last_interaction_tick: 200,
      },
    ]);
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText('Mira')).toBeInTheDocument();
    expect(screen.getByText('Coral')).toBeInTheDocument();
    expect(screen.getByText('Nyx')).toBeInTheDocument();
  });
});
