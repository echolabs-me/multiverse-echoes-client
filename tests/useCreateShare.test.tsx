// Lane H Commit 5 D8 — wiring tests for the share.created emission
// path in `useCreateShare`. share-modal.test.tsx mocks the entire
// useCreateShare hook (Commit 4 design), so the trackShareCreated
// proof has to live one layer down at the hook itself. This file
// drives the hook directly with a mocked `feeds.share`.
//
// Coverage:
//   - On successful create, trackShareCreated fires once with
//     content_type='feed_item'.
//   - On rejected create, trackShareCreated does NOT fire.
//   - During in-flight create (before resolve), trackShareCreated
//     has not yet fired — it fires only on the .then() branch.
//
// Each assertion is Rule #30 invert-break-verify-revert:
// inverting `trackShareCreated('feed_item')` to `trackShareCreated('shard')`
// (or removing the call, or moving it before the await) was
// confirmed to fail with a meaningful message before reverting.
// Rule #30 evidence captured in the commit message.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const trackShareCreatedSpy = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/analytics-share.ts', () => ({
  trackShareCreated: trackShareCreatedSpy,
  trackShareViewed: vi.fn(),
}));

const feedsShareSpy = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/api/endpoints.ts', () => ({
  feeds: {
    share: feedsShareSpy,
  },
}));

import { useCreateShare } from '../src/hooks/useCreateShare.ts';

const SAMPLE_RESPONSE = {
  item_id: 'item-id-fixture',
  token: '0193f9b8-1234-7000-8000-000000000001',
  share_url:
    'https://echolabsme.com/share/0193f9b8-1234-7000-8000-000000000001',
  include_display_name: false,
  is_public: true,
  expires_at: null,
};

beforeEach(() => {
  trackShareCreatedSpy.mockReset();
  feedsShareSpy.mockReset();
});

describe('useCreateShare — share.created emission (Lane H Commit 5 D8)', () => {
  it('fires trackShareCreated once with content_type=feed_item on success', async () => {
    feedsShareSpy.mockResolvedValue(SAMPLE_RESPONSE);
    const { result } = renderHook(() => useCreateShare());

    await act(async () => {
      await result.current.create('fixture-item-id-123');
    });

    expect(trackShareCreatedSpy).toHaveBeenCalledTimes(1);
    expect(trackShareCreatedSpy).toHaveBeenCalledWith('feed_item');
  });

  it('does NOT fire trackShareCreated when the create call rejects', async () => {
    feedsShareSpy.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCreateShare());

    await act(async () => {
      await expect(
        result.current.create('fixture-item-id-123'),
      ).rejects.toThrow('boom');
    });

    expect(trackShareCreatedSpy).not.toHaveBeenCalled();
  });

  it('does NOT fire trackShareCreated while the create call is in-flight', async () => {
    let resolveFn: ((v: typeof SAMPLE_RESPONSE) => void) | null = null;
    feedsShareSpy.mockReturnValue(
      new Promise<typeof SAMPLE_RESPONSE>((resolve) => {
        resolveFn = resolve;
      }),
    );
    const { result } = renderHook(() => useCreateShare());

    let createPromise: Promise<unknown> | undefined;
    act(() => {
      createPromise = result.current.create('fixture-item-id-123');
    });

    // In-flight: the .then() branch has not yet run.
    expect(trackShareCreatedSpy).not.toHaveBeenCalled();

    // Now resolve — emission fires on the .then() branch.
    await act(async () => {
      resolveFn!(SAMPLE_RESPONSE);
      await createPromise;
    });

    await waitFor(() => {
      expect(trackShareCreatedSpy).toHaveBeenCalledTimes(1);
    });
  });
});
