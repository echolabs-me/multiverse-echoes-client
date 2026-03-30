import { useTranslation } from 'react-i18next';
import { useTickTimer } from '../hooks/useTickTimer.ts';

/**
 * Global tick countdown timer — the heartbeat of the simulation.
 * Lives in the app header, visible on every authenticated page.
 *
 * State machine:
 * - COUNTING_DOWN: circular progress arc + seconds remaining
 * - GENERATING: pulsing glow, "Echoes are living..."
 * - ARRIVED: brief celebration pulse, then back to countdown
 */
export function TickTimer() {
  const { t } = useTranslation();
  const { state, secondsRemaining, tickInterval } = useTickTimer();

  // Progress fraction (0 = just ticked, 1 = about to tick).
  const progress = tickInterval > 0 ? 1 - secondsRemaining / tickInterval : 0;

  // SVG arc parameters.
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  // Format seconds as M:SS.
  const minutes = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const isGenerating = state === 'generating';
  const isArrived = state === 'arrived';

  return (
    <div
      className={`flex items-center gap-2 ${isArrived ? 'tick-timer-arrived' : ''}`}
      aria-live="polite"
      aria-label={
        isGenerating
          ? t('tickTimer.generating')
          : isArrived
            ? t('tickTimer.arrived')
            : t('tickTimer.countdown', { seconds: secondsRemaining })
      }
    >
      {/* Circular progress ring */}
      <div className={`relative flex-shrink-0 ${isGenerating ? 'tick-timer-pulse' : ''}`}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={`-rotate-90 ${isArrived ? 'tick-timer-flash' : ''}`}
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border opacity-40"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isGenerating ? 0 : dashOffset}
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
              isGenerating
                ? 'text-accent opacity-50'
                : isArrived
                  ? 'text-success'
                  : 'text-accent'
            }`}
          />
        </svg>
        {/* Center text — time or generating dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isGenerating ? (
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          ) : (
            <span
              className={`text-[10px] font-mono font-bold tabular-nums leading-none ${
                isArrived ? 'text-success' : 'text-accent'
              }`}
            >
              {timeDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Label text — hidden on very small screens, visible on sm+ */}
      <span
        className={`hidden sm:block text-xs font-medium transition-colors duration-300 ${
          isGenerating
            ? 'text-accent'
            : isArrived
              ? 'text-success'
              : 'text-text-muted'
        }`}
      >
        {isGenerating
          ? t('tickTimer.generating')
          : isArrived
            ? t('tickTimer.arrived')
            : t('tickTimer.nextTick', { time: timeDisplay })}
      </span>
    </div>
  );
}
