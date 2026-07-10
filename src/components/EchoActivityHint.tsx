import { useState, useEffect, useRef, useCallback } from 'react';
import { getRandomHint } from '../lib/activityHints.ts';

/**
 * EchoActivityHint — Phase 6B Step 13
 *
 * Shows ambient activity strings that cycle every 10-15 seconds,
 * fading between hints. Gives the impression the Echo is "doing
 * something" between diary ticks.
 *
 * - Uses the current mood to select from the correct hint pool
 * - Randomises within the pool (not sequential)
 * - Respects prefers-reduced-motion (instant swap, no fade)
 * - Gracefully resets when mood changes (new hint from new pool)
 */

interface EchoActivityHintProps {
  mood: string | undefined | null;
  locationName?: string;
  className?: string;
}

/** Random interval between 10-15 seconds */
function nextInterval(): number {
  return 10_000 + Math.random() * 5_000;
}

export function EchoActivityHint({
  mood,
  locationName,
  className = '',
}: EchoActivityHintProps) {
  const [hint, setHint] = useState(() => getRandomHint(mood, locationName));
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prefersReducedMotion = useRef(false);

  // Track reduced motion preference
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const cycleHint = useCallback(() => {
    if (prefersReducedMotion.current) {
      // Instant swap — no fade
      setHint(getRandomHint(mood, locationName));
    } else {
      // Fade out → swap → fade in
      setFading(true);
      setTimeout(() => {
        setHint(getRandomHint(mood, locationName));
        setFading(false);
      }, 300); // matches the CSS transition duration
    }
  }, [mood, locationName]);

  // Cycle hints on an interval
  useEffect(() => {
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        cycleHint();
        schedule();
      }, nextInterval());
    };
    schedule();
    return () => clearTimeout(timerRef.current);
  }, [cycleHint]);

  // When mood changes, immediately pick a new hint from the new pool
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate re-roll of a RANDOM hint when mood/location changes; the cycling interval also mutates `hint`, so a useMemo derive would both break cycling and re-randomize every render
    setHint(getRandomHint(mood, locationName));
  }, [mood, locationName]);

  return (
    <div
      className={`flex items-center justify-center py-2 ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className={`text-xs text-text-secondary italic transition-opacity duration-300 ease-in-out ${
          fading ? 'opacity-0' : 'opacity-80'
        }`}
      >
        {hint}
      </p>
    </div>
  );
}
