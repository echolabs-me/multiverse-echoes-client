import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Compass, BookOpen, Zap, Users, ExternalLink } from 'lucide-react';
import { TopBar, Sidebar, Card, Badge, EmptyState, Button, Spinner } from '../components/index.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import type { EchoResponse } from '../types/api.ts';

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

  return (
    <div className="flex flex-col gap-6">
      {/* Echo header */}
      <div className="flex items-center gap-4">
        {/* Portrait placeholder — gradient with silhouette */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/5">
          <span className="text-3xl font-bold text-accent">{echo.name[0]}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">{echo.name}</h2>
            <Link
              to={`/echoes/${echo.echo_id}`}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
            >
              <ExternalLink size={12} />
              View detail
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Badge variant={echo.status === 'Active' ? 'success' : 'default'}>
              {echo.status}
            </Badge>
            <span>Tick {echo.current_tick}</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Mood: {echo.current_mood}
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
        <p className="text-sm italic text-text-secondary">
          Diary entries will appear here as your Echo lives its life...
        </p>
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
          Life events will appear here...
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
          Relationships will form as your Echo meets others...
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
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    void fetchEchoes();
  }, [fetchEchoes]);

  useEffect(() => {
    if (!activeEcho && echoList.length > 0) {
      setActiveEcho(echoList[0]!);
    }
  }, [echoList, activeEcho, setActiveEcho]);

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => navigate('/notifications')}
        onProfileClick={() => navigate('/settings')}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar>
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
        </Sidebar>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  );
}
