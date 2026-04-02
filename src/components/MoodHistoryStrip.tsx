import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoodPalette } from '../hooks/useMoodAtmosphere.ts';
import type { DiaryEntry } from '../types/api.ts';

/**
 * MoodHistoryStrip — interactive mood timeline.
 *
 * Tall, visually rich timeline with distinct mood-coloured segments,
 * mood labels, dot markers along a track, and a playhead indicator.
 * Clicking a segment scrolls to that diary entry.
 */

interface MoodHistoryStripProps {
  entries: DiaryEntry[];
  className?: string;
}

export function MoodHistoryStrip({
  entries,
  className = '',
}: MoodHistoryStripProps) {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [containerWidth, setContainerWidth] = useState(200);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleClick = useCallback((entry: DiaryEntry) => {
    const el = document.getElementById(`diary-${entry.diary_id}`);
    if (!el) return;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
      block: 'center',
    });
  }, []);

  if (entries.length === 0) return null;

  const firstDate = chronological[0]?.simulated_date;
  const lastDate = chronological[chronological.length - 1]?.simulated_date;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {t('echoDetail.moodJourney', 'Mood Journey')}
        </p>
        {chronological.length > 1 && (
          <p className="text-[10px] tabular-nums text-text-muted">
            {firstDate} — {lastDate}
          </p>
        )}
      </div>

      {/* Timeline container */}
      <div
        className="relative"
        role="img"
        aria-label={t('echoDetail.moodHistory', 'Mood history')}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Segment bar — the tall coloured blocks */}
        <div className="flex w-full gap-[3px] overflow-hidden rounded-xl">
          {chronological.map((entry, i) => {
            const palette = getMoodPalette(entry.mood);
            const isHovered = hoveredIndex === i;
            const isLatest = i === chronological.length - 1;
            const anyHovered = hoveredIndex !== null;

            return (
              <button
                key={entry.diary_id}
                className="group relative min-w-[4px] flex-1 cursor-pointer border-none p-0 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                style={{
                  height: isHovered ? '120px' : '100px',
                  background: `linear-gradient(to bottom, ${palette.primary}, ${palette.secondary}cc)`,
                  opacity: anyHovered && !isHovered ? 0.45 : 1,
                  boxShadow: isHovered
                    ? `0 0 20px ${palette.primary}60, 0 4px 12px ${palette.primary}30`
                    : 'none',
                  borderRadius:
                    i === 0
                      ? '12px 2px 2px 12px'
                      : i === chronological.length - 1
                        ? '2px 12px 12px 2px'
                        : '2px',
                }}
                onClick={() => handleClick(entry)}
                onMouseMove={(e) => handleMouseMove(e, i)}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
                aria-label={`${entry.simulated_date} — ${entry.mood}`}
              >
                {/* Inner glow overlay on hover */}
                {isHovered && (
                  <div
                    className="absolute inset-0 rounded-[inherit]"
                    style={{
                      background: `linear-gradient(to bottom, ${palette.accent}30, transparent 60%)`,
                    }}
                  />
                )}

                {/* Mood label — shown inside segment when wide enough or hovered */}
                <span
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium uppercase tracking-wide transition-opacity duration-200"
                  style={{
                    color: `${palette.accent}`,
                    opacity: isHovered ? 1 : 0.6,
                    textShadow: `0 1px 3px ${palette.secondary}`,
                  }}
                >
                  {isHovered ? entry.mood : ''}
                </span>

                {/* "Now" playhead on latest segment */}
                {isLatest && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                    <div
                      className="h-3 w-3 rotate-45 rounded-[2px]"
                      style={{
                        backgroundColor: palette.accent,
                        boxShadow: `0 0 8px ${palette.accent}80`,
                      }}
                    />
                    <div
                      className="absolute inset-0 h-3 w-3 rotate-45 animate-ping rounded-[2px]"
                      style={{
                        backgroundColor: palette.accent,
                        opacity: 0.3,
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Dot track — a line of dots along the bottom edge */}
        <div className="mt-4 flex w-full items-center">
          <div className="flex w-full items-center gap-0">
            {chronological.map((entry, i) => {
              const palette = getMoodPalette(entry.mood);
              const isHovered = hoveredIndex === i;
              const isLatest = i === chronological.length - 1;
              return (
                <div key={`dot-${entry.diary_id}`} className="flex flex-1 items-center justify-center">
                  <div
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: isHovered ? '10px' : isLatest ? '8px' : '5px',
                      height: isHovered ? '10px' : isLatest ? '8px' : '5px',
                      backgroundColor: isHovered || isLatest ? palette.accent : palette.primary,
                      boxShadow: isHovered
                        ? `0 0 8px ${palette.accent}80`
                        : isLatest
                          ? `0 0 6px ${palette.accent}60`
                          : 'none',
                      opacity: isHovered ? 1 : 0.7,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredIndex !== null && chronological[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl px-4 py-2.5 text-xs shadow-xl"
          style={{
            left: `${Math.max(50, Math.min(tooltipX, containerWidth - 50))}px`,
            top: '-8px',
            transform: 'translate(-50%, -100%)',
            backgroundColor: getMoodPalette(chronological[hoveredIndex].mood)
              .secondary,
            border: `1px solid ${getMoodPalette(chronological[hoveredIndex].mood).primary}50`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <p className="text-sm font-semibold capitalize text-text-primary">
            {chronological[hoveredIndex].mood}
          </p>
          <p className="mt-0.5 text-text-muted">
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
