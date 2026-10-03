import { useCallback } from 'react';
import type { Marker } from '../lib/inFlightMarkers.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { heldKey, useInFlightStore } from '../stores/useInFlightStore.ts';

/** Who is signed in, as the auth store holds it. */
interface SignIn {
  isAuthenticated: boolean;
  user: { user_id: string } | null;
}

/**
 * Starts a new session on each change of who is signed in (R296.1):
 * `isAuthenticated` changing, or the user id changing from one id to a
 * different id. A profile arriving for a session already signed in, its id
 * going from absent to present, is not a change; the session takes that id
 * as its own.
 */
function followSignIn(next: SignIn, prev: SignIn) {
  const id = next.user?.user_id ?? null;
  const { session, sessionUser } = useInFlightStore.getState();
  if (
    next.isAuthenticated !== prev.isAuthenticated ||
    (id !== null && sessionUser !== null && id !== sessionUser)
  ) {
    useInFlightStore.setState({ session: session + 1, sessionUser: id });
  } else if (id !== null && sessionUser === null) {
    useInFlightStore.setState({ sessionUser: id });
  }
}

// The session is followed from the hook's first import for as long as the
// app runs, as the store it keys outlives every page.
useInFlightStore.setState({
  sessionUser: useAuthStore.getState().user?.user_id ?? null,
});
useAuthStore.subscribe(followSignIn);

/**
 * In-flight markers for the controls that send a write (R265, R288). A
 * marker from `markers` names one write on one target, so a held row does
 * not block another row and two writes never share a marker.
 *
 * `run` sends nothing while its marker is held, and holds it from the
 * trigger until the request settles. The store is read and written in the
 * same call, so a second trigger in the same tick finds the marker held,
 * from this component or any other. `isHeld` re-renders on every change, so
 * each control showing a held write is disabled.
 *
 * A held write belongs to the session that sent it (R296.1). `run` reads the
 * session when the write is triggered and releases that same pair when the
 * request settles, whatever the session is then. `isHeld` answers for the
 * session now. Nothing that calls the hook passes a session.
 */
export function useInFlight() {
  const held = useInFlightStore((s) => s.held);
  const session = useInFlightStore((s) => s.session);

  const run = useCallback(
    async (marker: Marker, send: () => Promise<void>): Promise<void> => {
      const { session: sender, hold, release } = useInFlightStore.getState();
      if (!hold(sender, marker)) return;
      try {
        await send();
      } finally {
        release(sender, marker);
      }
    },
    [],
  );

  const isHeld = useCallback(
    (marker: Marker) => held.has(heldKey(session, marker)),
    [held, session],
  );

  return { run, isHeld };
}
