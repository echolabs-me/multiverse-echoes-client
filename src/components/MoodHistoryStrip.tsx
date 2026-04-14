import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoodPalette } from '../hooks/useMoodAtmosphere.ts';
import { getMoodLabel } from '../lib/moodLabel.ts';
import { formatSimDate } from '../lib/formatSimDate.ts';
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
            {formatSimDate(firstDate)} — {formatSimDate(lastDate)}
          </p>
        )}
      </div>

      {/* Timeline container */}
      <div
        className="me-mh-strip relative"
        data-any-hovered={hoveredIndex !== null}
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
            const pos = i === 0 ? 'first' : i === chronological.length - 1 ? 'last' : 'mid';

            const setSegmentVars = (el: HTMLElement | null) => {
              if (!el) return;
              el.style.setProperty('--me-mh-primary', palette.primary);
              el.style.setProperty('--me-mh-secondary', `${palette.secondary}cc`);
              el.style.setProperty('--me-mh-primary-60', `${palette.primary}60`);
              el.style.setProperty('--me-mh-primary-30', `${palette.primary}30`);
              el.style.setProperty('--me-mh-accent', palette.accent);
              el.style.setProperty('--me-mh-accent-30', `${palette.accent}30`);
              el.style.setProperty('--me-mh-accent-60', `${palette.accent}60`);
              el.style.setProperty('--me-mh-accent-80', `${palette.accent}80`);
            };

            return (
              <button
                key={entry.diary_id}
                ref={setSegmentVars}
                data-hovered={isHovered}
                data-pos={pos}
                className="me-mh-segment group relative min-w-[4px] flex-1 cursor-pointer border-none p-0 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                onClick={() => handleClick(entry)}
                onMouseMove={(e) => handleMouseMove(e, i)}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
                aria-label={`${entry.simulated_date} — ${entry.mood}`}
              >
                {/* Inner glow overlay on hover */}
                {isHovered && (
                  <div className="me-mh-inner-glow absolute inset-0 rounded-[inherit]" />
                )}

                {/* Mood label — shown inside segment when wide enough or hovered */}
                <span
                  data-hovered={isHovered}
                  className="me-mh-label absolute bottom-2 start-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium uppercase tracking-wide transition-opacity duration-200"
                >
                  {isHovered ? getMoodLabel(entry.mood) : ''}
                </span>

                {/* "Now" playhead on latest segment */}
                {isLatest && (
                  <div className="absolute -bottom-3 start-1/2 -translate-x-1/2">
                    <div className="me-mh-playhead h-3 w-3 rotate-45 rounded-[2px]" />
                    <div className="me-mh-playhead-ping absolute inset-0 h-3 w-3 rotate-45 animate-ping rounded-[2px]" />
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
              const setDotVars = (el: HTMLElement | null) => {
                if (!el) return;
                el.style.setProperty('--me-mh-primary', palette.primary);
                el.style.setProperty('--me-mh-accent', palette.accent);
                el.style.setProperty('--me-mh-accent-60', `${palette.accent}60`);
                el.style.setProperty('--me-mh-accent-80', `${palette.accent}80`);
              };
              return (
                <div key={`dot-${entry.diary_id}`} className="flex flex-1 items-center justify-center">
                  <div
                    ref={setDotVars}
                    data-hovered={isHovered}
                    data-latest={isLatest}
                    className="me-mh-dot rounded-full transition-all duration-200"
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
          ref={(el) => {
            if (!el) return;
            const palette = getMoodPalette(chronological[hoveredIndex].mood);
            el.style.setProperty('--me-mh-tooltip-x', `${Math.max(50, Math.min(tooltipX, containerWidth - 50))}px`);
            el.style.setProperty('--me-mh-secondary', palette.secondary);
            el.style.setProperty('--me-mh-primary-50', `${palette.primary}50`);
          }}
          className="me-mh-tooltip pointer-events-none absolute z-10 rounded-xl px-4 py-2.5 text-xs shadow-xl"
        >
          <p className="text-sm font-semibold capitalize text-text-primary">
            {getMoodLabel(chronological[hoveredIndex].mood)}
          </p>
          <p className="mt-0.5 text-text-muted">
            {formatSimDate(chronological[hoveredIndex].simulated_date)}
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
