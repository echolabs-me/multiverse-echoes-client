import { create } from 'zustand';
import type { DunningPhase } from '../types/generated.ts';

interface BillingHealthState {
  /**
   * Effective dunning phase for the authenticated user, derived from
   * the worst-case state across all crypto providers in
   * `BillingHealthResponse.crypto_states`. `null` while the initial
   * fetch is in flight or when the user has no dunning rows at all.
   */
  phase: DunningPhase | null;
  /**
   * Wall-clock timestamp of the most recent `PaymentFailed` WS event,
   * or `null` if none has fired since this client connected. The
   * banner uses this within a short recency window to surface the
   * "payment just failed" copy ahead of the slower phase-driven copy
   * (the dunning driver only ticks hourly, so the banner would
   * otherwise stay on the prior phase's copy until the next pass).
   */
  lastPaymentFailedAt: Date | null;
  /** Set the phase from a backend snapshot or `DunningPhaseChanged` WS event. */
  setPhase: (phase: DunningPhase | null) => void;
  /**
   * Record a `PaymentFailed` WS event: stamps `lastPaymentFailedAt`
   * and optimistically nudges the phase to `grace_period` so the
   * banner reflects the failure before the next hourly driver pass
   * publishes the authoritative `DunningPhaseChanged`. Backend remains
   * the source of truth — the next `setPhase` from a real driver
   * event overwrites this guess.
   */
  recordPaymentFailed: () => void;
}

export const useBillingHealth = create<BillingHealthState>((set) => ({
  phase: null,
  lastPaymentFailedAt: null,
  setPhase: (phase) => set({ phase }),
  recordPaymentFailed: () =>
    set({ phase: 'grace_period', lastPaymentFailedAt: new Date() }),
}));
