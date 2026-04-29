import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { billing, adminBilling } from '../src/lib/api/endpoints.ts';

/**
 * Lane C Commit 2 — billing health client wrapper coverage.
 *
 * Asserts the URL/method per call and that the typed response shape
 * threads through unchanged. Mocks `fetch` directly so the harness
 * never hits a real backend. Each assertion has a paired Rule #30
 * invert capture documented in the commit body.
 */

interface MockFetchOpts {
  status?: number;
  body: unknown;
  contentType?: string;
}

function installFetch({ status = 200, body, contentType = 'application/json' }: MockFetchOpts) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': contentType },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('billing health client wrappers', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('billing.getMyHealth GETs /me/billing-health', async () => {
    const fetchMock = installFetch({
      body: {
        crypto_states: [],
        stripe_status: 'none',
        upcoming_renewal: null,
        in_grace_period: false,
        grace_period_ends_at: null,
      },
    });

    const result = await billing.getMyHealth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toMatch(/\/me\/billing-health$/);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result.in_grace_period).toBe(false);
    expect(result.stripe_status).toBe('none');
  });

  it('billing.getMyHealth surfaces in_grace_period=true when server reports grace', async () => {
    installFetch({
      body: {
        crypto_states: [],
        stripe_status: 'active',
        upcoming_renewal: null,
        in_grace_period: true,
        grace_period_ends_at: '2026-05-04T00:00:00Z',
      },
    });

    const result = await billing.getMyHealth();
    expect(result.in_grace_period).toBe(true);
    expect(result.grace_period_ends_at).toBe('2026-05-04T00:00:00Z');
  });

  it('adminBilling.listDunningStates GETs /admin/billing/dunning-states with default pagination', async () => {
    const fetchMock = installFetch({
      body: { items: [], total: 0, limit: 50, offset: 0 },
    });

    await adminBilling.listDunningStates();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/admin\/billing\/dunning-states\?limit=50&offset=0$/);
  });

  it('adminBilling.listDunningStates honours custom pagination args', async () => {
    const fetchMock = installFetch({
      body: { items: [], total: 0, limit: 25, offset: 100 },
    });

    await adminBilling.listDunningStates(25, 100);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/limit=25&offset=100$/);
  });

  it('adminBilling.listRevenueSnapshots GETs /admin/billing/revenue-snapshots', async () => {
    const fetchMock = installFetch({
      body: { items: [], total: 0, limit: 50, offset: 0 },
    });

    await adminBilling.listRevenueSnapshots();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/admin\/billing\/revenue-snapshots\?limit=50&offset=0$/);
  });
});
