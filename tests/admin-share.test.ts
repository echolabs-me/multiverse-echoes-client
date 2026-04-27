// Lane H Commit 6 — unit tests for adminShare.listViralContent.
//
// Pin URL + method + query-string per call. Mocks `fetch` directly
// (mirrors the api-error-envelope.test.ts pattern). Each `it` block
// has a Rule #30 invert-break-verify-revert cycle captured verbatim
// in the commit message.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { adminShare } from '../src/lib/api/endpoints.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';

interface MockFetchOpts {
  status: number;
  body: string;
  contentType?: string;
}

function installFetch({ status, body, contentType = 'application/json' }: MockFetchOpts) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body, {
      status,
      headers: { 'Content-Type': contentType },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const HAPPY_BODY = JSON.stringify({
  items: [],
  total: 0,
  threshold_used: 20,
  since: '2026-04-26T00:00:00Z',
});

describe('adminShare.listViralContent — Lane H Commit 6 D6', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hits GET /admin/share/viral-content with no query string when no params given', async () => {
    const fetchMock = installFetch({ status: 200, body: HAPPY_BODY });

    await adminShare.listViralContent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(url).toContain('/admin/share/viral-content');
    expect(url).not.toContain('?');
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('forwards explicit since/min_share_count/limit/offset as query string', async () => {
    const fetchMock = installFetch({ status: 200, body: HAPPY_BODY });

    await adminShare.listViralContent({
      since: '2026-04-25T00:00:00Z',
      min_share_count: 5,
      limit: 25,
      offset: 50,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/admin/share/viral-content?');
    expect(url).toContain('since=2026-04-25T00%3A00%3A00Z');
    expect(url).toContain('min_share_count=5');
    expect(url).toContain('limit=25');
    expect(url).toContain('offset=50');
  });

  it('does not emit query keys for params that are undefined', async () => {
    const fetchMock = installFetch({ status: 200, body: HAPPY_BODY });

    await adminShare.listViralContent({ limit: 10 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
    expect(url).not.toContain('since=');
    expect(url).not.toContain('min_share_count=');
    expect(url).not.toContain('offset=');
  });

  it('surfaces a 400 LIMIT_EXCEEDS_MAX as ApiRequestError with the typed code', async () => {
    installFetch({
      status: 400,
      body: JSON.stringify({
        error: { code: 'LIMIT_EXCEEDS_MAX', message: 'limit must be <= 500' },
      }),
    });

    let caught: ApiRequestError | null = null;
    try {
      await adminShare.listViralContent({ limit: 9999 });
    } catch (e) {
      caught = e as ApiRequestError;
    }
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught?.status).toBe(400);
    expect(caught?.code).toBe('LIMIT_EXCEEDS_MAX');
  });
});
