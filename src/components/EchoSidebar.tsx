import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { getMoodColor } from '../lib/moodColor.ts';
import { getMoodLabel } from '../lib/moodLabel.ts';
import { echoes as echoApi } from '../lib/api/endpoints.ts';
import type { EchoResponse } from '../types/api.ts';

/** Convert hex color to rgba string. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Core moods for the legend — one entry per colour family. */
const MOOD_LEGEND = [
  { mood: 'happy', color: '#FF9F43' },
  { mood: 'sad', color: '#5B7FCC' },
  { mood: 'calm', color: '#2ECC71' },
  { mood: 'angry', color: '#E74C3C' },
  { mood: 'anxious', color: '#9B59B6' },
  { mood: 'excited', color: '#F39C12' },
  { mood: 'contemplative', color: '#6C8EBF' },
  { mood: 'neutral', color: '#8E8E93' },
];

/**
 * Mini-card Echo item for the sidebar.
 * Shows mood dot, name, mood + tick, diary preview, shard name.
 * If the Echo just travelled (shard_id mismatch with latest diary), shows a transit indicator.
 */
function EchoCard({
  echo,
  isActive,
  shardName,
  latestDiary,
  latestDiaryShardId,
  onClick,
  dragHandleProps,
}: {
  echo: EchoResponse;
  isActive: boolean;
  shardName: string;
  latestDiary: string | null;
  latestDiaryShardId: string | null;
  onClick: () => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const moodColor = getMoodColor(echo.current_mood);

  // Echo has moved to a new shard but hasn't ticked there yet
  const isTravelling =
    latestDiaryShardId !== null
      ? latestDiaryShardId !== echo.current_shard_id
      : latestDiary === null; // no diary at all — brand new echo, show indicator if just created

  // Only show travelling if the echo is active (not hibernated)
  const showTravelIndicator = isTravelling && echo.status === 'Active';

  // Set mood-derived CSS custom properties once the card mounts / re-renders
  // with a new mood. Avoids inline style attributes (strict CSP style-src).
  const setMoodVars = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('--me-mood-color', moodColor);
    el.style.setProperty('--me-mood-shadow', hexToRgba(moodColor, 0.15));
    el.style.setProperty('--me-mood-edge', hexToRgba(moodColor, 0.4));
    el.style.setProperty('--me-mood-ring', hexToRgba(moodColor, 0.5));
  };

  return (
    <div
      ref={setMoodVars}
      className={`me-echo-card-mood-edge flex w-full items-start gap-0 rounded-lg transition-all ${
        isActive
          ? 'bg-accent-subtle border border-accent/30'
          : 'hover:bg-surface-raised border border-transparent'
      }`}
    >
      {/* Drag handle — mood-colored */}
      <div
        className="me-mood-fg flex-shrink-0 cursor-grab active:cursor-grabbing px-1 py-3 touch-none transition-opacity opacity-40 hover:opacity-80"
        {...dragHandleProps}
      >
        <GripVertical size={14} />
      </div>
      <button
        onClick={onClick}
        className="flex flex-1 min-w-0 flex-col gap-1 py-2.5 pe-3 text-start"
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Row 1: avatar/mood dot + name */}
        <div className="flex items-center gap-2">
          {echo.avatar_url ? (
            <img
              src={echo.avatar_url}
              alt=""
              className="me-avatar-ring h-6 w-6 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="me-mood-dot h-2.5 w-2.5 flex-shrink-0 rounded-full"
              aria-label={echo.current_mood}
            />
          )}
          <span className={`truncate text-sm font-medium ${isActive ? 'text-accent' : 'text-text-primary'}`}>
            {echo.name}
          </span>
        </div>
        {/* Row 2: mood + tick */}
        <p className="truncate text-[11px] text-text-secondary ps-[18px]">
          {getMoodLabel(echo.current_mood)} · {t('echoSidebar.tick', { tick: echo.current_tick })}
        </p>
        {/* Row 3: travelling indicator or diary preview */}
        {showTravelIndicator ? (
          <p className="text-xs text-accent ps-[18px] italic leading-snug">
            {t('echoSidebar.arrivingAt', { shard: shardName })}
          </p>
        ) : latestDiary ? (
          <p className="line-clamp-2 text-xs text-text-secondary ps-[18px] italic leading-snug">
            &ldquo;{latestDiary}&rdquo;
          </p>
        ) : null}
        {/* Row 4: shard name */}
        <p className="truncate text-[11px] text-text-muted ps-[18px]">
          {shardName}
        </p>
      </button>
    </div>
  );
}

/** Sortable wrapper that provides drag transform + handle props to EchoCard. */
function SortableEchoItem({
  echo,
  isActive,
  shardName,
  latestDiary,
  latestDiaryShardId,
  onClick,
}: {
  echo: EchoResponse;
  isActive: boolean;
  shardName: string;
  latestDiary: string | null;
  latestDiaryShardId: string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: echo.echo_id });

  // dnd-kit gives us dynamic transform/transition strings — write them via
  // CSSOM (ref + setProperty) rather than the React `style` prop so the page
  // stays compatible with strict `style-src` (no 'unsafe-inline').
  const composedRef = (el: HTMLLIElement | null) => {
    setNodeRef(el);
    if (el) {
      const t = CSS.Transform.toString(transform);
      el.style.transform = t ?? '';
      el.style.transition = transition ?? '';
      el.style.opacity = isDragging ? '0.5' : '1';
      el.style.zIndex = isDragging ? '10' : '';
    }
  };

  return (
    <li ref={composedRef} {...attributes}>
      <EchoCard
        echo={echo}
        isActive={isActive}
        shardName={shardName}
        latestDiary={latestDiary}
        latestDiaryShardId={latestDiaryShardId}
        onClick={onClick}
        dragHandleProps={listeners}
      />
    </li>
  );
}

