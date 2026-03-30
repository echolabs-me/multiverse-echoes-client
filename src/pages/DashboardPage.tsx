import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Compass, BookOpen, Zap, Users, ExternalLink } from 'lucide-react';
import { Card, Badge, EmptyState, Button, Spinner } from '../components/index.ts';
import { EchoPortrait3D } from '../components/EchoPortrait3D.tsx';
import { ShardEnvironment3D } from '../components/ShardEnvironment3D.tsx';
import { TickPulse } from '../components/TickPulse.tsx';
import { useAmbientSoundscape } from '../hooks/useAmbientSoundscape.ts';
import { useEchoWebSocket } from '../hooks/useEchoWebSocket.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { SubscriptionExpiryBanner } from '../components/SubscriptionExpiryBanner.tsx';
import { echoes as echoApi, feeds } from '../lib/api/endpoints.ts';
import type { EchoResponse, DiaryEntry, LifeEvent, EchoRelationship, FeedItem, WsEchoEvent } from '../types/api.ts';

function EchoListItem({
  echo,
  isActive,
  onClick,
}: {
  echo: EchoResponse;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
        isActive
          ? 'bg-accent-subtle text-accent'
          : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
      }`}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-xs font-medium">
        {echo.name[0]}
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium">{echo.name}</p>
        <p className="truncate text-xs text-text-muted">{echo.current_mood}</p>
      </div>
      <Badge
        variant={echo.status === 'Active' ? 'success' : 'default'}
      >
        {echo.status}
      </Badge>
    </button>
  );
}

function LifeEventsSection({ echoId }: { echoId: string }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<LifeEvent[]>([]);

  useEffect(() => {
    void echoApi.timeline(echoId, 5).then(setEvents).catch(() => {});
  }, [echoId]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-text-muted">{t('dashboard.recentEventsEmpty')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <div key={event.event_id} className="rounded-md bg-surface-raised px-3 py-2">
          <p className="text-sm font-medium text-text-primary">{event.headline}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
            <span>{event.event_type}</span>
            <span>&middot;</span>
            <span>{new Date(event.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
      <Link
        to={`/echoes/${echoId}`}
        className="text-xs text-accent hover:text-accent/80"
      >
        {t('dashboard.viewAllEvents')}
      </Link>
    </div>
  );
}

function RelationshipsSection({ echoId }: { echoId: string }) {
  const { t } = useTranslation();
  const [relationships, setRelationships] = useState<EchoRelationship[]>([]);

  useEffect(() => {
    void echoApi.relationships(echoId).then(setRelationships).catch(() => {});
  }, [echoId]);

  if (relationships.length === 0) {
    return (
      <p className="text-sm text-text-muted">{t('dashboard.relationshipsEmpty')}</p>
    );
  }

  const top5 = [...relationships]
    .sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      {top5.map((rel) => (
        <div key={rel.relationship_id} className="flex items-center justify-between rounded-md bg-surface-raised px-3 py-2">
          <div>
            <p className="text-sm font-medium text-text-primary">{rel.echo_b_id.slice(0, 8)}</p>
            <p className="text-xs text-text-muted">{rel.relationship_type}</p>
          </div>
          <Badge variant={rel.sentiment > 0 ? 'success' : 'default'}>
            {rel.sentiment > 0 ? '+' : ''}{rel.sentiment}
          </Badge>
        </div>
      ))}
      <Link
        to={`/echoes/${echoId}`}
        className="text-xs text-accent hover:text-accent/80"
      >
        {t('dashboard.viewAllRelationships')}
      </Link>
    </div>
  );
}

function formatRelativeTime(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('communityFeed.justNow');
  if (minutes < 60) return t('communityFeed.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('communityFeed.hoursAgo', { count: hours });
  return t('communityFeed.daysAgo', { count: Math.floor(hours / 24) });
}

function CommunityPulse() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [hasNew, setHasNew] = useState(false);

  const fetchFeed = useCallback(() => {
    void feeds.community(20).then((data) => {
      setItems((prev) => {
        if (prev.length > 0 && data.length > 0 && data[0].item_id !== prev[0]?.item_id) {
          setHasNew(true);
        }
        return data;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 120000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <h3 className="text-sm font-semibold text-text-primary">{t('communityFeed.title')}</h3>
        {hasNew && (
          <button
            onClick={() => { setHasNew(false); fetchFeed(); }}
            className="ml-auto text-xs text-accent hover:text-accent/80"
          >
            {t('communityFeed.newActivity')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm italic text-text-muted">{t('communityFeed.empty')}</p>
      ) : (
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => (
            <div key={item.item_id} className="rounded-md bg-surface-raised px-3 py-2">
              <p className="truncate text-sm text-text-primary">{item.title}</p>
              <p className="text-xs text-text-muted">
                {formatRelativeTime(item.created_at, t)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ActiveEchoPanel({ echo }: { echo: EchoResponse }) {
  const { t } = useTranslation();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  // Initial load
  useEffect(() => {
    void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
  }, [echo.echo_id]);

  const { fetchEchoes } = useEchoStore();
  const wsConnectedOnceRef = useRef(false);

  // Real-time updates via Dashboard WS stream — refreshes diary on new events.
  const handleWsEvent = useCallback(
    (event: WsEchoEvent) => {
      // ConnectionEstablished: seed tick timer + catch up on reconnect.
      if (event.type === 'ConnectionEstablished') {
        if ('last_tick_at' in event) {
          const serverAt = event.last_tick_at as number;
          if (serverAt > 0) {
            writeLastTickAt(serverAt);
          }
        }
        // On reconnect (not first connect), re-fetch diary to catch missed events.
        if (wsConnectedOnceRef.current) {
          void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
          void fetchEchoes();
        }
        wsConnectedOnceRef.current = true;
      }

      if ('echo_id' in event && event.echo_id === echo.echo_id) {
        if (event.type === 'DiaryEntryCreated' || event.type === 'MoodChanged') {
          void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
          void fetchEchoes();
        }
      }
    },
    [echo.echo_id, fetchEchoes],
  );

  const handleFallbackPoll = useCallback(() => {
    void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
    void fetchEchoes();
  }, [echo.echo_id, fetchEchoes]);

  useEchoWebSocket('/ws/dashboard/stream', handleWsEvent, handleFallbackPoll);

  const latestDiary = diaryEntries[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Echo header */}
      <div className="flex items-center gap-4">
        {/* 3D mood-reactive portrait with tick pulse */}
        <TickPulse>
          <EchoPortrait3D name={echo.name} mood={echo.current_mood} size="md" />
        </TickPulse>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">{echo.name}</h2>
            <Link
              to={`/echoes/${echo.echo_id}`}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              <ExternalLink size={12} />
              {t('dashboard.viewDetail')}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Badge variant={echo.status === 'Active' ? 'success' : 'default'}>
              {echo.status}
            </Badge>
            <span>{t('dashboard.tick', { tick: echo.current_tick })}</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {t('dashboard.mood')}: {echo.current_mood}
          </p>
        </div>
      </div>

      {/* Latest Diary Entry */}
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <BookOpen size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.latestDiary')}
          </h3>
        </div>
        {latestDiary ? (
          <div>
            <p className="text-sm font-medium text-text-primary">
              {latestDiary.simulated_date} — {latestDiary.mood}
            </p>
            <p className="mt-1 text-sm text-text-secondary">{latestDiary.content}</p>
            {diaryEntries.length > 1 && (
              <Link
                to={`/echoes/${echo.echo_id}`}
                className="mt-2 inline-block text-xs text-accent hover:text-accent-hover"
              >
                {t('dashboard.viewAllDiary', { count: diaryEntries.length })}
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-text-secondary">
            {t('dashboard.latestDiaryEmpty')}
          </p>
        )}
      </Card>

      {/* Recent Life Events */}
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Zap size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.recentEvents')}
          </h3>
        </div>
        <LifeEventsSection echoId={echo.echo_id} />
      </Card>

      {/* Relationships */}
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Users size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.relationships')}
          </h3>
        </div>
        <RelationshipsSection echoId={echo.echo_id} />
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoList, activeEcho, fetchEchoes, setActiveEcho } =
    useEchoStore();
  // Ambient soundscape — plays while Dashboard is mounted.
  useAmbientSoundscape();

  // Track initial load separately so background refreshes (WS reconnect calling
  // fetchEchoes) don't flash a full-page spinner by unmounting ActiveEchoPanel.
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    void fetchEchoes().finally(() => setInitialLoadDone(true));
  }, [fetchEchoes]);

  useEffect(() => {
    if (!activeEcho && echoList.length > 0) {
      setActiveEcho(echoList[0]!);
    }
  }, [echoList, activeEcho, setActiveEcho]);

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Echo list sidebar (page-specific, inside main content area) */}
      <aside className="hidden w-56 flex-col border-r border-border bg-surface md:flex">
        <div className="flex-1 overflow-y-auto p-2">
          {/* My Echoes */}
          <div className="mb-4">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('dashboard.myEchoes')}
            </h3>
            <div className="flex flex-col gap-1">
              {echoList.map((echo) => (
                <EchoListItem
                  key={echo.echo_id}
                  echo={echo}
                  isActive={activeEcho?.echo_id === echo.echo_id}
                  onClick={() => setActiveEcho(echo)}
                />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => navigate('/onboarding/create-echo')}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            >
              <Plus size={16} />
              {t('dashboard.createNewEcho')}
            </button>
            <button
              onClick={() => navigate('/shards/browse')}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            >
              <Compass size={16} />
              {t('dashboard.browseShards')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content with 3D shard environment behind */}
      <div className="relative flex-1 overflow-y-auto p-6">
        <SubscriptionExpiryBanner />
        <ShardEnvironment3D shardName="Personal Shard" />
        {!initialLoadDone ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : activeEcho ? (
          <>
            <ActiveEchoPanel echo={activeEcho} />
            <div className="mt-6">
              <CommunityPulse />
            </div>
          </>
        ) : (
          <EmptyState
            title={t('dashboard.noEchoes')}
            description={t('dashboard.noEchoesDesc')}
            action={
              <Button onClick={() => navigate('/onboarding/create-echo')}>
                {t('dashboard.createNewEcho')}
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

function writeLastTickAt(ms: number) {
  try {
    localStorage.setItem('me_last_tick_at', String(ms));
  } catch {
    // Storage full or unavailable — non-critical.
  }
}
