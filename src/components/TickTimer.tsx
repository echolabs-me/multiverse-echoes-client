import { useTranslation } from 'react-i18next';
import { useTickTimer } from '../hooks/useTickTimer.ts';

/**
 * Global tick countdown timer — the heartbeat of the simulation.
 * Centered in the app header as the hero element.
 *
 * State machine (unchanged from useTickTimer):
 * - COUNTING_DOWN: gradient progress arc + large countdown digits
 * - GENERATING: heartbeat glow pulse, "Echoes are living..."
 * - ARRIVED: ripple effect outward, then back to countdown
 */
export function TickTimer() {
  const { t } = useTranslation();
  const { state, secondsRemaining, tickInterval } = useTickTimer();

  // Progress fraction (0 = just ticked, 1 = about to tick).
  const progress = tickInterval > 0 ? 1 - secondsRemaining / tickInterval : 0;

  // SVG arc parameters — large ring that fills the header height.
  const size = 44;
  const mobileSize = 38;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  // Format seconds as M:SS.
  const minutes = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const isGenerating = state === 'generating';
  const isArrived = state === 'arrived';

  // Glow intensity increases as countdown approaches zero.
  const glowIntensity = isGenerating ? 1 : Math.min(progress * 1.5, 1);
  const glowRadius = Math.round(4 + glowIntensity * 8);

  return (
    <div
      className="tick-timer-hero flex items-center gap-3"
      aria-live="polite"
      aria-label={
        isGenerating
          ? t('tickTimer.generating')
          : isArrived
            ? t('tickTimer.arrived')
            : t('tickTimer.countdown', { seconds: secondsRemaining })
      }
    >
      {/* Ring + digits container */}
      <div
        className={`tick-timer-ring relative flex-shrink-0 ${
          isGenerating ? 'tick-timer-heartbeat' : ''
        } ${isArrived ? 'tick-timer-ripple' : ''}`}
        style={{
          filter: isGenerating
            ? undefined
            : `drop-shadow(0 0 ${glowRadius}px rgba(212, 145, 92, ${glowIntensity * 0.4}))`,
        }}
      >
        {/* Desktop ring */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 hidden sm:block"
        >
          <defs>
            <linearGradient id="tick-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent, #d4915c)" />
              <stop offset="100%" stopColor="#f5dcc0" />
            </linearGradient>
            <linearGradient id="tick-ring-success" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--success, #6baf7a)" />
              <stop offset="100%" stopColor="#b8e6c0" />
            </linearGradient>
          </defs>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border opacity-30"
          />
          {/* Progress arc with gradient */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isArrived ? 'url(#tick-ring-success)' : 'url(#tick-ring-grad)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isGenerating ? 0 : dashOffset}
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
              isGenerating ? 'opacity-50' : ''
            }`}
          />
        </svg>
        {/* Mobile ring (slightly smaller) */}
        <svg
          width={mobileSize}
          height={mobileSize}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 sm:hidden"
        >
          <defs>
            <linearGradient id="tick-ring-grad-m" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent, #d4915c)" />
              <stop offset="100%" stopColor="#f5dcc0" />
            </linearGradient>
            <linearGradient id="tick-ring-success-m" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--success, #6baf7a)" />
              <stop offset="100%" stopColor="#b8e6c0" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border opacity-30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isArrived ? 'url(#tick-ring-success-m)' : 'url(#tick-ring-grad-m)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isGenerating ? 0 : dashOffset}
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
              isGenerating ? 'opacity-50' : ''
            }`}
          />
        </svg>

        {/* Center content — large digits or generating indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isGenerating ? (
            <span className="h-2.5 w-2.5 rounded-full bg-accent tick-timer-dot-pulse" />
          ) : (
            <span
              className={`tick-timer-digits text-sm sm:text-[15px] font-mono font-bold tabular-nums leading-none ${
                isArrived ? 'text-success' : 'text-accent'
              }`}
            >
              {timeDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Label — always visible, responsive sizing */}
      <span
        className={`text-[11px] sm:text-xs font-medium transition-colors duration-300 whitespace-nowrap ${
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
