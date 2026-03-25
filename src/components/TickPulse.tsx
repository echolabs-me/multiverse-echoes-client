/**
 * TickPulse — Subtle visual pulse indicating the simulation is alive.
 *
 * Every 60 seconds, a barely-perceptible ripple emanates from the children.
 * Duration: 1 second. Opacity change: 5% maximum.
 * Disabled entirely when prefers-reduced-motion is active.
 * Pure CSS animation — no GPU shader, no R3F overhead.
 *
 * Reference: ME-CDS-001 §7.3.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Pulse interval in milliseconds (60 seconds). */
const PULSE_INTERVAL_MS = 60_000;

/** Pulse animation duration in milliseconds. */
const PULSE_DURATION_MS = 1000;

export interface TickPulseProps {
  children: ReactNode;
  /** Override interval (ms) — primarily for testing. */
  intervalMs?: number;
  /** Disable the pulse entirely. */
  disabled?: boolean;
}

export function TickPulse({
  children,
  intervalMs = PULSE_INTERVAL_MS,
  disabled = false,
}: TickPulseProps) {
  const reducedMotion = useReducedMotion();
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (reducedMotion || disabled) return;

    const interval = setInterval(() => {
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, reducedMotion, disabled]);

  return (
    <div className="relative inline-block">
      {children}
      {isPulsing && !reducedMotion && !disabled && (
        <div
          className="pointer-events-none absolute inset-0 animate-tick-pulse rounded-xl"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default TickPulse;
