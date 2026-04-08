import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Download,
  Zap,
  Users,
  Sparkles,
  MessageCircle,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  X,
  MoreHorizontal,
  Navigation,
  Trash2,
  Video,
  Square,
  Loader2,
} from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  Spinner,
  EmptyState,
  Modal,
  Input,
  StoryExportModal,
} from '../components/index.ts';
import { EchoPortrait3D } from '../components/EchoPortrait3D.tsx';
import { getMoodColor } from '../lib/moodColor.ts';
import { getMoodLabel } from '../lib/moodLabel.ts';
import { formatSimDate } from '../lib/formatSimDate.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { useFeedStore } from '../stores/useFeedStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useSoundStore } from '../lib/sounds.ts';
import { useMoodAtmosphere } from '../hooks/useMoodAtmosphere.ts';
import { useMoodPaletteStore } from '../stores/useMoodPaletteStore.ts';
import { MoodHistoryStrip } from '../components/MoodHistoryStrip.tsx';
import { EchoActivityHint } from '../components/EchoActivityHint.tsx';
import { MobileEchoSwitcher } from '../components/EchoSidebar.tsx';
import { EchoConversationPanel } from '../components/EchoConversationPanel.tsx';
// VoiceSessionModal temporarily hidden while audio playback is fixed
// import { VoiceSessionModal } from '../components/VoiceSessionModal.tsx';
import { echoes as echoApi, conversations } from '../lib/api/endpoints.ts';
import { account as accountApi } from '../lib/api/endpoints.ts';
import { useEchoWebSocket } from '../hooks/useEchoWebSocket.ts';
import { trackEvent } from '../lib/analytics.ts';
import { formatDate, formatDateTime } from '../lib/formatDate.ts';
import type {
  EchoRelationship,
  InfluenceBalance,
  DiaryEntry,
  Conversation,
  WsEchoEvent,
} from '../types/api.ts';

const PAGE_SIZE = 20;
const DIARY_MOODS = ['happy', 'sad', 'anxious', 'calm', 'excited', 'angry', 'contemplative', 'neutral'] as const;

/** Extract the day number from a simulated_date string like "Day 14 Hour 8". */
function parseDayNumber(simDate: string): number {
  const match = /Day\s+(\d+)/i.exec(simDate);
  return match ? parseInt(match[1], 10) : 0;
}

