import { useTranslation } from 'react-i18next';
import { useTickTimer } from '../hooks/useTickTimer.ts';

const NEON_GLOW = '0 0 8px rgba(212, 145, 92, 0.5), 0 0 20px rgba(212, 145, 92, 0.2)';
const NEON_GLOW_SUCCESS = '0 0 8px rgba(107, 175, 122, 0.5), 0 0 20px rgba(107, 175, 122, 0.2)';

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

  const glowOpacity = isGenerating ? 0.5 : Math.min(progress * 0.45, 0.45);

  return (
    <>
      {/* Centered digits + label — horizontal layout */}
      <div
        className="flex items-baseline gap-2"
        aria-live="polite"
        aria-label={
          isGenerating
            ? t('tickTimer.generating')
            : isArrived
              ? t('tickTimer.arrived')
              : t('tickTimer.countdown', { seconds: secondsRemaining })
        }
      >
        {isGenerating ? (
          <>
            {/* Full text on desktop, short on mobile */}
            <span
              className="tick-digit-breathe hidden sm:inline text-sm font-semibold text-accent leading-tight"
              style={{ textShadow: NEON_GLOW }}
            >
              {t('tickTimer.generating')}
            </span>
            <span
              className="tick-digit-breathe sm:hidden text-sm font-semibold text-accent leading-tight"
              style={{ textShadow: NEON_GLOW }}
            >
              {t('tickTimer.generatingShort')}
            </span>
          </>
        ) : (
          <>
            <span
              className={`tick-digit-breathe text-xl sm:text-2xl font-semibold tabular-nums leading-none tracking-wide ${
                isArrived ? 'text-success' : ''
              }`}
              style={{
                color: isArrived ? undefined : '#E8E0D8',
                textShadow: isArrived ? NEON_GLOW_SUCCESS : NEON_GLOW,
              }}
            >
              {timeDisplay}
            </span>
            {/* Label to the right — hidden on mobile */}
            <span
              className="hidden sm:inline text-xs text-text-muted leading-none"
              style={{ textShadow: '0 0 6px rgba(212, 145, 92, 0.15)' }}
            >
              {isArrived
                ? t('tickTimer.arrived')
                : t('tickTimer.untilNextHeartbeat')}
            </span>
          </>
        )}
      </div>

      {/* Full-width ambient bar at header bottom */}
      <div
        className="tick-bar absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none"
        aria-hidden="true"
      >
        {/* Track */}
        <div className="absolute inset-0 bg-border opacity-20" />

        {/* Fill during countdown */}
        {!isGenerating && !isArrived && (
          <div
            className="tick-bar-fill absolute inset-y-0 left-0"
            style={{ width: `${progress * 100}%` }}
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
          className="absolute bottom-0 left-0 h-[3px] transition-opacity duration-1000"
          style={{
            width: isGenerating ? '100%' : `${progress * 100}%`,
            opacity: isGenerating ? 0.5 : glowOpacity,
            boxShadow: `0 0 6px 1px rgba(212, 145, 92, ${isGenerating ? 0.4 : glowOpacity})`,
          }}
        />
      </div>
    </>
  );
}
