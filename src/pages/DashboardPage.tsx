import { useEffect, useState, useCallback } from 'react';
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

import { useSystemStore } from '../stores/useSystemStore.ts';
import { echoes as echoApi } from '../lib/api/endpoints.ts';
import type { EchoResponse, DiaryEntry, WsEchoEvent } from '../types/api.ts';

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

function ActiveEchoPanel({ echo }: { echo: EchoResponse }) {
  const { t } = useTranslation();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  // Initial load
  useEffect(() => {
    void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
  }, [echo.echo_id]);

  // Real-time updates via Dashboard WS stream — refreshes diary on new events.
  const handleWsEvent = useCallback(
    (event: WsEchoEvent) => {
      if (event.type === 'DiaryEntryCreated' && event.echo_id === echo.echo_id) {
        void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
      }
    },
    [echo.echo_id],
  );

  const handleFallbackPoll = useCallback(() => {
    void echoApi.diary(echo.echo_id, 100).then(setDiaryEntries).catch(() => {});
  }, [echo.echo_id]);

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
          {echo.status === 'Active' && <DashboardTickCountdown />}
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
        <p className="text-sm text-text-muted">
          {t('dashboard.recentEventsEmpty')}
        </p>
      </Card>

      {/* Relationships */}
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Users size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t('dashboard.relationships')}
          </h3>
        </div>
        <p className="text-sm text-text-muted">
          {t('dashboard.relationshipsEmpty')}
        </p>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoList, activeEcho, isLoading, fetchEchoes, setActiveEcho } =
    useEchoStore();
  // Ambient soundscape — plays while Dashboard is mounted.
  useAmbientSoundscape();

  useEffect(() => {
    void fetchEchoes();
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
        <ShardEnvironment3D shardName="Personal Shard" />
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : activeEcho ? (
          <ActiveEchoPanel echo={activeEcho} />
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

function DashboardTickCountdown() {
  const { t } = useTranslation();
  // Tick interval from server via GET /health → useSystemStore.
  // Source: config/default.toml [engine] tick_interval_seconds.
  const tickInterval = useSystemStore((s) => s.tickIntervalSeconds);
  const [seconds, setSeconds] = useState(tickInterval);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => (s <= 1 ? tickInterval : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [tickInterval]);

  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse"
        aria-hidden="true"
      />
      {t('dashboard.nextTick', { seconds })}
    </p>
  );
}
