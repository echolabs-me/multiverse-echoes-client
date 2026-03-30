import { useTranslation } from 'react-i18next';
import { useTickTimer } from '../hooks/useTickTimer.ts';

/**
 * Global tick timer — heartbeat monitor + ambient progress bar.
 *
 * Renders two layers:
 * 1. Centered digits + label (positioned in the header flow)
 * 2. Full-width ambient bar at the bottom of the header (absolute positioned,
 *    breaks out of the center container via a portal-like absolute wrapper)
 *
 * State machine (from useTickTimer, unchanged):
 * - COUNTING_DOWN: bar fills left→right, digits count down
 * - GENERATING: ECG heartbeat sweep across bar, "Echoes are living..."
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

  // Glow intensity ramps up as countdown approaches zero.
  const glowOpacity = isGenerating ? 0.5 : Math.min(progress * 0.45, 0.45);

  return (
    <>
      {/* Centered digits + label */}
      <div
        className="flex flex-col items-center"
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
          <span className="tick-digit-breathe text-base sm:text-lg font-semibold text-accent leading-tight">
            {t('tickTimer.generating')}
          </span>
        ) : (
          <span
            className={`tick-digit-breathe text-xl sm:text-2xl font-semibold tabular-nums leading-tight tracking-wide ${
              isArrived ? 'text-success' : ''
            }`}
            style={isArrived ? undefined : { color: '#E8E0D8' }}
          >
            {timeDisplay}
          </span>
        )}
        {/* Sub-label — hidden on mobile during generating */}
        {!isGenerating && (
          <span className="hidden sm:block text-[10px] text-text-muted mt-0.5">
            {isArrived
              ? t('tickTimer.arrived')
              : t('tickTimer.nextHeartbeat')}
          </span>
        )}
      </div>

      {/* Full-width ambient bar — positioned at header bottom via absolute in AppLayout */}
      <div
        className="tick-bar absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden"
        aria-hidden="true"
      >
        {/* Track (dim baseline) */}
        <div className="absolute inset-0 bg-border opacity-20" />

        {/* Fill — width transitions smoothly during countdown */}
        {!isGenerating && !isArrived && (
          <div
            className="tick-bar-fill absolute inset-y-0 left-0"
            style={{ width: `${progress * 100}%` }}
          />
        )}

        {/* Heartbeat sweep — during generating */}
        {isGenerating && (
          <div className="tick-bar-heartbeat-sweep absolute inset-0" />
        )}

        {/* Shimmer overlay during generating */}
        {isGenerating && (
          <div className="tick-bar-shimmer absolute inset-0" />
        )}

        {/* Flash on arrival */}
        {isArrived && (
          <div className="tick-bar-flash absolute inset-0" />
        )}

        {/* Ambient glow bleeding upward */}
        <div
          className="absolute bottom-0 left-0 h-[6px] transition-opacity duration-1000"
          style={{
            width: isGenerating ? '100%' : `${progress * 100}%`,
            opacity: isGenerating ? 0.4 : glowOpacity,
            boxShadow: `0 -3px 8px 0 rgba(212, 145, 92, ${isGenerating ? 0.35 : glowOpacity})`,
          }}
        />
      </div>
    </>
  );
}
