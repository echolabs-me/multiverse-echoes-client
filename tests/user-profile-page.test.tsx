import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { StrictMode, Profiler } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

import { UserProfilePage } from '../src/pages/UserProfilePage.tsx';
import { ApiRequestError } from '../src/lib/api/client.ts';

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

const OTHER_USER = '22222222-2222-2222-2222-222222222222';

/** A link to the other user's profile, so the route reuses the page. */
function ToOtherUser() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(`/users/${OTHER_USER}`)}>
      Go to the other user
    </button>
  );
}

function renderWithLinkToOtherUser() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[`/users/${TARGET_USER}`]}>
        <Routes>
          <Route
            path="/users/:user_id"
            element={
              <>
                <UserProfilePage />
                <ToOtherUser />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
    expect(
      screen.getByText('A traveller of inner worlds.'),
    ).toBeInTheDocument();
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
      publicProfile({
        profile_visibility: 'Private',
        bio: null,
        avatar_url: null,
      }),
    );
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('This profile is private.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
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

  it('holds each kind of action on its own marker: a block that settles does not free a follow in flight (R265.2)', async () => {
    mocks.follow.mockReturnValue(new Promise(() => {}));
    mocks.block.mockResolvedValue({});
    await act(async () => {
      renderPage();
    });
    const follow = await screen.findByRole('button', { name: 'Follow' });
    await act(async () => {
      fireEvent.click(follow);
      fireEvent.click(follow);
    });
    expect(mocks.follow).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    });
    expect(mocks.block).toHaveBeenCalledTimes(1);
    // The follow has not settled, so its button stays held.
    const held = screen.getByRole('button', { name: 'Unfollow' });
    expect(held).toBeDisabled();
    await act(async () => {
      fireEvent.click(held);
    });
    expect(mocks.unfollow).not.toHaveBeenCalled();
  });

  it('holds a follow on its target: a follow in flight on one user does not disable Follow on another (R285.2)', async () => {
    mocks.getProfile.mockImplementation((id: string) =>
      Promise.resolve(publicProfile({ user_id: id })),
    );
    mocks.follow.mockImplementation((id: string) =>
      id === TARGET_USER ? new Promise(() => {}) : Promise.resolve({}),
    );
    await act(async () => {
      renderWithLinkToOtherUser();
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    });
    expect(screen.getByRole('button', { name: 'Unfollow' })).toBeDisabled();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Go to the other user' }),
      );
    });
    await waitFor(() =>
      expect(mocks.getProfile).toHaveBeenLastCalledWith(OTHER_USER),
    );
    const follow = await screen.findByRole('button', { name: 'Follow' });
    expect(follow).toBeEnabled();
    await act(async () => {
      fireEvent.click(follow);
    });
    expect(mocks.follow).toHaveBeenCalledTimes(2);
    expect(mocks.follow).toHaveBeenLastCalledWith(OTHER_USER);
  });

  it('a follow that fails after a block has succeeded leaves the block on screen (R285.3)', async () => {
    const follow = deferred();
    mocks.follow.mockReturnValue(follow.promise);
    mocks.block.mockResolvedValue({});
    await act(async () => {
      renderPage();
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    });
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeEnabled();
    await act(async () => {
      follow.reject(new Error('boom'));
    });
    // The follow's own field goes back, and the block it did not change
    // stays.
    expect(screen.getByRole('button', { name: 'Follow' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument();
  });

  it('a follow that fails after the page has moved to another user changes nothing there (R285.3)', async () => {
    const follow = deferred();
    mocks.getProfile.mockImplementation((id: string) =>
      Promise.resolve(publicProfile({ user_id: id })),
    );
    // The other user is already followed, so a stray undo of a follow
    // would show Follow on their page.
    mocks.socialFollowing.mockResolvedValue([{ target_user_id: OTHER_USER }]);
    mocks.follow.mockReturnValue(follow.promise);
    await act(async () => {
      renderWithLinkToOtherUser();
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Go to the other user' }),
      );
    });
    expect(
      await screen.findByRole('button', { name: 'Unfollow' }),
    ).toBeEnabled();
    await act(async () => {
      follow.reject(new Error('boom'));
    });
    expect(screen.getByRole('button', { name: 'Unfollow' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
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
      // Not the server's answer, so the platform's (R283.3).
      { platformLink: true },
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
  it('renders the not-found empty state when getProfile answers 404', async () => {
    mocks.getProfile.mockRejectedValue(
      new ApiRequestError(404, 'NOT_FOUND', 'No such user'),
    );
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

// ==================================================================
// R361, R371.1, R381.1, R390.3: the page shows and writes only the user
// its route names
// ==================================================================

function followOf(target: string) {
  return {
    relationship_id: `r-${target}`,
    source_user_id: 'self',
    target_user_id: target,
    relationship_type: 'Follow',
    created_at: '2026-01-01T00:00:00Z',
  };
}

const commits: string[] = [];
/** Records the page's text at every commit of what it wraps. */
function CommitProbe({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="page"
      onRender={() => {
        commits.push(document.body.textContent ?? '');
      }}
    >
      {children}
    </Profiler>
  );
}

function renderForLoads({ strict = false }: { strict?: boolean } = {}) {
  const page = (
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[`/users/${TARGET_USER}`]}>
        <CommitProbe>
          <Routes>
            <Route
              path="/users/:user_id"
              element={
                <>
                  <UserProfilePage />
                  <ToOtherUser />
                </>
              }
            />
          </Routes>
        </CommitProbe>
      </MemoryRouter>
    </I18nextProvider>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

describe('UserProfilePage — loads for the route’s user (R361)', () => {
  beforeEach(() => {
    commits.length = 0;
  });

  it('a load for an earlier user that settles after the later user’s leaves the later user’s profile (R361.3)', async () => {
    const first = deferred();
    mocks.getProfile.mockImplementation((id: string) =>
      id === TARGET_USER
        ? first.promise
        : Promise.resolve(
            publicProfile({ user_id: OTHER_USER, display_name: 'Carol' }),
          ),
    );
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Go to the other user' }),
      );
    });
    expect(screen.getByText('Carol')).toBeInTheDocument();
    await act(async () => {
      first.resolve(publicProfile());
    });
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('from one user’s profile to the route of another, no render for it shows the earlier profile (R371.1)', async () => {
    mocks.getProfile.mockImplementation((id: string) =>
      id === TARGET_USER
        ? Promise.resolve(publicProfile())
        : new Promise(() => undefined),
    );
    await act(async () => {
      renderForLoads();
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
    commits.length = 0;
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Go to the other user' }),
      );
    });
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('Bob');
    }
  });

  it('of two loads for one user, an older one that fails last leaves the newer one’s profile (R381.1)', async () => {
    const older = deferred();
    const newer = deferred();
    mocks.getProfile
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await act(async () => {
      renderForLoads({ strict: true });
    });
    expect(mocks.getProfile).toHaveBeenCalledTimes(2);
    await act(async () => {
      newer.resolve(publicProfile());
    });
    await act(async () => {
      older.reject(new ApiRequestError(500, 'INTERNAL_ERROR', 'boom'));
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(
      screen.queryByText('Couldn’t load this profile. Please try again.'),
    ).toBeNull();
  });

  it('a mute of an earlier user answered after the page moved to another starts no load there, and that user’s load still writes (R390.3a)', async () => {
    // The mute changes a field the assertion does not read, so what the
    // other user's page shows for Follow comes only from that user's load.
    const muteAnswer = deferred();
    mocks.mute.mockReturnValue(muteAnswer.promise);
    const otherFollows = deferred();
    mocks.getProfile.mockImplementation((id: string) =>
      Promise.resolve(
        id === TARGET_USER
          ? publicProfile()
          : publicProfile({ user_id: OTHER_USER, display_name: 'Carol' }),
      ),
    );
    mocks.socialFollowing
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(otherFollows.promise);
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Go to the other user' }),
      );
    });
    // The mute's answer arrives on the other user's page.
    await act(async () => {
      muteAnswer.resolve(undefined);
    });
    // The other user's load, started before that answer, settles: the
    // viewer already follows them.
    await act(async () => {
      otherFollows.resolve([followOf(OTHER_USER)]);
    });
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Unfollow' }),
    ).toBeInTheDocument();
  });

  it('a reload started while a follow is pending writes nothing after the follow’s answer, and the full read the follow starts when it ends writes (R390.3b, R463.2)', async () => {
    const followAnswer = deferred();
    mocks.follow.mockReturnValue(followAnswer.promise);
    const reloadFollows = deferred();
    mocks.socialFollowing
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(reloadFollows.promise)
      // The full read the follow starts when it ends, since its answer
      // superseded the reload still running.
      .mockResolvedValueOnce([followOf(TARGET_USER)]);
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    });
    // A new `t` starts a reload while the follow is pending.
    await act(async () => {
      await testI18n.changeLanguage('fr');
    });
    try {
      await act(async () => {
        followAnswer.resolve(undefined);
      });
      expect(mocks.socialFollowing).toHaveBeenCalledTimes(3);
      // The reload read the relationships before the follow landed.
      await act(async () => {
        reloadFollows.resolve([]);
      });
      expect(
        screen.getByRole('button', { name: 'userProfile.unfollowButton' }),
      ).toBeInTheDocument();
    } finally {
      await act(async () => {
        await testI18n.changeLanguage('en');
      });
    }
  });
});

// ==================================================================
// R422.4: an action's own value outlives a reload
// ==================================================================

describe('UserProfilePage — an action’s value outlives a reload (R422.4)', () => {
  type Kind = 'following' | 'blocked' | 'muted';
  const lookups = {
    following: mocks.socialFollowing,
    blocked: mocks.socialBlocked,
    muted: mocks.socialMuted,
  };
  const actions: {
    name: string;
    kind: Kind;
    before: boolean;
    request: ReturnType<typeof vi.fn>;
    button: string;
    after: string;
  }[] = [
    {
      name: 'Follow',
      kind: 'following',
      before: false,
      request: mocks.follow,
      button: 'profile-action-follow',
      after: 'profile-action-unfollow',
    },
    {
      name: 'Unfollow',
      kind: 'following',
      before: true,
      request: mocks.unfollow,
      button: 'profile-action-unfollow',
      after: 'profile-action-follow',
    },
    {
      name: 'Block',
      kind: 'blocked',
      before: false,
      request: mocks.block,
      button: 'profile-action-block',
      after: 'profile-action-unblock',
    },
    {
      name: 'Unblock',
      kind: 'blocked',
      before: true,
      request: mocks.unblock,
      button: 'profile-action-unblock',
      after: 'profile-action-block',
    },
    {
      name: 'Mute',
      kind: 'muted',
      before: false,
      request: mocks.mute,
      button: 'profile-action-mute',
      after: 'profile-action-unmute',
    },
    {
      name: 'Unmute',
      kind: 'muted',
      before: true,
      request: mocks.unmute,
      button: 'profile-action-unmute',
      after: 'profile-action-mute',
    },
  ];

  it.each(actions)(
    'a $name whose answer lands after a reload that read the earlier state shows the value it set',
    async ({ kind, before, request, button, after }) => {
      if (before) lookups[kind].mockResolvedValue([followOf(TARGET_USER)]);
      const answer = deferred();
      request.mockReturnValue(answer.promise);
      await act(async () => {
        renderPage();
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId(button));
      });
      expect(screen.getByTestId(after)).toBeInTheDocument();
      // A new `t` starts a reload while the action is pending; it reads the
      // state from before the action and lands first.
      await act(async () => {
        await testI18n.changeLanguage('fr');
      });
      try {
        expect(screen.getByTestId(button)).toBeInTheDocument();
        await act(async () => {
          answer.resolve(undefined);
        });
        expect(screen.getByTestId(after)).toBeInTheDocument();
      } finally {
        await act(async () => {
          await testI18n.changeLanguage('en');
        });
      }
    },
  );
});

// ==================================================================
// R463.2: an action that superseded a running read reads again when it ends
// ==================================================================

describe('UserProfilePage — an action over a running read (R463.2)', () => {
  it.each(['succeeds', 'fails'] as const)(
    'a follow that superseded a read still running, when it %s, reads the relationships again and shows that read',
    async (outcome) => {
      const runningMuted = deferred();
      mocks.socialMuted
        // The mount read.
        .mockResolvedValueOnce([])
        // The read the language change starts, held past the follow.
        .mockReturnValueOnce(runningMuted.promise)
        // The full read the follow starts when it ends: the viewer has
        // muted the user meanwhile.
        .mockResolvedValueOnce([followOf(TARGET_USER)]);
      if (outcome === 'succeeds') {
        mocks.follow.mockResolvedValue(undefined);
        mocks.socialFollowing
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([followOf(TARGET_USER)]);
      } else {
        mocks.follow.mockRejectedValue(new Error('boom'));
      }
      await act(async () => {
        renderForLoads();
      });
      expect(screen.getByTestId('profile-action-mute')).toBeInTheDocument();
      // A new `t` starts a read, still running when the user follows.
      await act(async () => {
        await testI18n.changeLanguage('fr');
      });
      try {
        await act(async () => {
          fireEvent.click(screen.getByTestId('profile-action-follow'));
        });
        expect(mocks.socialMuted).toHaveBeenCalledTimes(3);
        expect(screen.getByTestId('profile-action-unmute')).toBeInTheDocument();
        expect(
          screen.getByTestId(
            outcome === 'succeeds'
              ? 'profile-action-unfollow'
              : 'profile-action-follow',
          ),
        ).toBeInTheDocument();
        // The superseded read settles last and writes nothing.
        await act(async () => {
          runningMuted.resolve([]);
        });
        expect(screen.getByTestId('profile-action-unmute')).toBeInTheDocument();
      } finally {
        await act(async () => {
          await testI18n.changeLanguage('en');
        });
      }
    },
  );

  it.each(['succeeds', 'fails'] as const)(
    'a read started while a follow is pending, superseded by the follow’s answer when it %s, is followed by a full read that shows',
    async (outcome) => {
      const answer = deferred();
      mocks.follow.mockReturnValue(answer.promise);
      const runningMuted = deferred();
      mocks.socialMuted
        // The mount read.
        .mockResolvedValueOnce([])
        // The read the language change starts while the follow is pending.
        .mockReturnValueOnce(runningMuted.promise)
        // The full read the follow starts when it ends.
        .mockResolvedValueOnce([followOf(TARGET_USER)]);
      await act(async () => {
        renderForLoads();
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('profile-action-follow'));
      });
      await act(async () => {
        await testI18n.changeLanguage('fr');
      });
      try {
        expect(mocks.socialMuted).toHaveBeenCalledTimes(2);
        await act(async () => {
          if (outcome === 'succeeds') answer.resolve(undefined);
          else answer.reject(new Error('boom'));
        });
        expect(mocks.socialMuted).toHaveBeenCalledTimes(3);
        expect(screen.getByTestId('profile-action-unmute')).toBeInTheDocument();
        // The superseded read settles last and writes nothing.
        await act(async () => {
          runningMuted.resolve([]);
        });
        expect(screen.getByTestId('profile-action-unmute')).toBeInTheDocument();
      } finally {
        await act(async () => {
          await testI18n.changeLanguage('en');
        });
      }
    },
  );

  it('a follow that superseded no running read reads nothing again when it ends', async () => {
    mocks.follow.mockResolvedValue(undefined);
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('profile-action-follow'));
    });
    expect(screen.getByTestId('profile-action-unfollow')).toBeInTheDocument();
    expect(mocks.getProfile).toHaveBeenCalledTimes(1);
  });
});

