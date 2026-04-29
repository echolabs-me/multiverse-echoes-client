import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button, Card, Spinner, EmptyState } from '../components/index.ts';
import { echoes as echoesApi, subscription } from '../lib/api/endpoints.ts';
import { ApiRequestError } from '../lib/api/client.ts';
import { isEchoHibernated } from '../lib/hibernation.ts';
import type {
  DowngradeSessionView,
  EchoResponse,
  TierLimits,
} from '../types/api.ts';

/**
 * ME-MIS-001 §5.2 Surface C — pre-confirm informed-consent screen.
 *
 * Mounted before `DowngradeChoicePage` in the downgrade flow. A user
 * arriving at `/subscription/downgrade-choice` without `?consented=1`
 * in the query string is redirected here first, reads what will
 * happen at commit time (how many Echoes get hibernated, how many
 * Private Shards need a decision, that both are permanently deleted
 * after 90 days unless acted on), and checks a consent box before
 * the "Proceed to decisions" button unlocks.
 *
 * Data dependencies (all three fetched concurrently in a single
 * `Promise.all`; the `ready` state is reached only when every leg
 * resolves):
 * - `subscription.downgradePending()` — session, old_tier, new_tier,
 *   pending_decisions (shards that need a per-shard decision).
 * - `subscription.tierLimits()` — server-sourced per-tier quota
 *   snapshot. Used for the `echo_count_limit` of the new tier so the
 *   hibernation-count delta math uses the SSOT rather than a
 *   hardcoded client-side tier table.
 * - `echoes.list()` — fetched directly (NOT via `useEchoStore`). The
 *   consent math counts the user's currently-active Echoes, and any
 *   read via the zustand store would be subject to the user's
 *   sidebar fetch timing: an unpopulated store at consent-screen
 *   mount would make the math compute against `[]` and surface an
 *   incorrect "0 Echoes will be hibernated" on a page whose entire
 *   purpose is correct enumeration. Fetching directly here means the
 *   consent screen is self-contained.
 */

type LoadState =
  | { kind: 'loading' }
  | { kind: 'no-session' }
  | { kind: 'error'; canRetry: boolean; code: string; message: string }
  | {
      kind: 'ready';
      session: DowngradeSessionView;
      newTierCap: number;
      activeEchoes: number;
      excessEchoes: number;
      shardDecisionCount: number;
    };

