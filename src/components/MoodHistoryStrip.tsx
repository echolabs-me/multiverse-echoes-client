import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoodPalette } from '../hooks/useMoodAtmosphere.ts';
import type { DiaryEntry } from '../types/api.ts';

/**
 * MoodHistoryStrip — Phase 6B Step 12 (redesigned for #4)
 *
 * Visual mood journey showing distinct colour segments per diary entry.
 * Each segment is individually visible with its mood colour, hover reveals
 * mood/date tooltip, clicking scrolls to the entry.
 *
 * Entries displayed chronologically left-to-right (oldest first).
 */

interface MoodHistoryStripProps {
  entries: DiaryEntry[];
  className?: string;
}

export function MoodHistoryStrip({ entries, className = '' }: MoodHistoryStripProps) {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [containerWidth, setContainerWidth] = useState(200);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chronological order (oldest first) — diary entries come newest-first from API
  const chronological = useMemo(() => [...entries].reverse(), [entries]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>, index: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltipX(e.clientX - rect.left);
      setContainerWidth(rect.width);
      setHoveredIndex(index);
    },
    [],
  );

  const handleClick = useCallback(
    (entry: DiaryEntry) => {
      const el = document.getElementById(`diary-${entry.diary_id}`);
      if (!el) return;
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      el.scrollIntoView({
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
        block: 'center',
      });
    },
    [],
  );

  if (entries.length === 0) return null;

  const firstDate = chronological[0]?.simulated_date;
  const lastDate = chronological[chronological.length - 1]?.simulated_date;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        {t('echoDetail.moodJourney', 'Mood Journey')}
      </p>

      {/* Main mood bar */}
      <div
        className="relative flex h-8 w-full gap-[2px] overflow-hidden rounded-lg"
        role="img"
        aria-label={t('echoDetail.moodHistory', 'Mood history')}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {chronological.map((entry, i) => {
          const palette = getMoodPalette(entry.mood);
          const isHovered = hoveredIndex === i;
          const isLatest = i === chronological.length - 1;

          return (
            <button
              key={entry.diary_id}
              className="relative h-full min-w-[3px] flex-1 cursor-pointer border-none p-0 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              style={{
                background: isHovered
                  ? `linear-gradient(to bottom, ${palette.accent}, ${palette.primary})`
                  : `linear-gradient(to bottom, ${palette.primary}dd, ${palette.secondary})`,
                transform: isHovered ? 'scaleY(1.15)' : 'scaleY(1)',
                opacity: hoveredIndex !== null && !isHovered ? 0.6 : 1,
                boxShadow: isHovered
                  ? `0 0 12px ${palette.primary}80, inset 0 1px 0 ${palette.accent}40`
                  : `inset 0 1px 0 ${palette.accent}20`,
                borderRadius: i === 0 ? '6px 0 0 6px' : i === chronological.length - 1 ? '0 6px 6px 0' : '0',
              }}
              onClick={() => handleClick(entry)}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onFocus={() => setHoveredIndex(i)}
              onBlur={() => setHoveredIndex(null)}
              aria-label={`${entry.simulated_date} — ${entry.mood}`}
            >
              {/* Pulse dot on latest segment */}
              {isLatest && (
                <span
                  className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: palette.accent }}
                  aria-hidden="true"
                >
                  <span
                    className="absolute inset-0 animate-ping rounded-full"
                    style={{ backgroundColor: palette.accent, opacity: 0.4 }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Date range below the bar */}
      {chronological.length > 1 && (
        <div className="mt-1.5 flex justify-between text-[10px] text-text-muted">
          <span>{firstDate}</span>
          <span>{lastDate}</span>
        </div>
      )}

      {/* Tooltip */}
      {hoveredIndex !== null && chronological[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${Math.max(40, Math.min(tooltipX, containerWidth - 40))}px`,
            bottom: '100%',
            marginBottom: '4px',
            backgroundColor: getMoodPalette(chronological[hoveredIndex].mood).secondary,
            border: `1px solid ${getMoodPalette(chronological[hoveredIndex].mood).primary}40`,
          }}
        >
          <p className="font-medium capitalize text-text-primary">
            {chronological[hoveredIndex].mood}
          </p>
          <p className="text-text-muted">
            {chronological[hoveredIndex].simulated_date}
          </p>
          {chronological[hoveredIndex].location_name && (
            <p className="text-text-muted">
              {chronological[hoveredIndex].location_name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
