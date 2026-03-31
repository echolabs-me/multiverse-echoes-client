import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoodPalette } from '../hooks/useMoodAtmosphere.ts';
import type { DiaryEntry } from '../types/api.ts';

/**
 * MoodHistoryStrip — Phase 6B Step 12
 *
 * Horizontal gradient strip showing one colour segment per diary entry,
 * using mood palettes from Step 11. Hovering shows mood/date tooltip,
 * clicking scrolls to the diary entry.
 *
 * Entries are displayed chronologically left-to-right (oldest first).
 */

interface MoodHistoryStripProps {
  entries: DiaryEntry[];
  className?: string;
}

export function MoodHistoryStrip({ entries, className = '' }: MoodHistoryStripProps) {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const stripRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>, index: number) => {
      const rect = stripRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltipPos({
        x: e.clientX - rect.left,
        y: rect.top - 8,
      });
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

  // Don't render for 0 entries
  if (entries.length === 0) return null;

  // Chronological order (oldest first) — diary entries come newest-first from API
  const chronological = [...entries].reverse();
  const colours = chronological.map((e) => getMoodPalette(e.mood).primary);

  // Build CSS linear-gradient with soft blending between segments.
  // Each segment gets a colour stop at its center, creating natural transitions.
  const gradientStops = buildGradientStops(colours);

  return (
    <div className={`relative ${className}`}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {t('echoDetail.moodJourney', 'Mood Journey')}
      </p>
      <div
        ref={stripRef}
        className="relative h-4 w-full overflow-hidden rounded-[3px]"
        style={{ background: `linear-gradient(to right, ${gradientStops})` }}
        role="img"
        aria-label={t('echoDetail.moodHistory', 'Mood history')}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Invisible hit targets for each segment */}
        {chronological.map((entry, i) => (
          <button
            key={entry.diary_id}
            className="absolute top-0 h-full cursor-pointer border-none bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            style={{
              left: `${(i / chronological.length) * 100}%`,
              width: `${(1 / chronological.length) * 100}%`,
            }}
            onClick={() => handleClick(entry)}
            onMouseMove={(e) => handleMouseMove(e, i)}
            onFocus={() => setHoveredIndex(i)}
            onBlur={() => setHoveredIndex(null)}
            aria-label={`${entry.simulated_date} — ${entry.mood}`}
          />
        ))}

        {/* Current-position indicator (most recent entry = rightmost) */}
        <div
          className="pointer-events-none absolute top-full h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-text-secondary"
          style={{ left: '100%', marginTop: '2px' }}
          aria-hidden="true"
        />
      </div>

      {/* Tooltip */}
      {hoveredIndex !== null && chronological[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${tooltipPos.x}px`,
            bottom: '100%',
            marginBottom: '8px',
          }}
        >
          <p className="font-medium text-text-primary">
            {chronological[hoveredIndex].mood}
          </p>
          <p className="text-text-muted">
            {chronological[hoveredIndex].simulated_date}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Build gradient stops with soft blending between adjacent colours.
 * Instead of hard edges, each colour fades into the next over a small overlap.
 */
function buildGradientStops(colours: string[]): string {
  if (colours.length === 1) return `${colours[0]}, ${colours[0]}`;

  const stops: string[] = [];
  const n = colours.length;

  for (let i = 0; i < n; i++) {
    const pct = (i / (n - 1)) * 100;
    stops.push(`${colours[i]} ${pct.toFixed(1)}%`);
  }

  return stops.join(', ');
}
