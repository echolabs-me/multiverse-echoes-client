import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Avatar, EmptyState, Spinner } from '../components/index.ts';
import { trackEvent } from '../lib/analytics.ts';
import { social, users } from '../lib/api/endpoints.ts';
import { useToastStore } from '../stores/useToastStore.ts';
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

export function UserProfilePage() {
  const { user_id: userId } = useParams<{ user_id: string }>();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [echoes, setEchoes] = useState<PublicEchoRef[]>([]);
  const [echoesInCommon, setEchoesInCommon] = useState<EchoInCommonRef[]>([]);
  const [rel, setRel] = useState<RelationshipState>(DEFAULT_REL);
  const [pending, setPending] = useState<keyof RelationshipState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<'not-found' | 'load-failed' | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [profileResp, echoesResp, eicResp, following, blocked, muted] =
        await Promise.all([
          users.getProfile(userId),
          users.listEchoes(userId).catch(() => [] as PublicEchoRef[]),
          users.echoesInCommon(userId).catch(() => [] as EchoInCommonRef[]),
          // Outbound-relationship lookups: if they fail (auth/network),
          // default to "no relationship" rather than failing the whole
          // page render. The page is still useful without action-state
          // hydration (buttons just default to Follow/Block/Mute).
          social.following().catch(() => [] as RelationshipResponse[]),
          social.blocked().catch(() => [] as RelationshipResponse[]),
          social.muted().catch(() => [] as RelationshipResponse[]),
        ]);
      setProfile(profileResp);
      setEchoes(echoesResp);
      setEchoesInCommon(eicResp);
      setRel({
        following: contains(following, userId),
        blocked: contains(blocked, userId),
        muted: contains(muted, userId),
      });
    } catch (err) {
      const message = (err as Error)?.message ?? '';
      setProfile(null);
      setError(/404|not.found/i.test(message) ? 'not-found' : 'load-failed');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
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
      setPending(kind);
      const prev = rel;
      // Optimistic update.
      setRel({ ...prev, [kind]: next });
      try {
        await run();
        trackEvent('profile.action', { user_id: userId, kind, next });
      } catch {
        // Revert + toast.
        setRel(prev);
        addToast(t('userProfile.actionFailed'), 'danger');
      } finally {
        setPending(null);
      }
    },
    [userId, rel, addToast, t],
  );

  if (!userId) {
    return (
      <main id="main-content" className="p-6">
        <EmptyState title={t('userProfile.notFound')} />
      </main>
    );
  }

  if (isLoading) {
    return (
      <main id="main-content" className="p-6">
        <Spinner />
      </main>
    );
  }

  if (error === 'load-failed') {
    return (
      <main id="main-content" className="p-6">
        <EmptyState
          title={t('userProfile.errorLoading')}
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
      </main>
    );
  }

  if (error === 'not-found' || !profile || !view) {
    return (
      <main id="main-content" className="p-6">
        <EmptyState title={t('userProfile.notFound')} />
      </main>
    );
  }

  const showFullProfile = view === 'Public' || view === 'FriendsOnlyVisible';

  return (
    <main id="main-content" className="mx-auto max-w-4xl p-6">
      {/* Hero — display_name + avatar always rendered (visible in every
          view state). Bio + Founding Echo badge gated behind
          showFullProfile. */}
      <header className="mbe-6 flex items-center gap-4">
        <Avatar
          src={profile.avatar_url ?? undefined}
          alt={profile.display_name}
          size="lg"
        />
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          {profile.is_founding_echo && showFullProfile && (
            <span
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
        pending={pending}
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
              <p className="whitespace-pre-wrap">{profile.bio}</p>
            </section>
          )}

          <section className="mbs-8">
            <h2 className="mbe-3 text-xl font-semibold">
              {t('userProfile.echoesHeading')}
            </h2>
            {echoes.length === 0 ? (
              <EmptyState title={t('userProfile.echoesEmpty')} />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <ul className="space-y-2">
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
        <p className="mbs-6 opacity-80">
          {t('userProfile.friendsOnlyMessage')}
        </p>
      ) : (
        <p className="mbs-6 opacity-80">{t('userProfile.privateMessage')}</p>
      )}
    </main>
  );
}

interface ActionRowProps {
  rel: RelationshipState;
  pending: keyof RelationshipState | null;
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
    pending,
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
        onClick={rel.following ? onUnfollow : onFollow}
        disabled={pending === 'following'}
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
            onClick={rel.blocked ? onUnblock : onBlock}
            disabled={pending === 'blocked'}
            aria-pressed={rel.blocked}
            className="rounded-sm border px-3 py-1 hover:bg-white/5 disabled:opacity-60"
          >
            {rel.blocked
              ? t('userProfile.unblockButton')
              : t('userProfile.blockButton')}
          </button>
          <button
            type="button"
            onClick={rel.muted ? onUnmute : onMute}
            disabled={pending === 'muted'}
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
