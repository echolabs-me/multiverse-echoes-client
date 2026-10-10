import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * The visit to the key the render shows now, for a load or an action that
 * started on it to check before it writes (R360.1, R371.2, R371.3, R434.1).
 *
 * A load started for one key (a route's id, a filter, a query) can settle
 * after the render has moved to another, or after the page has gone, or
 * after the render has moved away and come back to the same key. A visit
 * is the time a key is shown without a break: every change of key, back to
 * an earlier value included, begins a new visit. `visitOf(started)` returns
 * the `isCurrent` of the visit now shown when `started` is the key shown,
 * and `() => false` otherwise. `isCurrent()` is true only while that visit
 * lasts on a mounted page, so a load from an earlier visit (Echo A, then B,
 * then A again) writes nothing: not the page's state and not a store.
 *
 * The key is updated in a layout effect, which React runs synchronously in
 * the commit that renders the new key, before any promise callback can run.
 * A passive effect (`useEffect`), a flag set in a load effect's cleanup, or
 * an `AbortController` aborted in cleanup all run after that commit, and a
 * navigation outside a discrete event (back, forward) can delay them
 * further, so a stale load settling in that gap would read as current. The
 * layout effect's cleanup marks the page gone, so a page that has gone has
 * no current visit (R371.3). A page mounted again with the same key (React's
 * `StrictMode`) keeps its visit; one mounted with another key begins one.
 *
 * Keys are compared with `Object.is`: a key made of several parts is
 * passed as one string.
 */
export function useCurrentKey<K>(key: K): (started: K) => () => boolean {
  const shown = useRef({ key, visit: 0, mounted: true });
  useLayoutEffect(() => {
    const now = shown.current;
    if (!Object.is(now.key, key)) {
      now.key = key;
      now.visit += 1;
    }
    now.mounted = true;
    return () => {
      now.mounted = false;
    };
  }, [key]);
  return useCallback((started: K) => {
    const now = shown.current;
    if (!now.mounted || !Object.is(now.key, started)) return () => false;
    const visit = now.visit;
    return () => now.mounted && now.visit === visit;
  }, []);
}

/**
 * Of the loads a page starts, only the last one started may write, and
 * only while the page is mounted and still shows the key it was started for
 * (R381.1).
 *
 * A page can start two loads for one key: an effect that runs again, a
 * reload after an action, or `StrictMode`'s second run of every effect in
 * development. Comparing keys alone lets each of them write, so whichever
 * settles last wins, and an older load that fails last replaces a newer
 * success with its error. `start(key)` begins a load and returns its
 * `isCurrent`, which is true only while no later load has started on this
 * page and the visit to `key` it started in still lasts (R434.1).
 *
 * A load started for a key that is not current is no load (R390.3a): a
 * call kept from an earlier key (a handler's captured load function, a
 * timer, a live event) supersedes nothing, so it cannot end the current
 * key's load, and its `isCurrent` is false from the start.
 *
 * A mutation's response is the newest write (R390.3b). A mutation whose
 * response the page writes calls `start` when it starts, which supersedes
 * every load started before it, and again when its response arrives in
 * the visit it started in, which supersedes every load started while it
 * was pending; one whose answer the page only reads after (a poll) calls
 * `start` with that read. A response or a failure that arrives in a later
 * visit, to the same key or another, writes nothing, starts no load and
 * supersedes nothing (R483.1): the mutation captures the visit with
 * `useCurrentKey` when it starts. It writes its response with that second
 * `isCurrent`, or writes it and then starts a full read in the same
 * synchronous run, whose `start` is that second call. An equip, whose
 * response the page does not write but reads after, only starts that
 * read; a vote or a cancel, which the page neither writes nor reads after,
 * starts nothing. Either way a load that started before the response
 * arrived writes nothing after it.
 *
 * A superseded read writes nothing of the state its `useLatestLoad`
 * covers, so it never ends that state's loading. When a mutation
 * superseded a read that was still running, when it started or when its
 * response arrived, the page starts a full read for its current key when
 * the mutation ends in its visit, whether it succeeded or failed, after it
 * writes its response or its failure (R463.2): that read is a new load,
 * so it writes, and it ends the loading. Whether a read is running is kept
 * where a handler reads it at once (a ref, or the store's own state), never
 * only in what the page last rendered. This hook does not start that read:
 * each page does.
 *
 * Loads that write different state are separate: a page takes one
 * `useLatestLoad` for each piece of state that loads write, so a load of
 * one piece never supersedes a load of another.
 */
export function useLatestLoad<K>(key: K): (started: K) => () => boolean {
  const visitOf = useCurrentKey(key);
  const latest = useRef(0);
  return useCallback(
    (started: K) => {
      const inVisit = visitOf(started);
      if (!inVisit()) return () => false;
      latest.current += 1;
      const load = latest.current;
      return () => latest.current === load && inVisit();
    },
    [visitOf],
  );
}

/**
 * `work`, settled only while its load is current (R422.1).
 *
 * A superseded load's answer, success or failure, writes nothing and shows
 * nothing: no state, no store, no toast, no error, and no rejection that
 * reaches a load still current. The returned promise settles as `work`
 * does when `isCurrent()` is true at that moment, and otherwise never
 * settles, so none of the caller's `then`, `catch` or `finally` runs and no
 * caller guards a handler by hand. `work`'s own rejection is always
 * handled here, so a superseded failure is not reported as unhandled.
 *
 * A superseded load's `finally` does not run: the load that superseded it
 * owns the page's loading flags.
 */
export function whenCurrent<T>(
  isCurrent: () => boolean,
  work: Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    work.then(
      (value) => {
        if (isCurrent()) resolve(value);
      },
      (error: unknown) => {
        if (isCurrent()) reject(error);
      },
    );
  });
}
