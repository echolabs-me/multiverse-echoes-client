import { create } from 'zustand';
import type { Marker } from '../lib/inFlightMarkers.ts';

/**
 * A sign-in session (R296.1). It runs from one change of who is signed in
 * to the next: `isAuthenticated` changing, or the signed-in user's id
 * changing from one id to a different id. A profile arriving for a session
 * already signed in is not a change. `useInFlight` follows the auth store
 * and starts each new session.
 */
export type Session = number;

/** One held write: a session and a marker, as one key in `held`. */
export const heldKey = (session: Session, marker: Marker) =>
  JSON.stringify([session, marker]);

/**
 * The writes in flight, for the whole app (R288.1). Two mounted components
 * that hold the same marker see one held state, and a marker still in flight
 * when its page is left stays held until its request settles (R288.2).
 *
 * A held write belongs to the session that sent it, because the store
 * outlives a sign-out (R296.1): a later session, by any account, holds its
 * own. `useInFlight` is the only reader and writer.
 */
interface InFlightState {
  held: ReadonlySet<string>;
  /** The session now. */
  session: Session;
  /** The user id the session now belongs to, or null until its profile arrives. */
  sessionUser: string | null;
  /** Holds `marker` for `session`, or answers false if it is already held. */
  hold: (session: Session, marker: Marker) => boolean;
  release: (session: Session, marker: Marker) => void;
}

export const useInFlightStore = create<InFlightState>((set, get) => ({
  held: new Set(),
  session: 0,
  sessionUser: null,
  hold: (session, marker) => {
    const key = heldKey(session, marker);
    const { held } = get();
    if (held.has(key)) return false;
    set({ held: new Set(held).add(key) });
    return true;
  },
  release: (session, marker) => {
    const held = new Set(get().held);
    held.delete(heldKey(session, marker));
    set({ held });
  },
}));