/**
 * Renders the first user's profile with links to each user's, clicks
 * Follow, then visits the other user and comes back (visits A, B, A).
 */
async function followThenGoAndComeBack() {
  await act(async () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={[`/users/${TARGET_USER}`]}>
          <Routes>
            <Route
              path="/users/:user_id"
              element={
                <>
                  <UserProfilePage />
                  <BackAndForth />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('profile-action-follow'));
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the other user' }),
    );
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to the first user' }),
    );
  });
  expect(mocks.getProfile).toHaveBeenCalledTimes(3);
}

/** Links to each user's profile, so the route reuses the page. */
function BackAndForth() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(`/users/${OTHER_USER}`)}>
        Go to the other user
      </button>
      <button type="button" onClick={() => navigate(`/users/${TARGET_USER}`)}>
        Back to the first user
      </button>
    </>
  );
}

describe('UserProfilePage — an action keeps the visit it began in (R483.1)', () => {
  it.each(['succeeds', 'fails'] as const)(
    'a follow begun in the first visit to a user that %s in a third writes nothing there and starts no read',
    async (outcome) => {
      const answer = deferred();
      mocks.follow.mockReturnValue(answer.promise);
      mocks.getProfile.mockImplementation((id: string) =>
        Promise.resolve(
          id === TARGET_USER
            ? publicProfile()
            : publicProfile({ user_id: OTHER_USER, display_name: 'Carol' }),
        ),
      );
      // The third visit's read of the relationships is still running when
      // the follow is answered.
      const thirdFollowing = deferred();
      mocks.socialFollowing
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(thirdFollowing.promise);
      await followThenGoAndComeBack();
      mocks.addToast.mockClear();
      await act(async () => {
        if (outcome === 'succeeds') answer.resolve(undefined);
        else answer.reject(new Error('boom'));
      });
      expect(mocks.getProfile).toHaveBeenCalledTimes(3);
      expect(mocks.addToast).not.toHaveBeenCalled();
      // The third visit's own read lands and is what the page shows.
      await act(async () => {
        thirdFollowing.resolve([]);
      });
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByTestId('profile-action-follow')).toBeInTheDocument();
      expect(mocks.getProfile).toHaveBeenCalledTimes(3);
    },
  );

  // The third visit's read has landed when the follow is answered, so the
  // page shows its relationship: an answer that wrote into the visit would
  // change what it shows.
  it.each(['succeeds', 'fails'] as const)(
    'a follow begun in the first visit to a user that %s after the third visit has read leaves what that read shows',
    async (outcome) => {
      const answer = deferred();
      mocks.follow.mockReturnValue(answer.promise);
      mocks.getProfile.mockImplementation((id: string) =>
        Promise.resolve(
          id === TARGET_USER
            ? publicProfile()
            : publicProfile({ user_id: OTHER_USER, display_name: 'Carol' }),
        ),
      );
      // The third visit reads the opposite of what the answer would write:
      // not followed when the follow succeeds, followed when it fails.
      const thirdRead =
        outcome === 'succeeds'
          ? []
          : [
              {
                relationship_id: 'r1',
                source_user_id: 'self',
                target_user_id: TARGET_USER,
                relationship_type: 'Follow',
                created_at: '2026-01-01T00:00:00Z',
              },
            ];
      mocks.socialFollowing
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(thirdRead);
      await followThenGoAndComeBack();
      const shown =
        outcome === 'succeeds'
          ? 'profile-action-follow'
          : 'profile-action-unfollow';
      // Precondition (SR16): the third visit's read has landed.
      expect(screen.getByTestId(shown)).toBeInTheDocument();
      mocks.addToast.mockClear();
      await act(async () => {
        if (outcome === 'succeeds') answer.resolve(undefined);
        else answer.reject(new Error('boom'));
      });
      expect(screen.getByTestId(shown)).toBeInTheDocument();
      expect(mocks.addToast).not.toHaveBeenCalled();
      expect(mocks.getProfile).toHaveBeenCalledTimes(3);
    },
  );
});
