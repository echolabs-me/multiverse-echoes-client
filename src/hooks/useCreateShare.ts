/**
 * `useCreateShare` — per-component action hook for `POST /feeds/{itemId}/share`.
 *
 * Lane H Commit 4 introduced the action-hook pattern to this codebase. Prior
 * client hooks (under `client/src/hooks/`) were all read-side / observation
 * hooks (`useGpuAvailable`, `useTickTimer`, `useEchoWebSocket`, etc.); writes
 * went through Zustand stores under `client/src/stores/`. ShareModal does not
 * need global state — each ShareModal instance owns its own create call and
 * its own response — so a Zustand store would be over-engineering. This hook
 * is the canonical pattern for any future per-component action that fits the
 * same shape (single endpoint call, isolated loading + error + result state).
 *
 * Cache: none. Each call to `create` mints a new server-side `ShareToken` by
 * design — Lane H Commit 1 `ShareToken` is per-share-token, not per-item, so
 * caching the response across modal re-opens would silently swallow the
 * intended new-token-per-open semantic. Callers cache the response themselves
 * for the lifetime of the modal-open session via local component state.
 */
import { useCallback, useState } from 'react';
import { feeds } from '../lib/api/endpoints.ts';
import { trackShareCreated } from '../lib/analytics-share.ts';
import type {
  ShareFeedItemRequest,
  ShareFeedItemResponse,
} from '../types/generated.ts';

export interface UseCreateShareResult {
  /** Trigger the create call. Resolves with the server response. */
  create: (
    itemId: string,
    body?: ShareFeedItemRequest,
  ) => Promise<ShareFeedItemResponse>;
  /** True from the moment `create` is invoked until it resolves or rejects. */
  isLoading: boolean;
  /** The error from the most recent `create` call, or `null` after a success. */
  error: Error | null;
  /** Manually reset `isLoading` + `error` to their initial state. */
  reset: () => void;
}

export function useCreateShare(): UseCreateShareResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (
      itemId: string,
      body: ShareFeedItemRequest = {},
    ): Promise<ShareFeedItemResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await feeds.share(itemId, body);
        // Lane H Commit 5 D6 — emit share.created on success only.
        // Errors and the in-flight loading state do NOT fire the
        // event (unit-pinned in client/tests/useCreateShare.test.tsx).
        // Only feed items are shareable today; the type widens to
        // a union when other surfaces become shareable.
        trackShareCreated('feed_item');
        setIsLoading(false);
        return response;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setIsLoading(false);
        throw e;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return { create, isLoading, error, reset };
}
