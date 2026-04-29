/**
 * Share-subsystem analytics helpers.
 * Reference: ME-UXF-001 §16.5 (share.created + share.viewed).
 *
 * Lane H Commit 5 Deliverable 6. Thin wrappers around `trackEvent`
 * (see [analytics.ts](./analytics.ts)) so every share-related emit
 * call site uses the same property shape and event name. Centralising
 * here means any future spec amendment to property keys is a one-line
 * change instead of a grep-and-edit across consumers.
 *
 * - `trackShareCreated` is invoked from [useCreateShare](../hooks/useCreateShare.ts)
 *   on the `.then()` branch of a successful `POST /feeds/{itemId}/share`.
 *   Authenticated path → flushes through `POST /analytics/events`.
 *
 * - `trackShareViewed` is exported as a public function but **NOT
 *   currently invoked from any SPA surface**. The canonical emission
 *   site for share-page views is the `og-router` Cloudflare Worker
 *   (`workers/og-router/worker.js::emitShareViewed`), which fires on
 *   every `/share/{token}` render via `POST /analytics/events/anonymous`.
 *   The SPA-side helper exists for any future Lane H Commit 6+
 *   in-app share-preview surface that would benefit from emitting an
 *   authenticated `share.viewed` (with `viewer_is_registered=true`)
 *   alongside the Worker's anonymous emit.
 */

import { trackEvent } from './analytics.ts';

/**
 * Content type the share originated from. Today only feed items are
 * shareable; the union exists so future shareable surfaces (echoes,
 * shards) extend the type without breaking existing call sites.
 */
export type ShareContentType = 'feed_item';

/**
 * Emit `share.created` after a successful `POST /feeds/{itemId}/share`.
 * Properties follow ME-UXF-001 §16.5: `content_type` only — the
 * server side already knows the user (auth context) and the share
 * token (response body), so neither belongs on the wire.
 */
export function trackShareCreated(content_type: ShareContentType): void {
  trackEvent('share.created', { content_type });
}

/**
 * Emit `share.viewed` from an SPA-internal share-preview surface.
 *
 * The `og-router` Worker emits this same event for the public share
 * render path with `viewer_is_registered=false` — call this helper
 * only from authenticated SPA surfaces (where `viewer_is_registered`
 * would be `true`). Unused in Commit 5; reserved for Commit 6+.
 */
export function trackShareViewed(
  referrer: string,
  viewer_is_registered: boolean,
): void {
  trackEvent('share.viewed', { referrer, viewer_is_registered });
}
