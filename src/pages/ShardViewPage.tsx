import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Archive, MapPin, Users } from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  Spinner,
  EmptyState,
  Modal,
} from '../components/index.ts';
import { ShardEnvironment3D } from '../components/ShardEnvironment3D.tsx';
import { useToastStore } from '../stores/useToastStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import {
  shards as shardApi,
  echoes as echoApi,
  feeds,
} from '../lib/api/endpoints.ts';
import { trackEvent } from '../lib/analytics.ts';
import { formatDate, formatDeletionDate } from '../lib/formatDate.ts';
import { isShardArchived, shardDeletionDate } from '../lib/hibernation.ts';
import { getMoodLabel } from '../lib/moodLabel.ts';
import type { FeedItem } from '../types/api.ts';
import type { ShardEchoSummary } from '../types/generated.ts';

export function ShardViewPage() {
  const { shardId } = useParams<{ shardId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeShard, fetchShard } = useShardStore();
  const { echoList, fetchEchoes } = useEchoStore();
  const addToast = useToastStore((s) => s.addToast);

  const [shardEchoes, setShardEchoes] = useState<ShardEchoSummary[]>([]);
  const [shardFeed, setShardFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [travelModal, setTravelModal] = useState(false);
  const [selectedEchoId, setSelectedEchoId] = useState('');

  const loadData = useCallback(async () => {
    if (!shardId) return;
    setIsLoading(true);
    try {
      await fetchShard(shardId);
      const [echoesResult, feedResult] = await Promise.all([
        shardApi.echoes(shardId).catch(() => [] as ShardEchoSummary[]),
        feeds
          .shard(shardId)
          .catch(() => ({ data: [] as FeedItem[], next_cursor: null })),
      ]);
      setShardEchoes(echoesResult);
      setShardFeed(feedResult.data);
      if (shardId)
        trackEvent('feed.viewed', { variant: 'shard', shard_id: shardId });
    } finally {
      setIsLoading(false);
    }
  }, [shardId, fetchShard]);

  useEffect(() => {
    void loadData();
    // Ensure user's echoes are loaded (needed for travel button visibility)
    if (echoList.length === 0) void fetchEchoes();
  }, [loadData, echoList.length, fetchEchoes]);

  const [travelConfirmed, setTravelConfirmed] = useState(false);

  const handleTravel = async () => {
    if (!shardId || !selectedEchoId) return;
    try {
      await echoApi.travel(selectedEchoId, shardId);
      trackEvent('echo.travel_initiated', {
        echo_id: selectedEchoId,
        destination_shard: shardId,
      });
      setTravelModal(false);
      // Show inline confirmation (same pattern as nudge — toast may be behind dialog)
      setTravelConfirmed(true);
      setTimeout(() => setTravelConfirmed(false), 5000);
      addToast(t('shardView.travelInitiated'), 'success');
      // Refresh shard data + echo list to reflect the move
      void loadData();
      void fetchEchoes();
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : t('common.error');
      addToast(detail, 'danger', { platformLink: true });
    }
  };

  // Eligible echoes for travel: active, not already in this shard
  const eligibleEchoes = echoList.filter((e) => e.status === 'Active');

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!activeShard) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          title={t('shardView.shardNotFound')}
          description=""
          action={
            <Button onClick={() => navigate('/dashboard')}>
              {t('common.back')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-y-auto">
        <ShardEnvironment3D shardName={activeShard.name} />
        <div className="relative mx-auto max-w-4xl p-6">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          {/* Banner image */}
          {activeShard.banner_image && (
            <div className="mbe-4 overflow-hidden rounded-xl">
              <img
                src={activeShard.banner_image}
                alt={activeShard.name}
                className="h-48 w-full object-cover sm:h-56"
                loading="eager"
              />
            </div>
          )}

          {/* Shard header */}
          <div className="mbe-6">
            <h1 className="text-2xl font-bold text-text-primary">
              {activeShard.name}
            </h1>
            <p className="mbs-1 text-sm text-text-secondary">
              {activeShard.description}
            </p>
            <div className="mbs-2 flex items-center gap-3 text-sm text-text-muted">
              <Badge
                variant={
                  isShardArchived(activeShard)
                    ? 'warning'
                    : activeShard.status === 'Active'
                      ? 'success'
                      : 'default'
                }
              >
                {t(`shardView.status${activeShard.status}`, {
                  defaultValue: activeShard.status,
                })}
              </Badge>
              <span>
                {t('shardView.capacity', {
                  count: shardEchoes.length,
                  max: activeShard.max_active_echoes,
                })}
              </span>
              <span>
                {t(`shardView.type${activeShard.shard_type}`, {
                  defaultValue: activeShard.shard_type,
                })}
              </span>
            </div>
          </div>

          {/* ME-MIS-001 §5.2 Surface B — archived Shard banner. Uses
              the server-provided `archive_expires_at` (not a
              client-side computation) so the countdown cannot drift
              from the DataLifecycleEnforcer's delete decision. */}
          {(() => {
            const archiveDeletion = shardDeletionDate(
              activeShard.archive_expires_at,
            );
            if (!isShardArchived(activeShard) || !archiveDeletion) return null;
            return (
              <div
                className="mbe-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
                role="status"
                aria-live="polite"
              >
                <Archive
                  size={18}
                  className="mbs-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="flex-1">
                  {t('tiers.deletion.shardArchivedBanner', {
                    date: formatDeletionDate(archiveDeletion),
                  })}
                </span>
              </div>
            );
          })()}

          {/* Travel button + confirmation */}
          {eligibleEchoes.length > 0 && (
            <div className="mbe-6">
              <Button variant="secondary" onClick={() => setTravelModal(true)}>
                <MapPin size={16} /> {t('shardView.travelHere')}
              </Button>
            </div>
          )}
          {travelConfirmed && (
            <div className="mbe-6 flex animate-slide-in items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
              <MapPin size={16} /> {t('shardView.travelInitiated')}
            </div>
          )}

          {/* Echoes in Shard */}
          <section className="mbe-6">
            <div className="mbe-3 flex items-center gap-2">
              <Users size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('shardView.echoes')}
              </h2>
            </div>
            {shardEchoes.length === 0 ? (
              <EmptyState title={t('shardView.echoesEmpty')} description="" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shardEchoes.map((echo) => (
                  <Card
                    key={echo.echo_id}
                    variant="compact"
                    onClick={() => navigate(`/echoes/${echo.echo_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-medium">
                        {echo.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {echo.name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {getMoodLabel(echo.current_mood)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          echo.status === 'Active' ? 'success' : 'default'
                        }
                      >
                        {t(`shardView.status${echo.status}`, {
                          defaultValue: echo.status,
                        })}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Recent activity from shard feed */}
          {shardFeed.length > 0 && (
            <section className="mbe-6">
              <h2 className="mbe-3 text-lg font-semibold text-text-primary">
                {t('shardView.recentActivity')}
              </h2>
              <div className="flex flex-col gap-2">
                {shardFeed.slice(0, 20).map((item) => (
                  <Card key={item.item_id} variant="compact">
                    <p className="text-sm font-medium text-text-primary">
                      {item.title}
                    </p>
                    <p className="text-sm text-text-secondary">{item.body}</p>
                    <span className="text-xs text-text-muted">
                      {formatDate(item.created_at)}
                    </span>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Travel Modal */}
      <Modal
        open={travelModal}
        onClose={() => setTravelModal(false)}
        title={t('shardView.travelHere')}
      >
        <p className="mbe-3 text-sm text-text-secondary">
          {t('shardView.travelSelectEcho')}
        </p>
        <select
          value={selectedEchoId}
          onChange={(e) => setSelectedEchoId(e.target.value)}
          className="mbe-4 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          aria-label={t('shardView.travelSelectEcho')}
        >
          <option value="">{t('shardView.travelChooseEcho')}</option>
          {eligibleEchoes.map((e) => (
            <option key={e.echo_id} value={e.echo_id}>
              {e.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTravelModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleTravel} disabled={!selectedEchoId}>
            {t('shardView.travelHere')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
