import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button, Card, Spinner, EmptyState } from '../components/index.ts';
import { subscription, shards as shardsApi } from '../lib/api/endpoints.ts';
import { ApiRequestError } from '../lib/api/client.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useCurrentKey, useLatestLoad } from '../hooks/useCurrentKey.ts';
import type {
  DowngradeSessionView,
  PendingDecisionEntry,
  Shard,
} from '../types/api.ts';

type ShardNameMap = Record<string, string>;

// Every load on this page reads the one key, the user's pending downgrade
// session.
const SESSION_KEY = 'downgrade-session';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'no-session' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: DowngradeSessionView; shards: ShardNameMap };

// Values come from the server as Rust-Debug-formatted strings (see
// `From<&DowngradeSession> for DowngradeSessionView` in
// crates/api/src/routes/subscription.rs lines 70-94). Keep as literal
// strings because that matches the wire shape.
const STATE_PICKING_INCLUDED = 'PickingIncluded';
const STATE_COMMITTED = 'Committed';
const STATE_EXPIRED = 'Expired';
const STATE_CANCELLED = 'Cancelled';

const DECISION_UNDECIDED = 'Undecided';
const DECISION_BUY_ADDON = 'BuyAddon';
const DECISION_UPGRADE_BACK = 'UpgradeBack';
const DECISION_ARCHIVE = 'Archive';

// Pulled out of the component body so it isn't flagged as impure by the
// `react-hooks/purity` lint rule. Plain functions can touch the wall
// clock; component render bodies can't.
function computeHoursRemaining(expiresIso: string): number {
  const expiresMs = new Date(expiresIso).getTime();
  const diffMs = expiresMs - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
}