export function EchoDetailPage() {
  const { echoId } = useParams<{ echoId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeEcho, fetchEcho, hibernateEcho, wakeEcho, deleteEcho } = useEchoStore();
  const { shardList } = useShardStore();
  const { personalFeed, fetchPersonalFeed } = useFeedStore();
  const addToast = useToastStore((s) => s.addToast);

  // Local state
  const [relationships, setRelationships] = useState<EchoRelationship[]>([]);
  const [influence, setInfluence] = useState<InfluenceBalance | null>(null);
  // Memories are internal infrastructure — not shown in user UI.
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [diaryOffset, setDiaryOffset] = useState(0);
  const [hasMoreDiary, setHasMoreDiary] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Days the user has explicitly toggled from their default expand/collapse state.
  const [toggledDays, setToggledDays] = useState<Set<number>>(new Set());
  const [showAllPersona, setShowAllPersona] = useState(false);

  // Diary search & filter
  const [diarySearch, setDiarySearch] = useState('');
  const [moodFilter, setMoodFilter] = useState('');

  // Modal state
  const [hibernateModal, setHibernateModal] = useState(false);
  const [influenceModal, setInfluenceModal] = useState(false);
  const [influenceType, setInfluenceType] = useState('nudge');
  const [influenceDetails, setInfluenceDetails] = useState('');
  const [exportModal, setExportModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPortraitExpanded, setIsPortraitExpanded] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [resumeConversationId, setResumeConversationId] = useState<string | undefined>();
  const [pastConversations, setPastConversations] = useState<Conversation[]>([]);
  const [showPastConversations, setShowPastConversations] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [soloMode, setSoloMode] = useState(false);
  const [nudgeRipple, setNudgeRipple] = useState(false);
  const [nudgeConfirmed, setNudgeConfirmed] = useState(false);
  // Voice modal temporarily hidden while audio playback is fixed
  // const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Mood atmosphere — derive from latest diary entry or echo's current_mood.
  const moodContainerRef = useRef<HTMLDivElement>(null);
  const currentMood = diaryEntries[0]?.mood ?? activeEcho?.current_mood ?? null;
  const moodPalette = useMoodAtmosphere(moodContainerRef, currentMood);

  // Publish palette to shared store so AppLayout can render gradient + particles
  // across the full width (pulse pane, echo sidebar, and main content).
  const setPalette = useMoodPaletteStore((s) => s.setPalette);
  useEffect(() => {
    setPalette(moodPalette);
  }, [moodPalette, setPalette]);

  // Track which diary IDs were present on initial load (no animation for those).
  const knownDiaryIdsRef = useRef<Set<string>>(new Set());
  const [newDiaryIds, setNewDiaryIds] = useState<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const playSound = useSoundStore((s) => s.play);

  // Stable ref for echoId so polling doesn't depend on store function refs.
  const echoIdRef = useRef(echoId);
  echoIdRef.current = echoId;

  // Debounce fetchEchoes — multiple DiaryEntryCreated events fire per tick
  // (one per Echo), but we only need one list refresh after all are done.
  const fetchEchoesTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debouncedFetchEchoes = useCallback(() => {
    clearTimeout(fetchEchoesTimerRef.current);
    fetchEchoesTimerRef.current = setTimeout(() => {
      void useEchoStore.getState().fetchEchoes();
    }, 2000);
  }, []);

  const loadData = useCallback(async () => {
    if (!echoId) return;
    setIsLoading(true);
    // Reset animation tracking for new echo.
    initialLoadDoneRef.current = false;
    knownDiaryIdsRef.current.clear();
    setNewDiaryIds(new Set());
    setDiaryOffset(0);
    try {
      await fetchEcho(echoId);
      const [rels, inf, diary] = await Promise.all([
        echoApi.relationships(echoId).catch(() => [] as EchoRelationship[]),
        echoApi.influence(echoId).catch(() => null),
        echoApi.diary(echoId, PAGE_SIZE, 0).catch(() => [] as DiaryEntry[]),
      ]);
      setRelationships(rels);
      setInfluence(inf);
      // Initial load — mark all existing entries as known (no animation).
      knownDiaryIdsRef.current = new Set(diary.map((d) => d.diary_id));
      initialLoadDoneRef.current = true;
      setDiaryEntries(diary);
      setDiaryOffset(diary.length);
      setHasMoreDiary(diary.length >= PAGE_SIZE);
      await fetchPersonalFeed(echoId);
      const convList = await conversations.list(echoId).catch(() => [] as Conversation[]);
      setPastConversations(convList);
      // Load solo_mode
      const privacy = await accountApi.getPrivacy().catch(() => ({ solo_mode: false }));
      setSoloMode(privacy.solo_mode);
      trackEvent('diary.viewed', { echo_id: echoId });
    } finally {
      setIsLoading(false);
    }
  }, [echoId, fetchEcho, fetchPersonalFeed]);

  const loadMoreDiary = useCallback(async () => {
    if (!echoId || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const activeMood = moodFilter || undefined;
      const more = await echoApi.diary(echoId, PAGE_SIZE, diaryOffset, activeMood);
      if (more.length > 0) {
        const newEntries = more.filter(
          (m) => !diaryEntries.some((d) => d.diary_id === m.diary_id),
        );
        setDiaryEntries((prev) => [...prev, ...newEntries]);
        setDiaryOffset((prev) => prev + more.length);
      }
      setHasMoreDiary(more.length >= PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  }, [echoId, diaryOffset, isLoadingMore, diaryEntries, moodFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Reset per-echo UI state when switching echoes via the sidebar.
  useEffect(() => {
    setToggledDays(new Set());
    setDiarySearch('');
    setMoodFilter('');
    setShowAllPersona(false);
    setShowConversation(false);
    setResumeConversationId(undefined);
    setShowPastConversations(false);
    setShowMoreMenu(false);
  }, [echoId]);

  // Re-fetch diary when mood filter changes (without full page reload).
  // Track the max number of entries the user has loaded (for filter clear restore).
  const maxLoadedRef = useRef(PAGE_SIZE);
  useEffect(() => {
    if (diaryEntries.length > maxLoadedRef.current) {
      maxLoadedRef.current = diaryEntries.length;
    }
  }, [diaryEntries.length]);

  // Escape-to-close for the expanded portrait lightbox. Only bound while open
  // so we're not leaving a global listener attached on every Echo detail view.
  useEffect(() => {
    if (!isPortraitExpanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPortraitExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPortraitExpanded]);

  const moodFilterInitRef = useRef(true);
  useEffect(() => {
    // Skip on initial mount — loadData already fetched.
    if (moodFilterInitRef.current) {
      moodFilterInitRef.current = false;
      return;
    }
    if (!echoId) return;
    const activeMood = moodFilter || undefined;
    // When clearing a filter, re-fetch all entries up to what was previously loaded.
    const limit = activeMood ? PAGE_SIZE : Math.max(PAGE_SIZE, maxLoadedRef.current);
    void echoApi.diary(echoId, limit, 0, activeMood).then((diary) => {
      setDiaryEntries(diary);
      setDiaryOffset(diary.length);
      setHasMoreDiary(diary.length >= PAGE_SIZE);
    }).catch(() => {});
  }, [echoId, moodFilter]);

  // WebSocket live updates — replaces 30-second polling.
  // On DiaryEntryCreated: fetch new diary and trigger arrival animation.
  // On MoodChanged: refresh echo state for mood atmosphere update.
  // Falls back to polling on disconnect.
  const wsConnectedOnceRef = useRef(false);
  const handleWsEvent = useCallback(
    (event: WsEchoEvent) => {
      // ConnectionEstablished: seed tick timer + catch up on reconnect.
      if (event.type === 'ConnectionEstablished') {
        if ('last_tick_at' in event) {
          const serverAt = event.last_tick_at as number;
          if (serverAt > 0) {
            try { localStorage.setItem('me_last_tick_at', String(serverAt)); } catch { /* noop */ }
          }
        }
        // On reconnect, re-fetch diary to catch missed events.
        const id = echoIdRef.current;
        if (wsConnectedOnceRef.current && id) {
          void echoApi.diary(id).then((d) => {
            const arrivals = d.filter((e) => !knownDiaryIdsRef.current.has(e.diary_id));
            if (arrivals.length > 0) {
              const arrivalIds = new Set(arrivals.map((e) => e.diary_id));
              setNewDiaryIds((prev) => new Set([...prev, ...arrivalIds]));
            }
            setDiaryEntries(d);
          }).catch(() => {});
          void useEchoStore.getState().fetchEcho(id);
        }
        wsConnectedOnceRef.current = true;
      }

      const id = echoIdRef.current;
      if (!id) return;
      if (event.type === 'ShardTravelCompleted' || event.type === 'EchoMoved') {
        trackEvent('echo.travel_completed', { echo_id: id });
      }
      if (event.type === 'DiaryEntryCreated') {
        void echoApi
          .diary(id)
          .then((d) => {
            if (initialLoadDoneRef.current) {
              const arrivals = d.filter((e) => !knownDiaryIdsRef.current.has(e.diary_id));
              if (arrivals.length > 0) {
                const arrivalIds = new Set(arrivals.map((e) => e.diary_id));
                setNewDiaryIds((prev) => new Set([...prev, ...arrivalIds]));
                playSound('diary_entry');
              }
            }
            setDiaryEntries(d);
          })
          .catch(() => {});
        // Re-fetch echo metadata so current_tick and current_mood stay in sync.
        // fetchEchoes is debounced — multiple diary events per tick coalesce
        // into one list refresh after all echoes have been processed.
        void useEchoStore.getState().fetchEcho(id);
        debouncedFetchEchoes();
        void useFeedStore.getState().fetchPersonalFeed(id);
      } else if (event.type === 'DiaryImageReady') {
        // Background image generation completed — re-fetch diary to get image_url
        void echoApi
          .diary(id)
          .then((d) => setDiaryEntries(d))
          .catch(() => {});
      } else if (event.type === 'MoodChanged') {
        void useEchoStore.getState().fetchEcho(id);
      } else if (event.type === 'LifeEventOccurred') {
        void useFeedStore.getState().fetchPersonalFeed(id);
      } else if (event.type === 'NotificationCreated') {
        void useNotificationStore.getState().fetchNotifications();
      } else if (event.type === 'EchoAvatarReady') {
        // Portrait generated — re-fetch echo to get avatar_url
        void useEchoStore.getState().fetchEcho(id);
      }
    },
    [playSound, debouncedFetchEchoes],
  );

  const handleFallbackPoll = useCallback(() => {
    const id = echoIdRef.current;
    if (!id) return;
    void useEchoStore.getState().fetchEcho(id);
    void echoApi
      .diary(id)
      .then((d) => {
        if (initialLoadDoneRef.current) {
          const arrivals = d.filter((e) => !knownDiaryIdsRef.current.has(e.diary_id));
          if (arrivals.length > 0) {
            const arrivalIds = new Set(arrivals.map((e) => e.diary_id));
            setNewDiaryIds((prev) => new Set([...prev, ...arrivalIds]));
            playSound('diary_entry');
          }
        }
        setDiaryEntries(d);
      })
      .catch(() => {});
    void useFeedStore.getState().fetchPersonalFeed(id);
  }, [playSound]);

  const wsPath = echoId ? `/ws/echoes/${echoId}/stream` : null;
  useEchoWebSocket(wsPath, handleWsEvent, handleFallbackPoll);

  // After glow animation finishes, move diary ID from "new" to "known".
  const handleAnimationEnd = useCallback((diaryId: string) => {
    knownDiaryIdsRef.current.add(diaryId);
    setNewDiaryIds((prev) => {
      const next = new Set(prev);
      next.delete(diaryId);
      return next;
    });
  }, []);

  // Life events still come from the feed store (no dedicated Redb repo yet).
  const lifeEvents = personalFeed.filter((f) => f.item_type === 'life_event');

  // Apply client-side text search filter, then group by simulated day.
  const filteredDiary = useMemo(() => {
    if (!diarySearch.trim()) return diaryEntries;
    const term = diarySearch.toLowerCase();
    return diaryEntries.filter((e) => e.content.toLowerCase().includes(term));
  }, [diaryEntries, diarySearch]);

  const diaryByDay = useMemo(() => {
    const groups: { day: number; entries: DiaryEntry[] }[] = [];
    const dayMap = new Map<number, DiaryEntry[]>();
    for (const entry of filteredDiary) {
      const day = parseDayNumber(entry.simulated_date);
      const existing = dayMap.get(day);
      if (existing) {
        existing.push(entry);
      } else {
        const arr = [entry];
        dayMap.set(day, arr);
        groups.push({ day, entries: arr });
      }
    }
    return groups;
  }, [filteredDiary]);

  // Current day is the highest day number (first group since entries are newest-first).
  const currentDay = diaryByDay.length > 0 ? diaryByDay[0].day : -1;

  const toggleDay = useCallback((day: number) => {
    setToggledDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }, []);

  const handleDeleteEcho = async () => {
    if (!activeEcho) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteEcho(activeEcho.echo_id);
      trackEvent('echo.deleted', { echo_id: activeEcho.echo_id });
      setDeleteModal(false);
      addToast(t('echoDetail.deleted'), 'success');
      // Echo no longer exists — return to the dashboard. Note: '/' is a
      // Navigate-to-login redirect (see App.tsx), NOT the dashboard route.
      navigate('/dashboard');
    } catch {
      setDeleteError(t('echoDetail.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHibernateWake = async () => {
    if (!activeEcho) return;
    try {
      if (activeEcho.status === 'Active') {
        await hibernateEcho(activeEcho.echo_id);
        trackEvent('echo.hibernated', { reason: 'manual' });
        addToast(t('echoDetail.hibernated'), 'success');
      } else {
        await wakeEcho(activeEcho.echo_id);
        trackEvent('echo.woken');
        addToast(t('echoDetail.woken'), 'success');
      }
      setHibernateModal(false);
      await fetchEcho(activeEcho.echo_id);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleUseInfluence = async () => {
    if (!activeEcho) return;
    if (!influenceDetails.trim()) {
      addToast(t('echoDetail.influenceDetailsRequired'), 'danger');
      return;
    }
    try {
      await echoApi.useInfluence(activeEcho.echo_id, {
        influence_type: influenceType,
        suggestion: influenceDetails.trim(),
      });
      trackEvent('nudge.sent', { echo_id: activeEcho.echo_id, influence_type: influenceType });
      setInfluenceModal(false);
      setInfluenceDetails('');
      // Show inline confirmation (guaranteed visible, not dependent on toast z-index)
      setNudgeConfirmed(true);
      setTimeout(() => setNudgeConfirmed(false), 4000);
      // Also fire toast as backup
      console.log('[ME] Nudge toast firing:', t('echoDetail.influenceUsed'));
      addToast(t('echoDetail.influenceUsed'), 'success');
      // Trigger ripple animation + sound
      playSound('influence');
      setNudgeRipple(true);
      setTimeout(() => setNudgeRipple(false), 800);
      // Refresh influence balance
      const inf = await echoApi.influence(activeEcho.echo_id).catch(() => null);
      setInfluence(inf);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };



  const handleSoloModeToggle = async () => {
    try {
      await accountApi.updatePrivacy({ solo_mode: !soloMode });
      setSoloMode(!soloMode);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!activeEcho) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          title={t('echoDetail.echoNotFound')}
          description={t('echoDetail.echoNotFoundDesc')}
          action={<Button onClick={() => navigate('/dashboard')}>{t('common.back')}</Button>}
        />
      </div>
    );
  }

  const personaTruncated = activeEcho.persona_text.length > 200 && !showAllPersona;

  return (
    <div className="flex h-full">
      {/* Main content — shrinks when conversation panel is open on desktop */}
      <div ref={moodContainerRef} className={`relative flex h-full flex-col ${showConversation ? 'w-[60%]' : 'w-full'} transition-[width] duration-300`}>
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          {/* Mobile Echo switcher — dropdown for quick navigation */}
          <div className="relative mb-4">
            <MobileEchoSwitcher />
          </div>

          {/* Echo header */}
          <div className="mb-6 flex items-start gap-4">
            {activeEcho.avatar_url ? (
              <button
                type="button"
                onClick={() => setIsPortraitExpanded(true)}
                aria-label={t('echoDetail.viewPortrait')}
                className="shrink-0 rounded-xl transition-transform duration-[var(--duration-fast)] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <EchoPortrait3D name={activeEcho.name} mood={activeEcho.current_mood} size="lg" avatarUrl={activeEcho.avatar_url} />
              </button>
            ) : (
              <EchoPortrait3D name={activeEcho.name} mood={activeEcho.current_mood} size="lg" avatarUrl={activeEcho.avatar_url} />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">{activeEcho.name}</h1>
                <Badge variant={activeEcho.status === 'Active' ? 'success' : 'default'}>
                  {activeEcho.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {t('echoDetail.createdOn', {
                  date: formatDate(activeEcho.created_at),
                })}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {t('dashboard.mood')}: {getMoodLabel(activeEcho.current_mood)} &middot; {t('dashboard.tick', { tick: activeEcho.current_tick })}
              </p>
            </div>
          </div>

          {/* What-if prompt */}
          <Card variant="compact">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-primary">{t('echoDetail.whatIf')}</h3>
            </div>
            <p className="text-sm italic text-text-secondary">
              &ldquo;{activeEcho.what_if_prompt}&rdquo;
            </p>
          </Card>

          {/* Persona */}
          <Card variant="compact">
            <div className="mb-1 flex items-center gap-2">
              <Settings size={16} className="text-accent" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-primary">{t('echoDetail.persona')}</h3>
            </div>
            <p className="text-sm text-text-secondary">
              {personaTruncated
                ? activeEcho.persona_text.slice(0, 200) + '...'
                : activeEcho.persona_text}
            </p>
            {activeEcho.persona_text.length > 200 && (
              <button
                onClick={() => setShowAllPersona(!showAllPersona)}
                className="mt-1 flex items-center gap-1 text-xs text-accent hover:text-accent/80"
              >
                {showAllPersona ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAllPersona ? t('common.showLess') : t('common.showMore')}
              </button>
            )}
          </Card>

          {/* Action Toolbar */}
          <div className="my-4 space-y-2">
            {/* Primary actions — Talk + Nudge (top row), Voice Call (full width bottom) */}
            <div className="flex gap-2">
              {/* Talk — primary CTA */}
              <button
                onClick={() => {
                  if (window.innerWidth >= 768) {
                    setResumeConversationId(undefined);
                    setShowConversation((prev) => !prev);
                  } else {
                    navigate(`/echoes/${activeEcho.echo_id}/talk`);
                  }
                }}
                disabled={activeEcho.status === 'Hibernated'}
                className={`action-btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  showConversation
                    ? 'bg-accent text-canvas shadow-md shadow-accent/20'
                    : 'bg-accent text-canvas shadow-md shadow-accent/20 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/30'
                }`}
              >
                <MessageCircle size={18} /> {t('echoDetail.talkToEcho')}
              </button>
              {/* Nudge */}
              <div className="relative flex-1">
                <button
                  onClick={() => setInfluenceModal(true)}
                  disabled={activeEcho.status === 'Hibernated'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Zap size={18} className="text-amber-400" /> {t('echoDetail.useInfluence')}
                  {influence && influence.daily_limit < 1000 && (
                    <span className="ms-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {influence.remaining}
                    </span>
                  )}
                </button>
                {nudgeRipple && (
                  <span className="pointer-events-none absolute inset-0 rounded-xl animate-nudge-ripple" aria-hidden="true" />
                )}
              </div>
            </div>
            {/* Voice Call — temporarily hidden while audio playback is fixed */}
            {/* Nudge confirmation banner */}
            {nudgeConfirmed && (
              <div className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success animate-slide-in">
                <Zap size={12} /> {t('echoDetail.influenceUsed')}
              </div>
            )}
            {/* More actions overflow menu — secondary */}
            <div className="relative inline-flex">
              <button
                onClick={() => setShowMoreMenu((p) => !p)}
                className="action-btn flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted hover:border-border hover:text-text-secondary transition-all"
                aria-label={t('common.more')}
              >
                <MoreHorizontal size={14} /> {t('common.more')}
              </button>
              {showMoreMenu && (
                <>
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowMoreMenu(false)}
                    aria-label={t('echoDetail.closeMenuAriaLabel')}
                    tabIndex={-1}
                  />
                  <div className="absolute start-0 z-50 mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg py-1">
                    <button
                      onClick={() => { setHibernateModal(true); setShowMoreMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
                    >
                      {activeEcho.status === 'Active'
                        ? <Moon size={14} className="text-blue-400" />
                        : <Sun size={14} className="text-amber-400" />}
                      {activeEcho.status === 'Active' ? t('echoDetail.hibernate') : t('echoDetail.wake')}
                    </button>
                    <button
                      onClick={() => { setExportModal(true); setShowMoreMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
                    >
                      <Download size={14} className="text-sky-400" /> {t('echoDetail.exportStory')}
                    </button>
                    <div className="my-1 border-t border-border" role="separator" />
                    <button
                      onClick={() => { setDeleteError(null); setDeleteModal(true); setShowMoreMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} /> {t('echoDetail.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Past Conversations */}
          {pastConversations.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowPastConversations((p) => !p)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-start text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
              >
                <MessageCircle size={14} />
                {t('conversation.pastConversations', { name: activeEcho.name, count: pastConversations.length })}
                {showPastConversations ? <ChevronUp size={14} className="ms-auto" /> : <ChevronDown size={14} className="ms-auto" />}
              </button>
              {showPastConversations && (
                <div className="mt-2 space-y-1.5">
                  {pastConversations.map((conv) => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => {
                        setResumeConversationId(conv.conversation_id);
                        setShowConversation(true);
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-start text-xs transition-colors hover:bg-surface-raised"
                    >
                      <span className="text-text-primary">
                        {formatDateTime(conv.created_at, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {conv.saved && (
                        <Badge variant="success">{t('conversation.saved')}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mood history strip */}
          <MoodHistoryStrip entries={diaryEntries} className="mb-6" />

          {/* Activity hint — ambient flavour between ticks */}
          {activeEcho.status === 'Active' && (
            <EchoActivityHint
              mood={currentMood}
              locationName={diaryEntries[0]?.location_name}
              className="mb-3"
            />
          )}

          {/* Travel indicator — Echo moved to new shard but hasn't ticked yet */}
          {activeEcho && activeEcho.status === 'Active' && (
            diaryEntries.length === 0 ||
            diaryEntries[0]?.shard_id !== activeEcho.current_shard_id
          ) && (() => {
            const shardName = shardList.find((s) => s.shard_id === activeEcho.current_shard_id)?.name ?? activeEcho.current_shard_id;
            return (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                <Navigation size={18} className="shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {t('echoDetail.travellingTo', { shard: shardName })}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t('echoDetail.travellingDesc')}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Diary entries */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">{t('echoDetail.diary')}</h2>
            </div>
            {/* Diary search and filter bar — always visible when entries exist or a filter is active */}
            {(diaryEntries.length > 0 || moodFilter || diarySearch) && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                  <input
                    type="text"
                    value={diarySearch}
                    onChange={(e) => setDiarySearch(e.target.value)}
                    placeholder={t('echoDetail.searchDiary')}
                    className="w-full rounded-lg border border-border bg-surface py-1.5 ps-8 pe-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <select
                  value={moodFilter}
                  onChange={(e) => setMoodFilter(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  aria-label={t('echoDetail.filterMood')}
                >
                  <option value="">{t('echoDetail.allMoods')}</option>
                  {DIARY_MOODS.map((mood) => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </select>
                {(diarySearch || moodFilter) && (
                  <button
                    onClick={() => { setDiarySearch(''); setMoodFilter(''); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-text-muted hover:text-text-primary"
                  >
                    <X size={14} />
                    {t('echoDetail.clearFilters')}
                  </button>
                )}
              </div>
            )}
            {diaryEntries.length === 0 && !moodFilter && !diarySearch ? (
              <EmptyState
                title={t('echoDetail.diaryEmpty')}
                description={t('echoDetail.diaryEmptyDesc')}
              />
            ) : filteredDiary.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm italic text-text-secondary">{t('echoDetail.noFilterMatch')}</p>
                <Button
                  variant="secondary"
                  onClick={() => { setDiarySearch(''); setMoodFilter(''); }}
                >
                  {t('echoDetail.clearFilters')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {diaryByDay.map(({ day, entries }) => {
                  const isCurrentDay = day === currentDay;
                  const defaultExpanded = isCurrentDay;
                  const expanded = toggledDays.has(day) ? !defaultExpanded : defaultExpanded;
                  return (
                    <div key={day}>
                      <button
                        onClick={() => toggleDay(day)}
                        className="mb-2 flex w-full items-center gap-2 border-b border-accent/20 pb-1 text-start"
                      >
                        {expanded ? (
                          <ChevronDown size={16} className="text-accent" />
                        ) : (
                          <ChevronRight size={16} className="text-accent" />
                        )}
                        <span className="text-sm font-semibold text-accent">
                          {t('echoDetail.simulatedDay', { day })}
                        </span>
                        <span className="text-xs text-text-muted">
                          ({entries.length})
                        </span>
                      </button>
                      {expanded && (
                        <div className="mb-3 flex flex-col gap-3 ps-2">
                          {entries.map((entry) => (
                            <DiaryCard
                              key={entry.diary_id}
                              entry={entry}
                              isNew={newDiaryIds.has(entry.diary_id)}
                              onAnimationEnd={handleAnimationEnd}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {hasMoreDiary && (
                  <InfiniteScrollTrigger
                    onVisible={() => void loadMoreDiary()}
                    isLoading={isLoadingMore}
                  />
                )}
              </div>
            )}
          </section>

          {/* Life Events */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Zap size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">{t('echoDetail.events')}</h2>
            </div>
            {lifeEvents.length === 0 ? (
              <EmptyState
                title={t('echoDetail.eventsEmpty')}
                description={t('echoDetail.eventsEmptyDesc')}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {lifeEvents.map((event) => (
                  <Card
                    key={event.item_id}
                    variant="compact"
                    style={{
                      boxShadow: '0 0 14px 3px rgba(243,156,18,0.12)',
                      borderLeft: '3px solid rgba(243,156,18,0.4)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{event.title}</p>
                        <p className="text-sm text-text-secondary">{event.body}</p>
                      </div>
                      <span className="shrink-0 text-xs text-text-muted">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Relationships */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('echoDetail.relationships')}
              </h2>
            </div>
            {relationships.length === 0 ? (
              <EmptyState
                title={t('echoDetail.relationshipsEmpty')}
                description={t('echoDetail.relationshipsEmptyDesc')}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {relationships.map((rel) => {
                  const sentimentPct = Math.round(
                    (rel.sentiment / 1000) * 100
                  );
                  const sentimentColor =
                    sentimentPct >= 60
                      ? 'text-emerald-400'
                      : sentimentPct >= 30
                        ? 'text-amber-400'
                        : 'text-red-400';

                  // Sentiment glow: emerald (warm), amber (neutral), red (cold)
                  const glowRgb = sentimentPct >= 60
                    ? '16,185,129'   // emerald-500
                    : sentimentPct >= 30
                      ? '245,158,11' // amber-500
                      : '239,68,68'; // red-500

                  return (
                    <Card
                      key={rel.relationship_id}
                      variant="compact"
                      style={{
                        boxShadow: `0 0 14px 3px rgba(${glowRgb},0.12)`,
                        borderLeft: `3px solid rgba(${glowRgb},0.4)`,
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {rel.other_echo_name ?? t('relationships.unknownEcho')}
                          </p>
                          {rel.other_echo_owner_name && (
                            <p className="text-xs text-text-muted">
                              by {rel.other_echo_owner_name}
                            </p>
                          )}
                          <p className="text-xs text-accent">{t(`relationships.${rel.relationship_type}`, { defaultValue: rel.relationship_type })}</p>
                        </div>
                        <Badge variant={rel.status === 'Active' ? 'success' : 'default'}>
                          {t(`relationships.${rel.status}`, { defaultValue: rel.status })}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                          <span>{t('echoDetail.sentiment')}</span>
                          <span className={sentimentColor}>{sentimentPct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-raised">
                          <div
                            className={`h-1.5 rounded-full ${sentimentPct >= 60 ? 'bg-emerald-500' : sentimentPct >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, sentimentPct))}%` }}
                          />
                        </div>
                      </div>
                      {rel.is_cross_user && (
                        <p className="mt-1 text-[10px] text-text-secondary">
                          {t('echoDetail.crossUser')}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Memories — hidden from user UI (internal infrastructure for tick context) */}

          {/* Echo Settings */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Settings size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('echoDetail.settings')}
              </h2>
            </div>
            <Card variant="compact">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={soloMode}
                  onChange={handleSoloModeToggle}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                <span className="text-sm text-text-primary">
                  {t('echoDetail.soloMode')}
                </span>
              </label>
            </Card>
          </section>
        </div>
      </div>

      {/* Portrait Lightbox — full-resolution portrait overlay */}
      {isPortraitExpanded && activeEcho.avatar_url && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setIsPortraitExpanded(false)}
          aria-label={t('echoDetail.closePortrait')}
        >
          <span
            className="absolute top-4 end-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-hidden="true"
          >
            <X size={20} />
          </span>
          <img
            src={activeEcho.avatar_url}
            alt={t('echoDetail.portraitAltFull', { name: activeEcho.name })}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </button>
      )}

      {/* Delete Echo Modal */}
      <Modal
        open={deleteModal}
        onClose={() => {
          if (isDeleting) return;
          setDeleteModal(false);
          setDeleteError(null);
        }}
        title={t('echoDetail.deleteConfirmTitle', { name: activeEcho.name })}
      >
        <p className="mb-4 text-sm text-text-secondary">
          {t('echoDetail.deleteConfirmBody')}
        </p>
        {deleteError && (
          <p className="mb-3 text-sm text-red-500" role="alert">
            {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setDeleteModal(false);
              setDeleteError(null);
            }}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleDeleteEcho()}
            disabled={isDeleting}
          >
            {isDeleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
            {t('echoDetail.deleteConfirmAction')}
          </Button>
        </div>
      </Modal>

      {/* Hibernate/Wake Modal */}
      <Modal
        open={hibernateModal}
        onClose={() => setHibernateModal(false)}
        title={activeEcho.status === 'Active' ? t('echoDetail.hibernate') : t('echoDetail.wake')}
      >
        <p className="mb-4 text-sm text-text-secondary">
          {activeEcho.status === 'Active'
            ? t('echoDetail.hibernateConfirm')
            : t('echoDetail.wakeConfirm')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setHibernateModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleHibernateWake()}>{t('common.confirm')}</Button>
        </div>
      </Modal>

      {/* Influence Modal */}
      <Modal
        open={influenceModal}
        onClose={() => setInfluenceModal(false)}
        title={t('echoDetail.useInfluence')}
      >
        <p className="mb-2 text-xs text-text-secondary">
          {t('echoDetail.influenceHelperText')}
        </p>
        {influence && influence.daily_limit < 1000 && (
          <p className="mb-3 text-xs text-text-secondary">
            {t('echoDetail.influenceBudgetInfo', {
              remaining: influence.remaining,
              limit: influence.daily_limit,
            })}
          </p>
        )}
        <div className="mb-4 flex flex-col gap-3">
          <select
            value={influenceType}
            onChange={(e) => setInfluenceType(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label={t('echoDetail.influenceType')}
          >
            <option value="nudge">{t('echoDetail.influenceNudge')}</option>
            <option value="suggest_activity">{t('echoDetail.influenceSuggest')}</option>
            <option value="hint_relationship">{t('echoDetail.influenceInspire')}</option>
          </select>
          <Input
            label={t('echoDetail.influenceDetailsLabel')}
            value={influenceDetails}
            onChange={(e) => setInfluenceDetails(e.target.value)}
            placeholder={t('echoDetail.influenceDetailsPlaceholder')}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setInfluenceModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void handleUseInfluence()}
            disabled={influence !== null && influence.remaining <= 0}
          >
            {t('echoDetail.useInfluence')}
          </Button>
        </div>
      </Modal>



      {/* Story Export Modal */}
      <StoryExportModal
        open={exportModal}
        onClose={() => setExportModal(false)}
        echoName={activeEcho.name}
        echoId={activeEcho.echo_id}
      />

      {/* Voice Session Modal — temporarily hidden while audio playback is fixed */}

    </div>

      {/* Conversation side panel — tablet landscape + desktop (>= 768px) */}
      {showConversation && activeEcho && (
        <div className="hidden h-full w-[40%] md:block">
          <EchoConversationPanel
            key={resumeConversationId ?? 'active'}
            echoId={activeEcho.echo_id}
            echoName={activeEcho.name}
            echoMood={activeEcho.current_mood}
            onClose={() => setShowConversation(false)}
            resumeConversationId={resumeConversationId}
          />
        </div>
      )}

    </div>
  );
}

function DiaryCard({
  entry,
  isNew,
  onAnimationEnd,
}: {
  entry: DiaryEntry;
  isNew?: boolean;
  onAnimationEnd?: (diaryId: string) => void;
}) {
  const { t } = useTranslation();
  const mc = getMoodColor(entry.mood);
  const r = parseInt(mc.slice(1, 3), 16);
  const g = parseInt(mc.slice(3, 5), 16);
  const b = parseInt(mc.slice(5, 7), 16);

  // Video narration playback state
  const [videoState, setVideoState] = useState<
    'idle' | 'generating' | 'ready' | 'playing' | 'paused' | 'error'
  >('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [generateProgress, setGenerateProgress] = useState(0);

  const handleWatchNarration = useCallback(async () => {
    // Playing → pause
    if (videoState === 'playing' && videoRef.current) {
      videoRef.current.pause();
      setVideoState('paused');
      return;
    }
    // Paused → resume
    if (videoState === 'paused' && videoRef.current) {
      try {
        await videoRef.current.play();
        setVideoState('playing');
      } catch (e) {
        console.error('Video resume failed:', e);
        setVideoState('error');
      }
      return;
    }
    // Ready → play again from start
    if (videoState === 'ready' && videoRef.current) {
      videoRef.current.currentTime = 0;
      try {
        await videoRef.current.play();
        setVideoState('playing');
      } catch (e) {
        console.error('Video replay failed:', e);
        setVideoState('error');
      }
      return;
    }

    // Idle/error → start generation + poll
    setVideoState('generating');
    setGenerateProgress(0);

    try {
      // Step 1: POST to start generation (or get cached video instantly).
      const startResult = await echoApi.narrateVideoStart(entry.echo_id, entry.diary_id);

      if ('cached' in startResult) {
        // Cache hit — video returned immediately.
        const blob = new Blob([startResult.cached], { type: 'video/mp4' });
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = URL.createObjectURL(blob);
        setGenerateProgress(100);
        setVideoState('ready');
        return;
      }

      // Step 2: Poll status every 2.5s until complete.
      const { jobId } = startResult;
      let attempts = 0;
      const maxAttempts = 60; // 60 × 2.5s = 150s max

      const poll = async (): Promise<void> => {
        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2500));
          attempts++;

          const status = await echoApi.narrateVideoStatus(entry.echo_id, entry.diary_id, jobId);

          if (status.status === 'generating') {
            setGenerateProgress(status.progress ?? Math.min(attempts * 2, 95));
            continue;
          }

          if (status.status === 'complete') {
            // Step 3: Fetch the video.
            setGenerateProgress(95);
            const videoBlob = await echoApi.narrateVideoResult(entry.echo_id, entry.diary_id, jobId);
            const blob = new Blob([videoBlob], { type: 'video/mp4' });
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = URL.createObjectURL(blob);
            setGenerateProgress(100);
            setVideoState('ready');
            return;
          }

          if (status.status === 'failed') {
            throw new Error(status.error ?? 'Video generation failed');
          }
        }
        throw new Error('Video generation timed out');
      };

      await poll();
    } catch (e) {
      console.error('Video narration failed:', e);
      setVideoState('error');
    }
  }, [videoState, entry.echo_id, entry.diary_id]);

  // Auto-play when video becomes ready and ref is set
  const handleVideoReady = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && blobUrlRef.current) {
      el.src = blobUrlRef.current;
      el.onended = () => setVideoState('ready');
      el.onerror = () => setVideoState('error');
      el.play().then(() => setVideoState('playing')).catch(() => setVideoState('error'));
    }
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id={`diary-${entry.diary_id}`}
      className={isNew ? 'animate-diary-arrive' : ''}
      style={isNew ? { opacity: 0 } : undefined}
    >
      <Card
        className={isNew ? 'animate-diary-glow' : ''}
        style={{
          boxShadow: `0 0 14px 3px rgba(${r},${g},${b},0.12)`,
          borderLeft: `3px solid rgba(${r},${g},${b},0.35)`,
        }}
        onAnimationEnd={
          isNew
            ? () => onAnimationEnd?.(entry.diary_id)
            : undefined
        }
      >
        {entry.image_url && (
          <img
            src={entry.image_url}
            alt="Scene from diary entry"
            loading="eager"
            className="w-full aspect-video rounded-lg mb-3 animate-fade-in object-cover"
          />
        )}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">
              {formatSimDate(entry.simulated_date)} — {getMoodLabel(entry.mood)}
            </p>
            <p className="mt-1 text-sm text-text-secondary">{entry.content}</p>
            <p className="mt-1 text-xs text-text-secondary">{entry.location_name}</p>
          </div>
          <div className="ms-3 flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs text-text-muted">
              {formatDate(entry.created_at)}
            </span>
          </div>
        </div>
        {/* Video narration: button + inline player */}
        {(videoState === 'ready' || videoState === 'playing' || videoState === 'paused') && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={handleVideoReady}
            className="mt-3 w-full rounded-lg"
            controls
            playsInline
          />
        )}
        <button
          onClick={handleWatchNarration}
          disabled={videoState === 'generating'}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {videoState === 'generating' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{t('diary.generatingVideo')} {Math.round(generateProgress)}%</span>
            </>
          ) : videoState === 'playing' ? (
            <>
              <Square size={16} />
              <span>{t('diary.playingVideo')}</span>
            </>
          ) : videoState === 'ready' ? (
            <>
              <Video size={16} />
              <span>{t('diary.watchAgain')}</span>
            </>
          ) : videoState === 'paused' ? (
            <>
              <Video size={16} />
              <span>{t('diary.paused')}</span>
            </>
          ) : videoState === 'error' ? (
            <>
              <Video size={16} />
              <span>{t('diary.videoError')}</span>
            </>
          ) : (
            <>
              <Video size={16} />
              <span>{t('diary.watch')}</span>
            </>
          )}
        </button>
      </Card>
    </div>
  );
}

/** Sentinel element that triggers a callback when it scrolls into view. */
function InfiniteScrollTrigger({
  onVisible,
  isLoading,
}: {
  onVisible: () => void;
  isLoading: boolean;
}) {
  const onVisibleRef = useRef(onVisible);
  useEffect(() => { onVisibleRef.current = onVisible; }, [onVisible]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelCallback = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onVisibleRef.current();
        }
      },
      { rootMargin: '200px' },
    );
    observerRef.current.observe(node);
  }, []);

  return (
    <div ref={sentinelCallback} className="flex justify-center py-4">
      {isLoading && <Spinner />}
    </div>
  );
}

