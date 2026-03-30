import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { getMoodColor } from '../lib/moodColor.ts';
import { echoes as echoApi, feeds } from '../lib/api/endpoints.ts';
import type { EchoResponse, FeedItem } from '../types/api.ts';

/**
 * Mini-card Echo item for the sidebar.
 * Shows mood dot, name, mood + tick, diary preview, shard name.
 */
function EchoCard({
  echo,
  isActive,
  shardName,
  latestDiary,
  onClick,
}: {
  echo: EchoResponse;
  isActive: boolean;
  shardName: string;
  latestDiary: string | null;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const moodColor = getMoodColor(echo.current_mood);

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors ${
        isActive
          ? 'bg-accent-subtle border border-accent/30'
          : 'hover:bg-surface-raised border border-transparent'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Row 1: mood dot + name */}
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: moodColor }}
          aria-label={echo.current_mood}
        />
        <span className={`truncate text-sm font-medium ${isActive ? 'text-accent' : 'text-text-primary'}`}>
          {echo.name}
        </span>
      </div>
      {/* Row 2: mood + tick */}
      <p className="truncate text-[11px] text-text-muted pl-[18px]">
        {echo.current_mood} · {t('echoSidebar.tick', { tick: echo.current_tick })}
      </p>
      {/* Row 3: diary preview */}
      {latestDiary && (
        <p className="line-clamp-2 text-[11px] text-text-muted pl-[18px] italic leading-snug">
          &ldquo;{latestDiary}&rdquo;
        </p>
      )}
      {/* Row 4: shard name */}
      <p className="truncate text-[10px] text-text-muted pl-[18px] opacity-60">
        {shardName}
      </p>
    </button>
  );
}

/**
 * Desktop Echo sidebar — persistent mini-card list.
 * Each card is a glanceable overview; clicking navigates to full detail.
 */
export function EchoSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { echoId } = useParams<{ echoId: string }>();
  const { echoList, fetchEchoes } = useEchoStore();
  const { shardList, fetchShards } = useShardStore();
  const [diaryPreviews, setDiaryPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (echoList.length === 0) void fetchEchoes();
  }, [echoList.length, fetchEchoes]);

  useEffect(() => {
    if (shardList.length === 0) void fetchShards();
  }, [shardList.length, fetchShards]);

  // Fetch latest diary entry for each echo (1 entry each, lightweight).
  useEffect(() => {
    for (const echo of echoList) {
      if (diaryPreviews[echo.echo_id] !== undefined) continue;
      void echoApi.diary(echo.echo_id, 1).then((entries) => {
        const snippet = entries[0]?.content ?? '';
        setDiaryPreviews((prev) => ({
          ...prev,
          [echo.echo_id]: snippet.slice(0, 120),
        }));
      }).catch(() => {
        setDiaryPreviews((prev) => ({ ...prev, [echo.echo_id]: '' }));
      });
    }
  }, [echoList, diaryPreviews]);

  const shardNameMap = new Map(shardList.map((s) => [s.shard_id, s.name]));

  // Determine active echo: from URL param or from dashboard's selected echo.
  const activeId = echoId ?? (location.pathname === '/dashboard' ? echoList[0]?.echo_id : undefined);

  const handleClick = useCallback(
    (echo: EchoResponse) => {
      navigate(`/echoes/${echo.echo_id}`);
    },
    [navigate],
  );

  if (echoList.length === 0) return null;

  return (
    <aside
      className="hidden md:flex h-full w-64 flex-col border-r border-border bg-surface"
      aria-label={t('echoSidebar.title')}
    >
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {t('echoSidebar.title')}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="flex flex-col gap-1">
          {echoList.map((echo) => (
            <li key={echo.echo_id}>
              <EchoCard
                echo={echo}
                isActive={echo.echo_id === activeId}
                shardName={shardNameMap.get(echo.current_shard_id) ?? t('echoSidebar.unknownShard')}
                latestDiary={diaryPreviews[echo.echo_id] || null}
                onClick={() => handleClick(echo)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Community Pulse — echo activity feed */}
      <CommunityPulse />
    </aside>
  );
}

/**
 * Community Pulse — fixed footer in the Echo sidebar.
 * Uses the personal feed (user's own echoes' activity, no is_public filter).
 * Stays pinned at the bottom while echo cards scroll above.
 */
function CommunityPulse() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedItem[]>([]);

  const fetchFeed = useCallback(() => {
    void feeds.personal().then((data) => setItems(data.slice(0, 6))).catch(() => {});
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 60_000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return (
    <div className="flex-shrink-0 border-t border-border bg-surface-raised/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="text-xs font-semibold text-text-primary">
          {t('communityFeed.title')}
        </span>
      </div>
      {/* Feed items */}
      {items.length === 0 ? (
        <p className="px-3 pb-3 text-xs italic text-text-muted">{t('communityFeed.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1 px-2 pb-3 overflow-y-auto max-h-44">
          {items.map((item) => (
            <li key={item.item_id} className="rounded-md bg-surface px-2.5 py-1.5">
              <p className="text-xs text-text-secondary leading-snug">{item.title}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Mobile Echo switcher — dropdown at top of echo detail page.
 * Shows active echo with mood dot; tap to open overlay list.
 */
export function MobileEchoSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoId } = useParams<{ echoId: string }>();
  const { echoList, fetchEchoes } = useEchoStore();
  const { shardList, fetchShards } = useShardStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (echoList.length === 0) void fetchEchoes();
  }, [echoList.length, fetchEchoes]);

  useEffect(() => {
    if (shardList.length === 0) void fetchShards();
  }, [shardList.length, fetchShards]);

  const shardNameMap = new Map(shardList.map((s) => [s.shard_id, s.name]));
  const activeEcho = echoList.find((e) => e.echo_id === echoId);

  if (echoList.length <= 1) return null;

  return (
    <div className="md:hidden">
      {/* Switcher button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {activeEcho && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: getMoodColor(activeEcho.current_mood) }}
            />
          )}
          <span className="truncate font-medium text-text-primary">
            {activeEcho?.name ?? t('echoSidebar.selectEcho')}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown overlay */}
      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close echo switcher"
            tabIndex={-1}
          />
          <div className="absolute left-0 right-0 z-50 mx-4 mt-1 rounded-lg border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t('echoSidebar.switchEcho')}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
            <ul className="max-h-64 overflow-y-auto p-1.5">
              {echoList.map((echo) => (
                <li key={echo.echo_id}>
                  <button
                    onClick={() => {
                      navigate(`/echoes/${echo.echo_id}`);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                      echo.echo_id === echoId
                        ? 'bg-accent-subtle text-accent'
                        : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: getMoodColor(echo.current_mood) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{echo.name}</p>
                      <p className="truncate text-[11px] text-text-muted leading-tight">
                        {shardNameMap.get(echo.current_shard_id) ?? t('echoSidebar.unknownShard')}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