async function fetchShardNames(ids: string[]): Promise<ShardNameMap> {
  const unique = Array.from(new Set(ids));
  const entries = await Promise.all(
    unique.map(async (id): Promise<[string, string]> => {
      try {
        const shard = (await shardsApi.get(id)) as Shard;
        return [id, shard.name];
      } catch {
        // Leave the id as the label — user still sees a stable handle.
        return [id, id];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function DowngradeChoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  // ME-MIS-001 §5.2 Surface C route gate — the per-shard decision
  // screen is only reachable after the user has seen and acknowledged
  // the pre-confirm consent screen. Any entry without `consented=1`
  // is redirected to `/subscription/downgrade-confirm` first.
  // Direct-URL hits and stale bookmarks both funnel through consent.
  const [searchParams] = useSearchParams();
  const hasConsent = searchParams.get('consented') === '1';

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [mutating, setMutating] = useState<boolean>(false);

  // `isCurrent` says whether the load that read `session` is still the
  // page's latest. The mount effect runs again when the language changes,
  // and a shard-name read from the earlier run that settles after the later
  // one's writes nothing, so an earlier session's shards never replace a
  // later one's (R347.2).
  //
  // This flag is set in the effect's cleanup, which runs after the commit,
  // and unlike the shared `useCurrentKey` (R360.1) it leaves a gap in which
  // an earlier run's read can still write. That is kept on purpose (R360.3):
  // every load here reads one key, the user's pending downgrade session, so
  // a write in that gap is an earlier read of the same session, which the
  // later run's write then replaces. The page shows no other key's content.
  //
  // The flag covers the mount effect's runs: a run's flag is set before the
  // next run starts, so of those runs only the last one started writes. A
  // mutation's load is started by the user while an effect run may still be
  // in flight (the language changed after the page was ready), so every
  // load, an effect run's or a mutation's (a cancel starts none), also
  // takes `startLoad`'s check: only the last one started writes (R381.1,
  // R381.3).
  //
  // A mutation's response is the newest write (R390.3b). Each mutation
  // whose response the page writes (a pick, a shard decision, a commit;
  // not a cancel, which only moves or shows a toast) calls `startLoad`
  // when it starts and again when its response arrives while the page is
  // still mounted, and writes with the second check, so a reload started
  // while it was pending neither drops its response nor writes after it.
  //
  // A read a mutation supersedes never ends the loading it began, so a
  // mutation that superseded a read still running, when it started or when
  // its response arrived, starts a full read when it ends while the page is
  // still mounted, whether it succeeded or failed, after it writes its
  // response or its failure (R463.2). `reading` says whether a read is
  // running: it is set when a read starts and cleared when a current read
  // settles, so a superseded read leaves it set until the read after it
  // settles. `readNo` starts that read: the load effect runs again when it
  // changes.
  const startLoad = useLatestLoad(SESSION_KEY);
  // An action keeps the visit it began in, the page's mount: answered after
  // the page has gone, it shows nothing, reads nothing and moves nothing,
  // not even to the page it would have gone to (R483.1).
  const visitOf = useCurrentKey(SESSION_KEY);
  const reading = useRef(false);
  const [readNo, setReadNo] = useState(0);
  /** Begins a mutation: supersedes every load started before it. Its
   *  `answer` supersedes every load started while it was pending and
   *  returns the `isCurrent` its response writes with; its `end` starts
   *  the full read when either supersede found a read still running. */
  const beginMutation = useCallback(() => {
    let supersededRead = reading.current;
    startLoad(SESSION_KEY);
    return {
      answer: () => {
        supersededRead ||= reading.current;
        return startLoad(SESSION_KEY);
      },
      end: () => {
        if (supersededRead) setReadNo((n) => n + 1);
      },
    };
  }, [startLoad]);
  const applySession = useCallback(
    async (session: DowngradeSessionView, isCurrent: () => boolean) => {
      const ids = session.pending_decisions.map((d) => d.shard_id);
      if (session.picked_included_shard_id) {
        ids.push(session.picked_included_shard_id);
      }
      const shardNames = await fetchShardNames(ids);
      if (!isCurrent()) return;
      setLoadState({ kind: 'ready', session, shards: shardNames });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const isLatest = startLoad(SESSION_KEY);
    const isCurrent = () => !cancelled && isLatest();
    reading.current = true;
    (async () => {
      try {
        const session = await subscription.downgradePending();
        if (!isCurrent()) return;
        await applySession(session, isCurrent);
        if (isCurrent()) reading.current = false;
      } catch (err) {
        if (!isCurrent()) return;
        reading.current = false;
        if (err instanceof ApiRequestError && err.status === 404) {
          setLoadState({ kind: 'no-session' });
          return;
        }
        setLoadState({
          kind: 'error',
          message: translateCaughtError(err, t('tiers.downgrade.errorGeneric')),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, startLoad, t, readNo]);

  const handlePickIncluded = useCallback(
    async (sessionId: string, shardId: string) => {
      const inVisit = visitOf(SESSION_KEY);
      setMutating(true);
      const mutation = beginMutation();
      try {
        const updated = await subscription.pickIncludedShard(
          sessionId,
          shardId,
        );
        if (!inVisit()) return;
        await applySession(updated, mutation.answer());
      } catch (err) {
        if (!inVisit()) return;
        addToast(
          translateCaughtError(err, t('tiers.downgrade.errorGeneric')),
          'danger',
          { platformLink: isPlatformError(err) },
        );
      } finally {
        if (inVisit()) {
          setMutating(false);
          mutation.end();
        }
      }
    },
    [applySession, beginMutation, addToast, t, visitOf],
  );

  const handleShardDecision = useCallback(
    async (sessionId: string, shardId: string, decision: string) => {
      const inVisit = visitOf(SESSION_KEY);
      setMutating(true);
      const mutation = beginMutation();
      try {
        const updated = await subscription.shardDecision(
          sessionId,
          shardId,
          decision,
        );
        if (!inVisit()) return;
        await applySession(updated, mutation.answer());
      } catch (err) {
        if (!inVisit()) return;
        addToast(
          translateCaughtError(err, t('tiers.downgrade.errorGeneric')),
          'danger',
          { platformLink: isPlatformError(err) },
        );
      } finally {
        if (inVisit()) {
          setMutating(false);
          mutation.end();
        }
      }
    },
    [applySession, beginMutation, addToast, t, visitOf],
  );

  const handleCommit = useCallback(
    async (sessionId: string) => {
      const inVisit = visitOf(SESSION_KEY);
      setMutating(true);
      const mutation = beginMutation();
      try {
        const updated = await subscription.commit(sessionId);
        if (!inVisit()) return;
        addToast(t('tiers.downgrade.successMessage'), 'success');
        await applySession(updated, mutation.answer());
        if (!inVisit()) return;
        navigate('/dashboard');
      } catch (err) {
        if (!inVisit()) return;
        addToast(
          translateCaughtError(err, t('tiers.downgrade.errorGeneric')),
          'danger',
          { platformLink: isPlatformError(err) },
        );
      } finally {
        if (inVisit()) {
          setMutating(false);
          mutation.end();
        }
      }
    },
    [applySession, beginMutation, addToast, navigate, t, visitOf],
  );

  const handleCancel = useCallback(
    async (sessionId: string) => {
      const inVisit = visitOf(SESSION_KEY);
      setMutating(true);
      try {
        await subscription.cancel(sessionId);
        if (!inVisit()) return;
        navigate(-1);
      } catch (err) {
        if (!inVisit()) return;
        addToast(
          translateCaughtError(err, t('tiers.downgrade.errorGeneric')),
          'danger',
          { platformLink: isPlatformError(err) },
        );
      } finally {
        if (inVisit()) setMutating(false);
      }
    },
    [addToast, navigate, t, visitOf],
  );

  if (!hasConsent) {
    return <Navigate to="/subscription/downgrade-confirm" replace />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <button
          onClick={() => navigate(-1)}
          className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <h1 className="mbe-6 text-2xl font-bold text-text-primary">
          {t('tiers.downgrade.title')}
        </h1>

        {loadState.kind === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
            <span className="ms-3 text-text-secondary">
              {t('tiers.downgrade.loadingPending')}
            </span>
          </div>
        )}

        {loadState.kind === 'no-session' && (
          <EmptyState title={t('tiers.downgrade.sessionExpired')} />
        )}

        {loadState.kind === 'error' && (
          <Card>
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mbs-0.5 text-danger" />
              <div>
                <p className="text-sm text-text-primary">{loadState.message}</p>
              </div>
            </div>
          </Card>
        )}

        {loadState.kind === 'ready' && (
          <ChoiceSurface
            session={loadState.session}
            shardNames={loadState.shards}
            mutating={mutating}
            onPickIncluded={handlePickIncluded}
            onShardDecision={handleShardDecision}
            onCommit={handleCommit}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}

interface ChoiceSurfaceProps {
  session: DowngradeSessionView;
  shardNames: ShardNameMap;
  mutating: boolean;
  onPickIncluded: (sessionId: string, shardId: string) => void;
  onShardDecision: (
    sessionId: string,
    shardId: string,
    decision: string,
  ) => void;
  onCommit: (sessionId: string) => void;
  onCancel: (sessionId: string) => void;
}

function ChoiceSurface({
  session,
  shardNames,
  mutating,
  onPickIncluded,
  onShardDecision,
  onCommit,
  onCancel,
}: ChoiceSurfaceProps) {
  const { t } = useTranslation();

  const hoursRemaining = computeHoursRemaining(session.expires_at);

  if (
    session.state === STATE_COMMITTED ||
    session.state === STATE_EXPIRED ||
    session.state === STATE_CANCELLED
  ) {
    return <EmptyState title={t('tiers.downgrade.sessionExpired')} />;
  }

  if (session.state === STATE_PICKING_INCLUDED) {
    return (
      <div>
        <p className="mbe-2 text-sm text-text-secondary">
          {t('tiers.downgrade.pickIncludedTitle', {
            oldTier: session.old_tier,
            newTier: session.new_tier,
          })}
        </p>
        <p className="mbe-6 text-sm text-text-muted">
          {t('tiers.downgrade.pickIncludedSubtitle')}
        </p>
        <p className="mbe-4 text-xs text-text-muted">
          {t('tiers.downgrade.timeoutWarning', { hours: hoursRemaining })}
        </p>

        <div className="space-y-3">
          {session.pending_decisions.map((entry) => (
            <Card key={entry.shard_id} variant="compact">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-text-primary">
                  {shardNames[entry.shard_id] ?? entry.shard_id}
                </span>
                <Button
                  variant="primary"
                  disabled={mutating}
                  onClick={() =>
                    onPickIncluded(session.session_id, entry.shard_id)
                  }
                >
                  {t('tiers.downgrade.keepIncluded')}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mbs-8">
          <Button
            variant="ghost"
            disabled={mutating}
            onClick={() => onCancel(session.session_id)}
          >
            {t('tiers.downgrade.cancel')}
          </Button>
        </div>
      </div>
    );
  }

  // AwaitingShardDecisions
  const allDecided = session.pending_decisions.every(
    (d) => d.decision !== DECISION_UNDECIDED,
  );

  return (
    <div>
      <p className="mbe-2 text-sm text-text-secondary">
        {t('tiers.downgrade.shardDecisionTitle', {
          oldTier: session.old_tier,
          newTier: session.new_tier,
        })}
      </p>
      <p className="mbe-4 text-xs text-text-muted">
        {t('tiers.downgrade.timeoutWarning', { hours: hoursRemaining })}
      </p>

      {session.picked_included_shard_id && (
        <Card className="mbe-4" variant="compact">
          <p className="text-xs text-text-muted">
            {t('tiers.downgrade.keepingIncluded', {
              shard:
                shardNames[session.picked_included_shard_id] ??
                session.picked_included_shard_id,
            })}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {session.pending_decisions.map((entry) => (
          <ShardDecisionRow
            key={entry.shard_id}
            entry={entry}
            shardName={shardNames[entry.shard_id] ?? entry.shard_id}
            mutating={mutating}
            onDecision={(decision) =>
              onShardDecision(session.session_id, entry.shard_id, decision)
            }
          />
        ))}
      </div>

      <div className="mbs-8 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          disabled={mutating}
          onClick={() => onCancel(session.session_id)}
        >
          {t('tiers.downgrade.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={mutating || !allDecided}
          onClick={() => onCommit(session.session_id)}
        >
          {t('tiers.downgrade.commit')}
        </Button>
      </div>
    </div>
  );
}

interface ShardDecisionRowProps {
  entry: PendingDecisionEntry;
  shardName: string;
  mutating: boolean;
  onDecision: (decision: string) => void;
}

function ShardDecisionRow({
  entry,
  shardName,
  mutating,
  onDecision,
}: ShardDecisionRowProps) {
  const { t } = useTranslation();

  const isSelected = (decision: string) => entry.decision === decision;

  // Reuse the action labels (buyAddon / upgradeBack / archive) for the
  // current-selection badge rather than a separate `decision.*` key
  // subtree — same text, fewer translations per locale.
  const selectedLabel = (() => {
    switch (entry.decision) {
      case DECISION_BUY_ADDON:
        return t('tiers.downgrade.buyAddon');
      case DECISION_UPGRADE_BACK:
        return t('tiers.downgrade.upgradeBack');
      case DECISION_ARCHIVE:
        return t('tiers.downgrade.archive');
      default:
        return '';
    }
  })();

  return (
    <Card variant="compact">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-text-primary">
            {shardName}
          </span>
          {entry.decision !== DECISION_UNDECIDED && (
            <span className="text-xs text-accent">{selectedLabel}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={isSelected(DECISION_BUY_ADDON) ? 'primary' : 'secondary'}
            disabled={mutating}
            onClick={() => onDecision(DECISION_BUY_ADDON)}
          >
            {t('tiers.downgrade.buyAddon')}
          </Button>
          <Button
            variant={
              isSelected(DECISION_UPGRADE_BACK) ? 'primary' : 'secondary'
            }
            disabled={mutating}
            onClick={() => onDecision(DECISION_UPGRADE_BACK)}
          >
            {t('tiers.downgrade.upgradeBack')}
          </Button>
          <Button
            variant={isSelected(DECISION_ARCHIVE) ? 'danger' : 'secondary'}
            disabled={mutating}
            onClick={() => onDecision(DECISION_ARCHIVE)}
          >
            {t('tiers.downgrade.archive')}
          </Button>
        </div>
        {isSelected(DECISION_ARCHIVE) && (
          <p className="text-xs text-danger">
            {t('tiers.downgrade.archiveWarning')}
          </p>
        )}
      </div>
    </Card>
  );
}
