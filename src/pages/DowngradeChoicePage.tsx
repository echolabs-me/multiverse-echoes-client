import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button, Card, Spinner, EmptyState } from '../components/index.ts';
import { subscription, shards as shardsApi } from '../lib/api/endpoints.ts';
import { ApiRequestError } from '../lib/api/client.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import type {
  DowngradeSessionView,
  PendingDecisionEntry,
  Shard,
} from '../types/api.ts';

type ShardNameMap = Record<string, string>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'no-session' }
  | { kind: 'error'; code: string; message: string }
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

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [mutating, setMutating] = useState<boolean>(false);

  const applySession = useCallback(
    async (session: DowngradeSessionView) => {
      const ids = session.pending_decisions.map((d) => d.shard_id);
      if (session.picked_included_shard_id) {
        ids.push(session.picked_included_shard_id);
      }
      const shardNames = await fetchShardNames(ids);
      setLoadState({ kind: 'ready', session, shards: shardNames });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await subscription.downgradePending();
        if (cancelled) return;
        await applySession(session);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.status === 404) {
          setLoadState({ kind: 'no-session' });
          return;
        }
        const code = err instanceof ApiRequestError ? err.code : 'UNKNOWN';
        const message =
          err instanceof ApiRequestError ? err.message : t('tiers.downgrade.errorGeneric');
        setLoadState({ kind: 'error', code, message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, t]);

  const handlePickIncluded = useCallback(
    async (sessionId: string, shardId: string) => {
      setMutating(true);
      try {
        const updated = await subscription.pickIncludedShard(sessionId, shardId);
        await applySession(updated);
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : t('tiers.downgrade.errorGeneric');
        addToast(message, 'danger', { platformLink: true });
      } finally {
        setMutating(false);
      }
    },
    [applySession, addToast, t],
  );

  const handleShardDecision = useCallback(
    async (sessionId: string, shardId: string, decision: string) => {
      setMutating(true);
      try {
        const updated = await subscription.shardDecision(sessionId, shardId, decision);
        await applySession(updated);
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : t('tiers.downgrade.errorGeneric');
        addToast(message, 'danger', { platformLink: true });
      } finally {
        setMutating(false);
      }
    },
    [applySession, addToast, t],
  );

  const handleCommit = useCallback(
    async (sessionId: string) => {
      setMutating(true);
      try {
        const updated = await subscription.commit(sessionId);
        addToast(t('tiers.downgrade.successMessage'), 'success');
        await applySession(updated);
        navigate('/dashboard');
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : t('tiers.downgrade.errorGeneric');
        addToast(message, 'danger', { platformLink: true });
      } finally {
        setMutating(false);
      }
    },
    [applySession, addToast, navigate, t],
  );

  const handleCancel = useCallback(
    async (sessionId: string) => {
      setMutating(true);
      try {
        await subscription.cancel(sessionId);
        navigate(-1);
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : t('tiers.downgrade.errorGeneric');
        addToast(message, 'danger', { platformLink: true });
      } finally {
        setMutating(false);
      }
    },
    [addToast, navigate, t],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          {t('tiers.downgrade.title')}
        </h1>

        {loadState.kind === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
            <span className="ml-3 text-text-secondary">
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
              <AlertTriangle size={20} className="mt-0.5 text-danger" />
              <div>
                <p className="text-sm text-text-primary">{loadState.message}</p>
                <p className="mt-1 text-xs text-text-muted">{loadState.code}</p>
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
  onShardDecision: (sessionId: string, shardId: string, decision: string) => void;
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
    return (
      <EmptyState title={t('tiers.downgrade.sessionExpired')} />
    );
  }

  if (session.state === STATE_PICKING_INCLUDED) {
    return (
      <div>
        <p className="mb-2 text-sm text-text-secondary">
          {t('tiers.downgrade.pickIncludedTitle', {
            oldTier: session.old_tier,
            newTier: session.new_tier,
          })}
        </p>
        <p className="mb-6 text-sm text-text-muted">
          {t('tiers.downgrade.pickIncludedSubtitle')}
        </p>
        <p className="mb-4 text-xs text-text-muted">
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
                  onClick={() => onPickIncluded(session.session_id, entry.shard_id)}
                >
                  {t('tiers.downgrade.keepIncluded')}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8">
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
      <p className="mb-2 text-sm text-text-secondary">
        {t('tiers.downgrade.shardDecisionTitle', {
          oldTier: session.old_tier,
          newTier: session.new_tier,
        })}
      </p>
      <p className="mb-4 text-xs text-text-muted">
        {t('tiers.downgrade.timeoutWarning', { hours: hoursRemaining })}
      </p>

      {session.picked_included_shard_id && (
        <Card className="mb-4" variant="compact">
          <p className="text-xs text-text-muted">
            {t('tiers.downgrade.keepingIncluded', {
              shard: shardNames[session.picked_included_shard_id] ?? session.picked_included_shard_id,
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

      <div className="mt-8 flex items-center justify-between gap-4">
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
          <span className="text-sm font-medium text-text-primary">{shardName}</span>
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
            variant={isSelected(DECISION_UPGRADE_BACK) ? 'primary' : 'secondary'}
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
          <p className="text-xs text-danger">{t('tiers.downgrade.archiveWarning')}</p>
        )}
      </div>
    </Card>
  );
}
