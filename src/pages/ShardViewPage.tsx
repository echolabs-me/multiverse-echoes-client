import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MapPin, Users, MessageSquare } from 'lucide-react';
import {
  TopBar,
  Card,
  Badge,
  Button,
  Spinner,
  EmptyState,
  Modal,
} from '../components/index.ts';
import { useToastStore } from '../components/Toast.tsx';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { shards as shardApi, echoes as echoApi, feeds, channels } from '../lib/api/endpoints.ts';
import type { EchoResponse, FeedItem, Channel, ChannelMessage } from '../types/api.ts';

export function ShardViewPage() {
  const { shardId } = useParams<{ shardId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeShard, fetchShard } = useShardStore();
  const { echoList } = useEchoStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const addToast = useToastStore((s) => s.addToast);

  const [shardEchoes, setShardEchoes] = useState<EchoResponse[]>([]);
  const [shardFeed, setShardFeed] = useState<FeedItem[]>([]);
  const [shardChannel, setShardChannel] = useState<Channel | null>(null);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [travelModal, setTravelModal] = useState(false);
  const [selectedEchoId, setSelectedEchoId] = useState('');

  const loadData = useCallback(async () => {
    if (!shardId) return;
    setIsLoading(true);
    try {
      await fetchShard(shardId);
      const [echoesResult, feedResult, channelsResult] = await Promise.all([
        shardApi.echoes(shardId).catch(() => [] as EchoResponse[]),
        feeds.shard(shardId).catch(() => [] as FeedItem[]),
        channels.list({ shard_id: shardId }).catch(() => [] as Channel[]),
      ]);
      setShardEchoes(echoesResult);
      setShardFeed(feedResult);

      if (channelsResult.length > 0) {
        const ch = channelsResult[0]!;
        setShardChannel(ch);
        const msgs = await channels.messages(ch.channel_id, { limit: 50 }).catch(() => []);
        setChannelMessages(msgs);
      }
    } finally {
      setIsLoading(false);
    }
  }, [shardId, fetchShard]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTravel = async () => {
    if (!shardId || !selectedEchoId) return;
    try {
      await echoApi.travel(selectedEchoId, shardId);
      addToast('Travel initiated', 'success');
      setTravelModal(false);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  // Eligible echoes for travel: active, not already in this shard
  const eligibleEchoes = echoList.filter(
    (e) => e.status === 'Active',
  );

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-canvas">
        <TopBar
          notificationCount={unreadCount}
          onSearchClick={() => {}}
          onNotificationClick={() => navigate('/notifications')}
          onProfileClick={() => navigate('/settings')}
        />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!activeShard) {
    return (
      <div className="flex h-screen flex-col bg-canvas">
        <TopBar
          notificationCount={unreadCount}
          onSearchClick={() => {}}
          onNotificationClick={() => navigate('/notifications')}
          onProfileClick={() => navigate('/settings')}
        />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title={t('common.error')}
            description="Shard not found"
            action={<Button onClick={() => navigate('/dashboard')}>{t('common.back')}</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => navigate('/notifications')}
        onProfileClick={() => navigate('/settings')}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          {/* Shard header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary">{activeShard.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{activeShard.description}</p>
            <div className="mt-2 flex items-center gap-3 text-sm text-text-muted">
              <Badge variant={activeShard.status === 'Active' ? 'success' : 'default'}>
                {activeShard.status}
              </Badge>
              <span>
                {t('shardView.capacity', {
                  count: activeShard.echo_count,
                  max: activeShard.max_capacity,
                })}
              </span>
              <span>{activeShard.shard_type}</span>
            </div>
          </div>

          {/* Travel button */}
          {eligibleEchoes.length > 0 && (
            <div className="mb-6">
              <Button variant="secondary" onClick={() => setTravelModal(true)}>
                <MapPin size={16} /> {t('shardView.travelHere')}
              </Button>
            </div>
          )}

          {/* Echoes in Shard */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('shardView.echoes')}
              </h2>
            </div>
            {shardEchoes.length === 0 ? (
              <EmptyState
                title={t('shardView.echoesEmpty')}
                description=""
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shardEchoes.map((echo) => (
                  <Card
                    key={echo.echo_id}
                    variant="compact"
                    onClick={() => navigate(`/echoes/${echo.echo_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-medium">
                        {echo.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{echo.name}</p>
                        <p className="text-xs text-text-muted">{echo.current_mood}</p>
                      </div>
                      <Badge
                        variant={echo.status === 'Active' ? 'success' : 'default'}
                      >
                        {echo.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Shard channel messages */}
          {shardChannel && (
            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-accent" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {t('shardView.channel')}
                </h2>
              </div>
              {channelMessages.length === 0 ? (
                <p className="text-sm text-text-muted">No messages yet</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {channelMessages.map((msg) => (
                    <Card key={msg.message_id} variant="compact">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-medium text-accent">
                            {msg.display_name}
                          </span>
                          <p className="text-sm text-text-primary">{msg.body}</p>
                        </div>
                        <span className="shrink-0 text-xs text-text-muted">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recent activity from shard feed */}
          {shardFeed.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-text-primary">Recent Activity</h2>
              <div className="flex flex-col gap-2">
                {shardFeed.slice(0, 20).map((item) => (
                  <Card key={item.item_id} variant="compact">
                    <p className="text-sm font-medium text-text-primary">{item.title}</p>
                    <p className="text-sm text-text-secondary">{item.body}</p>
                    <span className="text-xs text-text-muted">
                      {new Date(item.created_at).toLocaleDateString()}
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
        <p className="mb-3 text-sm text-text-secondary">
          Select an Echo to travel to {activeShard.name}:
        </p>
        <select
          value={selectedEchoId}
          onChange={(e) => setSelectedEchoId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary"
          aria-label="Select Echo"
        >
          <option value="">Choose an Echo...</option>
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
