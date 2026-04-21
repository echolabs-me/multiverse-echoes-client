import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTickTimer } from '../hooks/useTickTimer.ts';

/**
 * Global tick timer — heartbeat monitor + ambient progress bar.
 *
 * Renders:
 * 1. Centered digits + label in a horizontal row
 * 2. Full-width ambient bar at the bottom edge of the header
 *
 * State machine (from useTickTimer, unchanged):
 * - COUNTING_DOWN: bar fills left→right, digits count down
 * - GENERATING: heartbeat bar pulse, dramatic text
 * - ARRIVED: warm flash, bar resets
 */
export function TickTimer() {
  const { t } = useTranslation();
  const { state, secondsRemaining, tickInterval } = useTickTimer();

  const progress = tickInterval > 0 ? 1 - secondsRemaining / tickInterval : 0;

  const minutes = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const isGenerating = state === 'generating';
  const isArrived = state === 'arrived';
  const isWaiting = state === 'waiting';

  const glowOpacity = isGenerating ? 0.5 : Math.min(progress * 0.45, 0.45);
  const glowColor = isGenerating ? 0.4 : glowOpacity;

  // Dynamic values flow via CSS custom properties set through CSSOM — no
  // inline style attribute (strict CSP style-src).
  const fillRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (fillRef.current) {
      fillRef.current.style.setProperty('--me-progress', `${progress * 100}%`);
    }
    if (ambientRef.current) {
      const el = ambientRef.current;
      el.style.setProperty('--me-progress', isGenerating ? '100%' : `${progress * 100}%`);
      el.style.setProperty('--me-glow-opacity', String(isGenerating ? 0.5 : glowOpacity));
      el.style.setProperty('--me-glow-shadow-color', String(glowColor));
    }
  }, [progress, isGenerating, glowOpacity, glowColor]);

  const markerGlow = isArrived ? 'me-neon-glow-success' : 'me-neon-glow';

  return (
    <>
      {/* Centered digits + label — horizontal layout with neon markers */}
      <div
        className="flex items-center gap-2"
        aria-live="polite"
        aria-label={
          isGenerating
            ? t('tickTimer.generating')
            : isArrived
              ? t('tickTimer.arrived')
              : t('tickTimer.countdown', { seconds: secondsRemaining })
        }
      >
        {/* Left marker */}
        <span
          className={`tick-digit-breathe text-[10px] leading-none ${isArrived ? 'text-success' : 'text-accent'} ${markerGlow}`}
          aria-hidden="true"
        >
          ◆
        </span>

        {isGenerating || isWaiting ? (
          <>
            <span
              className="tick-digit-breathe me-neon-glow hidden text-sm/tight font-semibold text-accent sm:inline"
            >
              {isWaiting ? t('tickTimer.nextTick', { time: timeDisplay }) : t('tickTimer.generating')}
            </span>
            <span
              className="tick-digit-breathe me-neon-glow text-sm/tight font-semibold text-accent sm:hidden"
            >
              {isWaiting ? t('tickTimer.nextTick', { time: timeDisplay }) : t('tickTimer.generatingShort')}
            </span>
          </>
        ) : (
          <>
            <span
              className={`tick-digit-breathe text-xl leading-none font-semibold tracking-wide tabular-nums sm:text-2xl ${
                isArrived ? 'me-neon-glow-success text-success' : 'me-neon-glow text-text-primary'
              }`}
            >
              {timeDisplay}
            </span>
            <span
              className="me-neon-glow-soft hidden text-xs leading-none text-text-secondary sm:inline"
            >
              {isArrived
                ? t('tickTimer.arrived')
                : t('tickTimer.untilNextHeartbeat')}
            </span>
          </>
        )}

        {/* Right marker */}
        <span
          className={`tick-digit-breathe text-[10px] leading-none ${isArrived ? 'text-success' : 'text-accent'} ${markerGlow}`}
          aria-hidden="true"
        >
          ◆
        </span>
      </div>

      {/* Full-width ambient bar at header bottom */}
      <div
        className="tick-bar pointer-events-none absolute inset-s-0 inset-e-0 inset-be-0 h-[3px]"
        aria-hidden="true"
      >
        {/* Track */}
        <div className="absolute inset-0 bg-border opacity-20" />

        {/* Fill during countdown */}
        {!isGenerating && !isArrived && !isWaiting && (
          <div
            ref={fillRef}
            className="tick-bar-fill me-progress-bar absolute inset-y-0 inset-s-0"
          />
        )}

        {/* Heartbeat sweep during generating */}
        {isGenerating && (
          <div className="tick-bar-heartbeat-sweep absolute inset-0" />
        )}

        {/* Double-pulse heartbeat glow during generating */}
        {isGenerating && (
          <div className="tick-bar-double-pulse absolute inset-0" />
        )}

        {/* Flash on arrival */}
        {isArrived && (
          <div className="tick-bar-flash absolute inset-0" />
        )}

        {/* Ambient upward glow — contained within the bar's overflow:hidden parent */}
        <div
          ref={ambientRef}
          className="tick-bar-ambient-glow me-progress-bar absolute inset-s-0 inset-be-0 h-[3px] transition-opacity duration-1000"
        />
      </div>
    </>
  );
}
