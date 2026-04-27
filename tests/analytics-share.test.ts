// Lane H Commit 5 D8 — unit tests for analytics-share.ts.
//
// Pin the property shape of share.created and share.viewed at the
// helper layer. Any future spec amendment that renames a property
// (e.g. `content_type` → `surface`) fails here loudly instead of
// silently shifting the wire shape downstream.
//
// Rule #30 invert-break-verify-revert evidence captured in the
// commit message and Session 130 log.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackEventSpy = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: trackEventSpy,
}));

import {
  trackShareCreated,
  trackShareViewed,
} from '../src/lib/analytics-share.ts';

beforeEach(() => {
  trackEventSpy.mockReset();
});

describe('analytics-share — share.created (Lane H Commit 5 D8)', () => {
  it('emits share.created with content_type=feed_item', () => {
    trackShareCreated('feed_item');
    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith('share.created', {
      content_type: 'feed_item',
    });
  });

  it('does not emit any other event for share.created', () => {
    trackShareCreated('feed_item');
    // Single call, single name. Catches a future regression where
    // a refactor accidentally adds a sibling emit (e.g. legacy
    // `share.opened` shadow event).
    const allNames = trackEventSpy.mock.calls.map((c) => c[0]);
    expect(allNames).toEqual(['share.created']);
  });
});

describe('analytics-share — share.viewed (Lane H Commit 5 D8)', () => {
  it('emits share.viewed with referrer + viewer_is_registered=true', () => {
    trackShareViewed('https://example.com/page', true);
    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith('share.viewed', {
      referrer: 'https://example.com/page',
      viewer_is_registered: true,
    });
  });

  it('emits share.viewed with viewer_is_registered=false for anonymous', () => {
    // Worker emits with false (no auth context); SPA-internal
    // surfaces emit with true. The helper itself is value-agnostic.
    trackShareViewed('', false);
    expect(trackEventSpy).toHaveBeenCalledWith('share.viewed', {
      referrer: '',
      viewer_is_registered: false,
    });
  });

  it('preserves the referrer string verbatim — no client-side strip', () => {
    // The Worker AND the Rust API both strip referrer query strings
    // (Lane H Commit 5 D5/D1 defense-in-depth). The SPA helper does
    // NOT strip — it is the caller's job to pass an already-clean
    // value when one is required, otherwise the server enforces.
    // This test pins the no-strip behaviour so a future "helpful"
    // refactor doesn't accidentally double-strip.
    trackShareViewed('https://example.com/page?utm=foo', true);
    expect(trackEventSpy).toHaveBeenCalledWith('share.viewed', {
      referrer: 'https://example.com/page?utm=foo',
      viewer_is_registered: true,
    });
  });
});
