import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BookOpen,
  Download,
  Zap,
  Users,
  Sparkles,
  MessageCircle,
  Moon,
  Sun,
  Pencil,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Lock,
  Search,
  X,
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
import { useToastStore } from '../stores/useToastStore.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useSystemStore } from '../stores/useSystemStore.ts';
import { useFeedStore } from '../stores/useFeedStore.ts';
import { useSoundStore } from '../lib/sounds.ts';
import { useMoodAtmosphere } from '../hooks/useMoodAtmosphere.ts';
import { MoodParticles } from '../components/MoodParticles.tsx';
import { MoodHistoryStrip } from '../components/MoodHistoryStrip.tsx';
import { EchoActivityHint } from '../components/EchoActivityHint.tsx';
import { echoes as echoApi } from '../lib/api/endpoints.ts';
import { account as accountApi } from '../lib/api/endpoints.ts';
import { useEchoWebSocket } from '../hooks/useEchoWebSocket.ts';
import { trackEvent } from '../lib/analytics.ts';
import type {
  EchoRelationship,
  InfluenceBalance,
  DiaryEntry,
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
  const { activeEcho, fetchEcho, hibernateEcho, wakeEcho } = useEchoStore();
  const { personalFeed, fetchPersonalFeed } = useFeedStore();
  const addToast = useToastStore((s) => s.addToast);

  // Local state
  const [relationships, setRelationships] = useState<EchoRelationship[]>([]);
  const [influence, setInfluence] = useState<InfluenceBalance | null>(null);
  // Memories are internal infrastructure — not shown in user UI.
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryVersion, setDiaryVersion] = useState(0);
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
  const [renameModal, setRenameModal] = useState(false);
  const [editPersonaModal, setEditPersonaModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPersona, setNewPersona] = useState('');
  const [influenceType, setInfluenceType] = useState('nudge');
  const [influenceDetails, setInfluenceDetails] = useState('');
  const [exportModal, setExportModal] = useState(false);
  const [soloMode, setSoloMode] = useState(false);
  const [nudgeRipple, setNudgeRipple] = useState(false);

  // Mood atmosphere — derive from latest diary entry or echo's current_mood.
  const moodContainerRef = useRef<HTMLDivElement>(null);
  const currentMood = diaryEntries[0]?.mood ?? activeEcho?.current_mood ?? null;
  const moodPalette = useMoodAtmosphere(moodContainerRef, currentMood);

  // Track which diary IDs were present on initial load (no animation for those).
  const knownDiaryIdsRef = useRef<Set<string>>(new Set());
  const [newDiaryIds, setNewDiaryIds] = useState<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const playSound = useSoundStore((s) => s.play);

  // Stable ref for echoId so polling doesn't depend on store function refs.
  const echoIdRef = useRef(echoId);
  echoIdRef.current = echoId;

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

  // Re-fetch diary when mood filter changes (without full page reload).
  // Track the max number of entries the user has loaded (for filter clear restore).
  const maxLoadedRef = useRef(PAGE_SIZE);
  useEffect(() => {
    if (diaryEntries.length > maxLoadedRef.current) {
      maxLoadedRef.current = diaryEntries.length;
    }
  }, [diaryEntries.length]);

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

  // Track last tick completion time for countdown sync.
  const lastTickTimeRef = useRef(Number(localStorage.getItem('me_last_tick_at')) || 0);

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
            lastTickTimeRef.current = serverAt;
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
        setDiaryVersion((v) => v + 1);
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
      } else if (event.type === 'MoodChanged') {
        void useEchoStore.getState().fetchEcho(id);
      } else if (event.type === 'LifeEventOccurred') {
        void useFeedStore.getState().fetchPersonalFeed(id);
      }
    },
    [playSound],
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

  // Map life events to simulated days using tick_id ranges from diary entries.
  const lifeEventsByDay = useMemo(() => {
    if (lifeEvents.length === 0 || diaryEntries.length === 0) return new Map<number, typeof lifeEvents>();
    // Build tick_id -> day mapping from diary entries.
    const tickToDay = new Map<number, number>();
    for (const entry of diaryEntries) {
      tickToDay.set(entry.tick_id, parseDayNumber(entry.simulated_date));
    }
    const result = new Map<number, typeof lifeEvents>();
    for (const event of lifeEvents) {
      // Find exact tick match first, then nearest.
      let day = tickToDay.get(event.tick_id);
      if (day === undefined) {
        // Find the diary entry with the closest tick_id.
        let closest = diaryEntries[0];
        let minDiff = Math.abs(event.tick_id - closest.tick_id);
        for (const entry of diaryEntries) {
          const diff = Math.abs(event.tick_id - entry.tick_id);
          if (diff < minDiff) {
            minDiff = diff;
            closest = entry;
          }
        }
        day = parseDayNumber(closest.simulated_date);
      }
      const existing = result.get(day);
      if (existing) {
        existing.push(event);
      } else {
        result.set(day, [event]);
      }
    }
    return result;
  }, [lifeEvents, diaryEntries]);

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
    try {
      await echoApi.useInfluence(activeEcho.echo_id, {
        influence_type: influenceType,
        suggestion: influenceDetails,
      });
      trackEvent('nudge.sent', { echo_id: activeEcho.echo_id, influence_type: influenceType });
      addToast(t('echoDetail.influenceUsed'), 'success');
      setInfluenceModal(false);
      setInfluenceDetails('');
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

  const handleRename = async () => {
    if (!activeEcho || !newName.trim()) return;
    try {
      await echoApi.rename(activeEcho.echo_id, newName.trim());
      trackEvent('echo.renamed');
      addToast(t('common.save'), 'success');
      setRenameModal(false);
      await fetchEcho(activeEcho.echo_id);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleEditPersona = async () => {
    if (!activeEcho || !newPersona.trim()) return;
    try {
      await echoApi.updatePersona(activeEcho.echo_id, { persona_text: newPersona.trim() });
      trackEvent('echo.persona_edited', { fields_changed_count: 1 });
      addToast(t('common.save'), 'success');
      setEditPersonaModal(false);
      await fetchEcho(activeEcho.echo_id);
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
    <div ref={moodContainerRef} className="relative flex h-full flex-col">
      {/* Mood-reactive background gradient */}
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-300 ease-in-out"
        style={{
          background: `linear-gradient(180deg, ${moodPalette.gradientFrom} 0%, ${moodPalette.gradientTo} 100%)`,
        }}
        aria-hidden="true"
      />
      {/* Mood particles */}
      <MoodParticles palette={moodPalette} />

      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          {/* Echo header */}
          <div className="mb-6 flex items-start gap-4">
            <EchoPortrait3D name={activeEcho.name} mood={activeEcho.current_mood} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">{activeEcho.name}</h1>
                <Badge variant={activeEcho.status === 'Active' ? 'success' : 'default'}>
                  {activeEcho.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {t('echoDetail.createdOn', {
                  date: new Date(activeEcho.created_at).toLocaleDateString(),
                })}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {t('dashboard.mood')}: {activeEcho.current_mood} &middot; {t('dashboard.tick', { tick: activeEcho.current_tick })}
              </p>
              {activeEcho.status === 'Active' && <TickCountdown lastTickTimeRef={lastTickTimeRef} diaryVersion={diaryVersion} />}
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
            {activeEcho.current_tick === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                <Sparkles size={12} aria-hidden="true" />
                {t('echoDetail.personaEditableHint')}
              </p>
            )}
            {activeEcho.current_tick > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                <Lock size={12} aria-hidden="true" />
                {t('echoDetail.personaLocked')}
              </p>
            )}
          </Card>

          {/* Quick Actions */}
          <div className="my-6 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => navigate(`/echoes/${activeEcho.echo_id}/talk`)}
            >
              <MessageCircle size={16} /> {t('echoDetail.talkToEcho')}
            </Button>
            <div className="flex flex-col items-start gap-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setHibernateModal(true);
                }}
              >
                {activeEcho.status === 'Active' ? (
                  <>
                    <Moon size={16} /> {t('echoDetail.hibernate')}
                  </>
                ) : (
                  <>
                    <Sun size={16} /> {t('echoDetail.wake')}
                  </>
                )}
              </Button>
              <p className="text-xs text-text-muted max-w-[200px]">
                {t('echoDetail.hibernateHint')}
              </p>
            </div>
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => setInfluenceModal(true)}
                disabled={activeEcho.status === 'Hibernated'}
                title={activeEcho.status === 'Hibernated' ? t('echoDetail.hibernatedNoNudge') : undefined}
              >
                <Zap size={16} /> {t('echoDetail.useInfluence')}
              </Button>
              {/* Nudge ripple effect */}
              {nudgeRipple && (
                <>
                  <span
                    className="pointer-events-none absolute inset-0 rounded-lg animate-nudge-ripple"
                    aria-hidden="true"
                  />
                  <span
                    className="pointer-events-none absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent animate-nudge-pulse"
                    aria-hidden="true"
                  />
                </>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setNewName(activeEcho.name);
                setRenameModal(true);
              }}
            >
              <Pencil size={16} /> {t('echoDetail.rename')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setNewPersona(activeEcho.persona_text);
                setEditPersonaModal(true);
              }}
              disabled={activeEcho.current_tick > 0}
              title={activeEcho.current_tick > 0 ? t('echoDetail.personaLocked') : undefined}
            >
              <Pencil size={16} /> {t('echoDetail.editPersona')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setExportModal(true)}
            >
              <Download size={16} /> {t('echoDetail.exportStory')}
            </Button>
          </div>

          {/* Influence balance */}
          {influence && (
            <div className="mb-6 text-sm text-text-secondary">
              <Zap size={14} className="mr-1 inline text-accent" aria-hidden="true" />
              {t('echoDetail.influenceRemaining', {
                remaining: influence.remaining,
                limit: influence.daily_limit,
              })}
            </div>
          )}

          {/* Mood history strip */}
          <MoodHistoryStrip entries={diaryEntries} className="mb-2" />

          {/* Activity hint — ambient flavour between ticks */}
          {activeEcho.status === 'Active' && (
            <EchoActivityHint
              mood={currentMood}
              locationName={diaryEntries[0]?.location_name}
              className="mb-3"
            />
          )}

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
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                  <input
                    type="text"
                    value={diarySearch}
                    onChange={(e) => setDiarySearch(e.target.value)}
                    placeholder={t('echoDetail.searchDiary')}
                    className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                <p className="text-sm italic text-text-muted">{t('echoDetail.noFilterMatch')}</p>
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
                  const dayLifeEvents = lifeEventsByDay.get(day) ?? [];
                  return (
                    <div key={day}>
                      {/* Life event milestone markers for this day */}
                      {dayLifeEvents.map((event) => (
                        <div
                          key={event.item_id}
                          className="mb-2 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2"
                        >
                          <Sparkles size={16} className="shrink-0 text-accent" aria-hidden="true" />
                          <span className="text-sm font-medium text-accent">{event.title}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => toggleDay(day)}
                        className="mb-2 flex w-full items-center gap-2 border-b border-accent/20 pb-1 text-left"
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
                        <div className="mb-3 flex flex-col gap-3 pl-2">
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
                  <Button
                    variant="ghost"
                    onClick={() => void loadMoreDiary()}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? t('common.loading') : t('echoDetail.loadMoreDiary')}
                  </Button>
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
                  <Card key={event.item_id} variant="compact">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{event.title}</p>
                        <p className="text-sm text-text-secondary">{event.body}</p>
                      </div>
                      <span className="shrink-0 text-xs text-text-muted">
                        {new Date(event.created_at).toLocaleDateString()}
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
                {relationships.map((rel) => (
                  <Card key={rel.relationship_id} variant="compact">
                    <p className="text-sm font-medium text-text-primary">
                      {rel.echo_b_id}
                    </p>
                    <p className="text-xs text-text-muted">{rel.relationship_type}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
                      <span>
                        {t('echoDetail.sentiment')}: {(rel.sentiment * 100).toFixed(0)}%
                      </span>
                      <Badge variant={rel.status === 'Active' ? 'success' : 'default'}>
                        {rel.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
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

      {/* Rename Modal */}
      <Modal
        open={renameModal}
        onClose={() => setRenameModal(false)}
        title={t('echoDetail.rename')}
      >
        <div className="mb-4">
          <Input
            label={t('echoDetail.rename')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRenameModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleRename} disabled={!newName.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>

      {/* Edit Persona Modal */}
      <Modal
        open={editPersonaModal}
        onClose={() => setEditPersonaModal(false)}
        title={t('echoDetail.editPersona')}
      >
        <div className="mb-4">
          <Input
            multiline
            label={t('echoDetail.persona')}
            value={newPersona}
            onChange={(e) => setNewPersona(e.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditPersonaModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleEditPersona} disabled={!newPersona.trim()}>
            {t('common.save')}
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
    </div>
  );
}

function TickCountdown({ lastTickTimeRef, diaryVersion }: { lastTickTimeRef: React.RefObject<number>; diaryVersion: number }) {
  const { t } = useTranslation();
  const tickInterval = useSystemStore((s) => s.tickIntervalSeconds);

  const [isGenerating, setIsGenerating] = useState(() => {
    const stored = Number(localStorage.getItem('me_last_tick_at')) || 0;
    return stored > 0 && (Date.now() - stored) / 1000 >= tickInterval;
  });
  const generatingRef = useRef(false);

  // DiaryEntryCreated clears the generating flag via ref.
  // The interval compute function syncs state from the ref every second.
  const prevDiaryVersionRef = useRef(diaryVersion);
  useEffect(() => {
    if (diaryVersion > prevDiaryVersionRef.current) {
      prevDiaryVersionRef.current = diaryVersion;
      generatingRef.current = false;
    }
  }, [diaryVersion]);

  const [seconds, setSeconds] = useState(() => {
    const stored = Number(localStorage.getItem('me_last_tick_at')) || 0;
    if (stored > 0) {
      const remaining = tickInterval - Math.floor((Date.now() - stored) / 1000);
      return Math.max(0, remaining);
    }
    return tickInterval;
  });

  useEffect(() => {
    const compute = () => {
      const base = lastTickTimeRef.current;
      if (base > 0) {
        const remaining = tickInterval - Math.floor((Date.now() - base) / 1000);
        if (remaining <= 0) {
          setSeconds(0);
          if (!generatingRef.current) {
            generatingRef.current = true;
          }
        } else {
          setSeconds(remaining);
        }
        setIsGenerating(generatingRef.current);
      }
    };
    const timer = setInterval(compute, 1000);
    return () => clearInterval(timer);
  }, [tickInterval, lastTickTimeRef]);

  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${isGenerating ? 'bg-accent' : 'bg-success'} animate-pulse`}
        aria-hidden="true"
      />
      {isGenerating
        ? <span className="text-accent">{t('echoDetail.echoThinking')}</span>
        : t('echoDetail.nextTick', { seconds })}
    </p>
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
  return (
    <div
      id={`diary-${entry.diary_id}`}
      className={isNew ? 'animate-diary-arrive' : ''}
      style={isNew ? { opacity: 0 } : undefined}
    >
      <Card
        className={isNew ? 'animate-diary-glow' : ''}
        onAnimationEnd={
          isNew
            ? () => onAnimationEnd?.(entry.diary_id)
            : undefined
        }
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">
              {entry.simulated_date} — {entry.mood}
            </p>
            <p className="mt-1 text-sm text-text-secondary">{entry.content}</p>
            <p className="mt-1 text-xs text-text-muted">{entry.location_name}</p>
          </div>
          <span className="ml-3 shrink-0 text-xs text-text-muted">
            {new Date(entry.created_at).toLocaleDateString()}
          </span>
        </div>
      </Card>
    </div>
  );
}
