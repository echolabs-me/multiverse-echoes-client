import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Avatar, EmptyState, Spinner } from '../components/index.ts';
import { trackEvent } from '../lib/analytics.ts';
import { social, users } from '../lib/api/endpoints.ts';
import { ApiRequestError } from '../lib/api/client.ts';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useInFlight } from '../hooks/useInFlight.ts';
import {
  useCurrentKey,
  useLatestLoad,
  whenCurrent,
} from '../hooks/useCurrentKey.ts';
import { markers } from '../lib/inFlightMarkers.ts';
import type {
  EchoInCommonRef,
  PublicEchoRef,
  PublicProfileResponse,
  RelationshipResponse,
} from '../types/generated.ts';

// Discriminator for ME-UXF-001 §8.2 render branches. Derived purely
// from the two server-authoritative fields the profile response
// already carries (`profile_visibility` + `mutual_follow`). Self-view
// is treated as Public-equivalent because the server already unblocks
// every gated field when `user_id == auth.user_id`.
type ViewState =
  | 'Public'
  | 'FriendsOnlyVisible'
  | 'FriendsOnlyHidden'
  | 'Private';

function viewStateFor(profile: PublicProfileResponse): ViewState {
  if (profile.profile_visibility === 'Public') return 'Public';
  if (profile.profile_visibility === 'FriendsOnly') {
    return profile.mutual_follow ? 'FriendsOnlyVisible' : 'FriendsOnlyHidden';
  }
  return 'Private';
}

interface RelationshipState {
  following: boolean;
  blocked: boolean;
  muted: boolean;
}

const DEFAULT_REL: RelationshipState = {
  following: false,
  blocked: false,
  muted: false,
};

// The relationship state names the user it was read for, so an action that
// settles after the page has moved to another user changes nothing on that
// user's page (R285.3).
interface OwnedRelationshipState extends RelationshipState {
  owner: string | null;
}

/** What one load read, and the user it was read for (R361.1, R371.1). */
interface ProfileLoad {
  key: string;
  profile: PublicProfileResponse | null;
  echoes: PublicEchoRef[];
  echoesInCommon: EchoInCommonRef[];
  error: { kind: 'not-found' } | { kind: 'load-failed'; text: string } | null;
}

