import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { request, ApiRequestError } from '../src/lib/api/client.ts';

/**
 * Guards that EVERY non-OK response from the API is parsed as JSON
 * with the canonical `{ error: { code, message } }` envelope. The
 * Rust side enforces this through `ApiError`'s `IntoResponse`; this
 * test pins the client side so a future refactor that adds a raw
 * `.text()` parse path (or a different envelope shape) is caught
 * before it ships.
 *
 * Why this matters: Chunk 3a's audit found that `AdminContext`'s
 * 403 used to return a plain text body instead of the envelope. The
 * client's request helper *did* fall back to `code: 'UNKNOWN'` in
 * that case, but the fix proper is to ensure the wire shape is
 * always JSON. This test makes sure no client code regresses to
 * accepting plain-text errors as a feature.
 */

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

describe('api/client.request — error response envelope handling', () => {
  beforeEach(() => {
    // Ensure no stored access token interferes.
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses a 403 ErrorEnvelope into ApiRequestError with the typed code/message', async () => {
    installFetch({
      status: 403,
      body: JSON.stringify({
        error: { code: 'ADMIN_REQUIRED', message: 'Admin access required' },
      }),
    });

    let caught: ApiRequestError | null = null;
    try {
      await request<unknown>('/admin/analytics/summary');
    } catch (e) {
      caught = e as ApiRequestError;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught?.status).toBe(403);
    expect(caught?.code).toBe('ADMIN_REQUIRED');
    expect(caught?.message).toBe('Admin access required');
  });

  it('parses a 400 ErrorEnvelope (e.g. validation) the same way', async () => {
    installFetch({
      status: 400,
      body: JSON.stringify({
        error: { code: 'INVALID_PERSONA', message: 'Persona text too long' },
      }),
    });

    let caught: ApiRequestError | null = null;
    try {
      await request<unknown>('/echoes');
    } catch (e) {
      caught = e as ApiRequestError;
    }

    expect(caught?.status).toBe(400);
    expect(caught?.code).toBe('INVALID_PERSONA');
    expect(caught?.message).toBe('Persona text too long');
  });

  it('parses a 500 ErrorEnvelope without leaking the underlying error', async () => {
    installFetch({
      status: 500,
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      }),
    });

    let caught: ApiRequestError | null = null;
    try {
      await request<unknown>('/echoes');
    } catch (e) {
      caught = e as ApiRequestError;
    }

    expect(caught?.code).toBe('INTERNAL_ERROR');
  });

  it('falls back to UNKNOWN when the body is plain text (not JSON)', async () => {
    // This guards the FALLBACK behaviour — if a future regression
    // makes the server return plain text again, the client must NOT
    // crash. It must surface a typed `UNKNOWN` error so the UI can
    // still render something sensible. The fact that this case is
    // reachable is itself a code smell the server should never
    // trigger on, but the client's defence-in-depth is correct.
    installFetch({
      status: 403,
      body: 'Admin access required',
      contentType: 'text/plain',
    });

    let caught: ApiRequestError | null = null;
    try {
      await request<unknown>('/admin/analytics/summary');
    } catch (e) {
      caught = e as ApiRequestError;
    }

    expect(caught?.status).toBe(403);
    expect(caught?.code).toBe('UNKNOWN');
    // Pin the EXACT fallback message format. A drift to e.g.
    // "Unknown 403 response" or "fail 403 abc" would still pass a
    // loose .toContain('403') check; this one would not.
    expect(caught?.message).toBe('HTTP 403');
  });

  it('never calls .text() on the response — JSON-only by contract', async () => {
    // Spy that the request helper never reads the body via .text(),
    // which is what would happen if someone added a "if 403 read as
    // string" branch. We verify by giving the response a tracked
    // .text() that we assert was NOT invoked.
    const textSpy = vi.fn().mockResolvedValue('should not be called');
    const jsonSpy = vi
      .fn()
      .mockResolvedValue({ error: { code: 'X', message: 'm' } });

    const fakeResponse = {
      ok: false,
      status: 403,
      json: jsonSpy,
      text: textSpy,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    try {
      await request<unknown>('/admin/foo');
    } catch {
      // Expected to throw.
    }

    expect(jsonSpy).toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
  });
});