export function DowngradeConfirmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [consented, setConsented] = useState<boolean>(false);
  // Incremented to force the fetch effect to re-run on retry. The
  // effect's deps array closes over this counter, so `setAttempt`
  // schedules a fresh fetch without needing a separate identity-
  // stable callback.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Cancellation guard so late-arriving Promises don't call
    // `setLoadState` after unmount. Keeps
    // `react-hooks/set-state-in-effect` satisfied — the only setState
    // inside the effect body runs inside a conditional/try block.
    let cancelled = false;
    (async () => {
      try {
        const [session, tierLimits, echoList] = await Promise.all([
          subscription.downgradePending(),
          subscription.tierLimits(),
          echoesApi.list(),
        ]);
        if (cancelled) return;
        const newCapEntry: TierLimits | undefined = tierLimits.find(
          (tl) => tl.tier === session.new_tier,
        );
        if (!newCapEntry) {
          setLoadState({
            kind: 'error',
            canRetry: true,
            code: 'UNKNOWN_TIER',
            message: t('tiers.deletion.consent.errorGeneric'),
          });
          return;
        }
        const activeEchoes = (echoList as EchoResponse[]).filter(
          (e) => !isEchoHibernated(e),
        ).length;
        const excessEchoes = Math.max(
          0,
          activeEchoes - newCapEntry.echo_count_limit,
        );
        setLoadState({
          kind: 'ready',
          session,
          newTierCap: newCapEntry.echo_count_limit,
          activeEchoes,
          excessEchoes,
          shardDecisionCount: session.pending_decisions.length,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.status === 404) {
          // 404 on `/subscription/downgrade/pending` means there is
          // no active downgrade session — a terminal state, not a
          // retryable fetch failure.
          setLoadState({ kind: 'no-session' });
          return;
        }
        const code = err instanceof ApiRequestError ? err.code : 'UNKNOWN';
        const message =
          err instanceof ApiRequestError
            ? err.message
            : t('tiers.deletion.consent.errorGeneric');
        setLoadState({ kind: 'error', canRetry: true, code, message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, t]);

  const handleRetry = () => {
    setLoadState({ kind: 'loading' });
    setAttempt((a) => a + 1);
  };

  const handleProceed = () => {
    navigate('/subscription/downgrade-choice?consented=1');
  };

  const handleCancel = () => {
    // Back to whatever page the user came from (typically
    // `/settings` or `/plans`); mirrors DowngradeChoicePage's cancel
    // UX for consistency.
    navigate(-1);
  };

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
          {t('tiers.deletion.consent.title')}
        </h1>

        {loadState.kind === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
            <span className="ms-3 text-text-secondary">
              {t('tiers.deletion.consent.loading')}
            </span>
          </div>
        )}

        {loadState.kind === 'no-session' && (
          <EmptyState title={t('tiers.deletion.consent.noPending')} />
        )}

        {loadState.kind === 'error' && (
          <Card>
            <div className="flex items-start gap-3" role="alert">
              <AlertTriangle
                size={20}
                className="mbs-0.5 shrink-0 text-warning"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-text-primary">{loadState.message}</p>
                <p className="mbs-1 text-xs text-text-muted">{loadState.code}</p>
              </div>
              {loadState.canRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="shrink-0 text-sm font-medium text-accent transition-colors duration-(--duration-fast) hover:text-accent-hover"
                >
                  {t('tiers.deletion.consent.retry')}
                </button>
              )}
            </div>
          </Card>
        )}

        {loadState.kind === 'ready' && (
          <>
            <p className="mbe-6 text-sm text-text-secondary">
              {t('tiers.deletion.consent.summary', {
                oldTier: loadState.session.old_tier,
                newTier: loadState.session.new_tier,
              })}
            </p>

            {/* Echoes */}
            <Card className="mbe-4">
              <h2 className="mbe-2 text-sm font-semibold text-text-primary">
                {t('tiers.deletion.consent.echoesHeader')}
              </h2>
              <p className="text-sm text-text-secondary">
                {loadState.excessEchoes > 0
                  ? t('tiers.deletion.consent.echoesHibernateCount', {
                      count: loadState.excessEchoes,
                      total: loadState.activeEchoes,
                    })
                  : t('tiers.deletion.consent.echoesNoneHibernated', {
                      total: loadState.activeEchoes,
                      newTier: loadState.session.new_tier,
                      cap: loadState.newTierCap,
                    })}
              </p>
              <p className="mbs-2 text-xs text-text-muted">
                {t('tiers.deletion.consent.echoesDeletion')}
              </p>
            </Card>

            {/* Private Shards */}
            <Card className="mbe-4">
              <h2 className="mbe-2 text-sm font-semibold text-text-primary">
                {t('tiers.deletion.consent.shardsHeader')}
              </h2>
              <p className="text-sm text-text-secondary">
                {loadState.shardDecisionCount > 0
                  ? t('tiers.deletion.consent.shardsDecisionCount', {
                      count: loadState.shardDecisionCount,
                    })
                  : t('tiers.deletion.consent.shardsNoneToDecide')}
              </p>
              {loadState.shardDecisionCount > 0 && (
                <p className="mbs-2 text-xs text-text-muted">
                  {t('tiers.deletion.consent.shardsDeletion')}
                </p>
              )}
            </Card>

            {/* Consent checkbox */}
            <label className="mbs-6 flex cursor-pointer items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mbs-1 shrink-0"
                aria-describedby="consent-description"
              />
              <span id="consent-description" className="flex-1">
                {t('tiers.deletion.consent.checkboxLabel')}
              </span>
            </label>

            <div className="mbs-6 flex items-center justify-between gap-4">
              <Button variant="ghost" onClick={handleCancel}>
                {t('tiers.deletion.consent.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={!consented}
                onClick={handleProceed}
              >
                {t('tiers.deletion.consent.proceed')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