export function UserProfilePage() {
  const { user_id: userId } = useParams<{ user_id: string }>();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  // What the last load read, shown only while the route names the user it
  // was read for (R371.1): the first render for another user shows the
  // loading state, never the earlier user's profile.
  const [load, setLoad] = useState<ProfileLoad | null>(null);
  const shown = load !== null && load.key === userId ? load : null;
  const isLoading = shown === null;
  const profile = shown?.profile ?? null;
  const echoes = shown?.echoes ?? [];
  const echoesInCommon = shown?.echoesInCommon ?? [];
  const error = shown?.error ?? null;
  const [rel, setRel] = useState<OwnedRelationshipState>({
    owner: null,
    ...DEFAULT_REL,
  });
  // One marker per kind of action and target user, so a block in flight
  // does not free a follow in flight, and a follow in flight on one user
  // does not hold Follow on another (R265.2, R285.2).
  const inFlight = useInFlight();

  // Of the loads the page starts, only the last one started for the
  // route's user writes, and only while the page is mounted (R381.1). The
  // relationship state has its own: an action's answer is its newest write
  // (R390.3b), so a load started before the answer never writes over it.
  // A read of the relationship state an action supersedes never writes it,
  // so an action that superseded a read still running, when it started or
  // when its answer arrived, starts a full read when it ends in its visit,
  // whether it succeeded or failed, after it writes its answer or its undo
  // (R463.2).
  // `relReading` says whether a read of it is running: set when a read
  // starts, cleared when a current read settles.
  const startLoad = useLatestLoad(userId);
  const startRel = useLatestLoad(userId);
  // An action keeps the visit it began in: its answer, its undo and the
  // read after it are written only while that visit lasts (R483.1).
  const visitOf = useCurrentKey(userId);
  const relReading = useRef(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    const key = userId;
    const isCurrent = startLoad(key);
    if (!isCurrent()) return;
    const relCurrent = startRel(key);
    relReading.current = true;
    try {
      const [profileResp, echoesResp, eicResp, following, blocked, muted] =
        await whenCurrent(
          isCurrent,
          Promise.all([
            users.getProfile(key),
            users.listEchoes(key).catch(() => [] as PublicEchoRef[]),
            users.echoesInCommon(key).catch(() => [] as EchoInCommonRef[]),
            // Outbound-relationship lookups: if they fail (auth/network),
            // default to "no relationship" rather than failing the whole
            // page render. The page is still useful without action-state
            // hydration (buttons just default to Follow/Block/Mute).
            social.following().catch(() => [] as RelationshipResponse[]),
            social.blocked().catch(() => [] as RelationshipResponse[]),
            social.muted().catch(() => [] as RelationshipResponse[]),
          ]),
        );
      if (relCurrent()) {
        relReading.current = false;
        setRel({
          owner: key,
          following: contains(following, key),
          blocked: contains(blocked, key),
          muted: contains(muted, key),
        });
      }
      setLoad({
        key,
        profile: profileResp,
        echoes: echoesResp,
        echoesInCommon: eicResp,
        error: null,
      });
    } catch (err) {
      if (relCurrent()) relReading.current = false;
      // A missing user has its own view; any other error shows the
      // translator's text (R264.2).
      setLoad({
        key,
        profile: null,
        echoes: [],
        echoesInCommon: [],
        error:
          err instanceof ApiRequestError && err.status === 404
            ? { kind: 'not-found' }
            : {
                kind: 'load-failed',
                text: translateCaughtError(err, t('userProfile.errorLoading')),
              },
      });
    }
  }, [userId, t, startLoad, startRel]);

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, [loadData]);

  // Fire `profile.viewed` exactly once per resolved user_id load — not
  // on every render. Tied to userId so re-navigating to a different
  // profile still fires fresh.
  useEffect(() => {
    if (userId) {
      trackEvent('profile.viewed', { user_id: userId });
    }
  }, [userId]);

  const view: ViewState | null = profile ? viewStateFor(profile) : null;

  const handleAction = useCallback(
    async (
      kind: keyof RelationshipState,
      next: boolean,
      run: () => Promise<unknown>,
    ) => {
      if (!userId) return;
      const target = userId;
      const inVisit = visitOf(target);
      // Each write changes one field, so the optimistic change and its
      // undo set that field alone, on the state as it is then, and only
      // while the page still shows the target (R285.3).
      const setField = (value: boolean) =>
        setRel((cur) =>
          cur.owner === target ? { ...cur, [kind]: value } : cur,
        );
      await inFlight.run(markers[kind](target), async () => {
        // The action supersedes every load of the relationship state
        // started before it, now and when its answer arrives (R390.3b).
        // Its answer writes the value it set, even over a reload that
        // landed while it was pending (R422.4). A read either supersede
        // found running is replaced by a full read when it ends (R463.2).
        let supersededRead = relReading.current;
        startRel(target);
        setField(next);
        try {
          await run();
          trackEvent('profile.action', { user_id: target, kind, next });
          // Answered in a later visit, it writes nothing there (R483.1).
          if (!inVisit()) return;
          supersededRead ||= relReading.current;
          if (startRel(target)()) setField(next);
        } catch (err) {
          if (!inVisit()) return;
          supersededRead ||= relReading.current;
          startRel(target);
          setField(!next);
          addToast(
            translateCaughtError(err, t('userProfile.actionFailed')),
            'danger',
            { platformLink: isPlatformError(err) },
          );
        }
        if (supersededRead) void loadData();
      });
    },
    [userId, addToast, t, inFlight, startRel, loadData, visitOf],
  );

  if (!userId) {
    return (
      <main id="main-content" data-testid="profile-page-root" className="p-6">
        <div data-testid="profile-not-found">
          <EmptyState title={t('userProfile.notFound')} />
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main id="main-content" data-testid="profile-page-root" className="p-6">
        <div data-testid="profile-loading">
          <Spinner />
        </div>
      </main>
    );
  }

  if (error?.kind === 'load-failed') {
    return (
      <main id="main-content" data-testid="profile-page-root" className="p-6">
        <div data-testid="profile-load-failed">
          <EmptyState
            title={error.text}
            action={
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-sm border px-3 py-1 hover:bg-white/5"
              >
                {t('common.retry')}
              </button>
            }
          />
        </div>
      </main>
    );
  }

  if (error?.kind === 'not-found' || !profile || !view) {
    return (
      <main id="main-content" data-testid="profile-page-root" className="p-6">
        <div data-testid="profile-not-found">
          <EmptyState title={t('userProfile.notFound')} />
        </div>
      </main>
    );
  }

  const showFullProfile = view === 'Public' || view === 'FriendsOnlyVisible';

  return (
    <main
      id="main-content"
      data-testid="profile-page-root"
      className="mx-auto max-w-4xl p-6"
    >
      {/* Hero — display_name + avatar always rendered (visible in every
          view state). Bio + Founding Echo badge gated behind
          showFullProfile. */}
      <header className="mbe-6 flex items-center gap-4">
        <div data-testid="profile-avatar">
          <Avatar
            src={profile.avatar_url ?? undefined}
            alt={profile.display_name}
            size="lg"
          />
        </div>
        <div>
          <h1 data-testid="profile-display-name" className="text-2xl font-bold">
            {profile.display_name}
          </h1>
          {profile.is_founding_echo && showFullProfile && (
            <span
              data-testid="profile-founding-echo-badge"
              className="mbs-1 inline-block rounded-sm bg-amber-200/30 px-2 py-0.5 text-xs text-amber-200"
              aria-label={t('userProfile.foundingEcho')}
            >
              {t('userProfile.foundingEcho')}
            </span>
          )}
        </div>
      </header>

      {/* Action buttons — always rendered (Follow is universally
          available per ME-UXF-001 §8.2 Private branch). */}
      <ActionRow
        rel={rel}
        isPending={(kind) => inFlight.isHeld(markers[kind](userId))}
        viewIsPrivate={view === 'Private'}
        onFollow={() =>
          handleAction('following', true, () => users.follow(userId))
        }
        onUnfollow={() =>
          handleAction('following', false, () => users.unfollow(userId))
        }
        onBlock={() => handleAction('blocked', true, () => users.block(userId))}
        onUnblock={() =>
          handleAction('blocked', false, () => users.unblock(userId))
        }
        onMute={() => handleAction('muted', true, () => users.mute(userId))}
        onUnmute={() =>
          handleAction('muted', false, () => users.unmute(userId))
        }
      />

      {showFullProfile ? (
        <>
          {profile.bio && (
            <section className="mbs-6">
              <h2 className="sr-only">{t('userProfile.bio')}</h2>
              <p data-testid="profile-bio" className="whitespace-pre-wrap">
                {profile.bio}
              </p>
            </section>
          )}

          <section className="mbs-8">
            <h2 className="mbe-3 text-xl font-semibold">
              {t('userProfile.echoesHeading')}
            </h2>
            {echoes.length === 0 ? (
              <EmptyState title={t('userProfile.echoesEmpty')} />
            ) : (
              <ul
                data-testid="profile-echoes-list"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {echoes.map((e) => (
                  <li
                    key={e.echo_id}
                    className="rounded-sm border p-3 hover:bg-white/5"
                  >
                    <Link
                      to={`/echoes/${e.echo_id}`}
                      className="font-medium underline"
                    >
                      {e.name}
                    </Link>
                    <p className="mbs-1 text-sm opacity-80">{e.current_mood}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mbs-8">
            <h2 className="mbe-3 text-xl font-semibold">
              {t('userProfile.echoesInCommon')}
            </h2>
            {echoesInCommon.length === 0 ? (
              <EmptyState title={t('userProfile.echoesInCommonEmpty')} />
            ) : (
              <ul
                data-testid="profile-echoes-in-common-list"
                className="space-y-2"
              >
                {echoesInCommon.map((row) => (
                  <li
                    key={`${row.viewer_echo_id}::${row.target_echo_id}`}
                    className="rounded-sm border p-3 text-sm"
                  >
                    <Link
                      to={`/echoes/${row.viewer_echo_id}`}
                      className="underline"
                    >
                      {row.viewer_echo_name}
                    </Link>
                    <span className="opacity-60"> ↔ </span>
                    <Link
                      to={`/echoes/${row.target_echo_id}`}
                      className="underline"
                    >
                      {row.target_echo_name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : view === 'FriendsOnlyHidden' ? (
        <p
          data-testid="profile-friends-only-message"
          className="mbs-6 opacity-80"
        >
          {t('userProfile.friendsOnlyMessage')}
        </p>
      ) : (
        <p data-testid="profile-private-message" className="mbs-6 opacity-80">
          {t('userProfile.privateMessage')}
        </p>
      )}
    </main>
  );
}

interface ActionRowProps {
  rel: RelationshipState;
  isPending: (kind: keyof RelationshipState) => boolean;
  viewIsPrivate: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onMute: () => void;
  onUnmute: () => void;
}

function ActionRow(props: ActionRowProps) {
  const { t } = useTranslation();
  const {
    rel,
    isPending,
    viewIsPrivate,
    onFollow,
    onUnfollow,
    onBlock,
    onUnblock,
    onMute,
    onUnmute,
  } = props;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        data-testid={
          rel.following ? 'profile-action-unfollow' : 'profile-action-follow'
        }
        onClick={rel.following ? onUnfollow : onFollow}
        disabled={isPending('following')}
        aria-pressed={rel.following}
        className="rounded-sm border px-3 py-1 hover:bg-white/5 disabled:opacity-60"
      >
        {rel.following
          ? t('userProfile.unfollowButton')
          : t('userProfile.followButton')}
      </button>
      {/* Block + Mute hidden on Private views per ME-UXF-001 §8.2
          ("Follow button still available"); spec lists Follow as the
          ONLY action affordance there. Mutual-or-Public renders the
          full set. */}
      {!viewIsPrivate && (
        <>
          <button
            type="button"
            data-testid={
              rel.blocked ? 'profile-action-unblock' : 'profile-action-block'
            }
            onClick={rel.blocked ? onUnblock : onBlock}
            disabled={isPending('blocked')}
            aria-pressed={rel.blocked}
            className="rounded-sm border px-3 py-1 hover:bg-white/5 disabled:opacity-60"
          >
            {rel.blocked
              ? t('userProfile.unblockButton')
              : t('userProfile.blockButton')}
          </button>
          <button
            type="button"
            data-testid={
              rel.muted ? 'profile-action-unmute' : 'profile-action-mute'
            }
            onClick={rel.muted ? onUnmute : onMute}
            disabled={isPending('muted')}
            aria-pressed={rel.muted}
            className="rounded-sm border px-3 py-1 hover:bg-white/5 disabled:opacity-60"
          >
            {rel.muted
              ? t('userProfile.unmuteButton')
              : t('userProfile.muteButton')}
          </button>
        </>
      )}
    </div>
  );
}

function contains(rels: RelationshipResponse[], targetId: string): boolean {
  return rels.some((r) => r.target_user_id === targetId);
}