/**
 * Desktop Echo sidebar — persistent mini-card list with drag-to-reorder.
 * Each card is a glanceable overview; clicking navigates to full detail.
 */
export function EchoSidebar({ forceVisible }: { forceVisible?: boolean } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { echoId } = useParams<{ echoId: string }>();
  const { echoList, fetchEchoes, reorderEchoes } = useEchoStore();
  const { shardList, fetchShards } = useShardStore();
  const [diaryPreviews, setDiaryPreviews] = useState<Record<string, { snippet: string; shardId: string | null; tick: number }>>({});

  useEffect(() => {
    if (echoList.length === 0) void fetchEchoes();
  }, [echoList.length, fetchEchoes]);

  useEffect(() => {
    if (shardList.length === 0) void fetchShards();
  }, [shardList.length, fetchShards]);

  // Fetch latest diary entry for each echo (1 entry each, lightweight).
  // Re-fetches when echo.current_tick changes (new diary entry arrived).
  useEffect(() => {
    for (const echo of echoList) {
      const cached = diaryPreviews[echo.echo_id];
      if (cached !== undefined && cached.tick === echo.current_tick) continue;
      void echoApi.diary(echo.echo_id, 1).then((page) => {
        const entry = page.data[0];
        setDiaryPreviews((prev) => ({
          ...prev,
          [echo.echo_id]: {
            snippet: entry ? entry.content.slice(0, 120) : '',
            shardId: entry?.shard_id ?? null,
            tick: echo.current_tick,
          },
        }));
      }).catch(() => {
        setDiaryPreviews((prev) => ({ ...prev, [echo.echo_id]: { snippet: '', shardId: null, tick: echo.current_tick } }));
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = echoList.findIndex((e) => e.echo_id === active.id);
      const newIndex = echoList.findIndex((e) => e.echo_id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderEchoes(oldIndex, newIndex);
      }
    },
    [echoList, reorderEchoes],
  );

  if (echoList.length === 0) return null;

  return (
    <aside
      className={forceVisible
        ? "flex flex-1 min-h-0 w-full flex-col bg-transparent"
        : "hidden md:flex h-full w-[200px] lg:w-[232px] flex-col border-e border-border/50 bg-transparent"
      }
      aria-label={t('echoSidebar.title')}
    >
      <div className="flex-shrink-0 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {t('echoSidebar.title')}
      </div>
      {/* Mood Legend */}
      <div className="flex-shrink-0 border-b border-border px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-text-primary">
          {t('echoSidebar.moodLegend')}
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {MOOD_LEGEND.map(({ mood, color }) => (
            <div key={mood} className="flex items-center gap-2">
              <span
                ref={(el) => {
                  if (el) el.style.setProperty('--me-mood-color', color);
                }}
                className="me-mood-dot h-2.5 w-2.5 flex-shrink-0 rounded-full"
              />
              <span className="text-xs text-text-secondary">{getMoodLabel(mood)}</span>
            </div>
          ))}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={echoList.map((e) => e.echo_id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1">
              {echoList.map((echo) => (
                <SortableEchoItem
                  key={echo.echo_id}
                  echo={echo}
                  isActive={echo.echo_id === activeId}
                  shardName={shardNameMap.get(echo.current_shard_id) ?? t('echoSidebar.unknownShard')}
                  latestDiary={diaryPreviews[echo.echo_id]?.snippet || null}
                  latestDiaryShardId={diaryPreviews[echo.echo_id]?.shardId ?? null}
                  onClick={() => handleClick(echo)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>
      <div className="px-3 pb-3 pt-2 border-t border-border/50">
        <button
          onClick={() => navigate('/onboarding/create-echo')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/15 border border-accent/30 py-2.5 text-sm font-medium text-accent hover:bg-accent/25 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          {t('echoSidebar.createEcho')}
        </button>
      </div>
    </aside>
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
              ref={(el) => {
                if (el) el.style.setProperty('--me-mood-color', getMoodColor(activeEcho.current_mood));
              }}
              className="me-mood-dot h-2 w-2 flex-shrink-0 rounded-full"
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
            aria-label={t('echoSidebar.closeAriaLabel')}
            tabIndex={-1}
          />
          <div className="absolute start-0 end-0 z-50 mx-4 mt-1 rounded-lg border border-border bg-surface shadow-lg">
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
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start transition-colors ${
                      echo.echo_id === echoId
                        ? 'bg-accent-subtle text-accent'
                        : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                    }`}
                  >
                    <span
                      ref={(el) => {
                        if (el) el.style.setProperty('--me-mood-color', getMoodColor(echo.current_mood));
                      }}
                      className="me-mood-dot h-2.5 w-2.5 flex-shrink-0 rounded-full"
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
