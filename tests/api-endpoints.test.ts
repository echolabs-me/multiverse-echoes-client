import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { users, marketplace } from '../src/lib/api/endpoints.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';

interface MockFetchOpts {
  status: number;
  body: unknown;
}

function installFetch({ status, body }: MockFetchOpts) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function calledUrl(mock: ReturnType<typeof vi.fn>): string {
  return String(mock.mock.calls[0][0]);
}

function calledOptions(mock: ReturnType<typeof vi.fn>): RequestInit {
  return mock.mock.calls[0][1] as RequestInit;
}

const ERROR_ENVELOPE = {
  error: { code: 'NOT_FOUND', message: 'Not found' },
};

describe('endpoints.users.getProfile', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /users/{userId} and returns the typed PublicProfileResponse', async () => {
    const profile = {
      user_id: 'u1',
      display_name: 'Alice',
      bio: null,
      avatar_url: null,
      profile_visibility: 'Public',
      account_type: 'Personal',
      subscription_tier: 'Free',
      created_at: '2026-01-01T00:00:00Z',
      mutual_follow: false,
      is_founding_echo: false,
    };
    const fetchMock = installFetch({ status: 200, body: profile });

    const result = await users.getProfile('user-123');

    expect(calledUrl(fetchMock)).toContain('/users/user-123');
    expect(calledOptions(fetchMock).method ?? 'GET').toBe('GET');
    expect(result).toEqual(profile);
  });

  it('rejects with ApiRequestError on a 404 envelope', async () => {
    installFetch({ status: 404, body: ERROR_ENVELOPE });

    await expect(users.getProfile('missing')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});

describe('endpoints.users.getPublic', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /public/users/{userId} (anonymous, no auth required) and returns PublicUserOgResponse', async () => {
    const og = {
      user_id: 'u1',
      display_name: 'Alice',
      avatar_url: null,
      bio_preview: null,
      joined_year: 2026,
      profile_type: 'Public',
    };
    const fetchMock = installFetch({ status: 200, body: og });

    const result = await users.getPublic('user-123');

    expect(calledUrl(fetchMock)).toContain('/public/users/user-123');
    expect(calledOptions(fetchMock).method ?? 'GET').toBe('GET');
    expect(result).toEqual(og);
  });

  it('rejects with ApiRequestError on a 404 envelope', async () => {
    installFetch({ status: 404, body: ERROR_ENVELOPE });

    await expect(users.getPublic('private-user')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});

describe('endpoints.users.listEchoes', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /users/{userId}/echoes and returns a PublicEchoRef[] array', async () => {
    const list = [
      {
        echo_id: 'e1',
        name: 'Echo One',
        current_shard_id: 's1',
        current_mood: 'curious',
        avatar_url: null,
        created_at: '2026-01-01T00:00:00Z',
        owner_is_founding_echo: false,
      },
    ];
    const fetchMock = installFetch({ status: 200, body: list });

    const result = await users.listEchoes('user-123');

    const url = calledUrl(fetchMock);
    expect(url).toContain('/users/user-123/echoes');
    // No params → no query string emitted.
    expect(url).not.toContain('?');
    expect(calledOptions(fetchMock).method ?? 'GET').toBe('GET');
    expect(result).toEqual(list);
  });

  it('forwards limit and offset query params verbatim', async () => {
    const fetchMock = installFetch({ status: 200, body: [] });

    await users.listEchoes('user-123', { limit: 50, offset: 100 });

    const url = calledUrl(fetchMock);
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=100');
  });

  it('rejects with ApiRequestError on a 404 envelope', async () => {
    installFetch({ status: 404, body: ERROR_ENVELOPE });

    await expect(users.listEchoes('blocked')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});

describe('endpoints.marketplace.list', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /marketplace/items with no params and returns the paginated page', async () => {
    const page = { data: [], next_cursor: null };
    const fetchMock = installFetch({ status: 200, body: page });

    const result = await marketplace.list();

    const url = calledUrl(fetchMock);
    expect(url).toContain('/marketplace/items');
    expect(url).not.toContain('?');
    expect(calledOptions(fetchMock).method ?? 'GET').toBe('GET');
    expect(result).toEqual(page);
  });

  it('forwards cursor / limit / item_type / rarity verbatim', async () => {
    const fetchMock = installFetch({
      status: 200,
      body: { data: [], next_cursor: null },
    });

    await marketplace.list({
      cursor: 'abc',
      limit: 25,
      item_type: 'EchoSkin',
      rarity: 'Rare',
    });

    const url = calledUrl(fetchMock);
    expect(url).toContain('cursor=abc');
    expect(url).toContain('limit=25');
    expect(url).toContain('item_type=EchoSkin');
    expect(url).toContain('rarity=Rare');
  });

  it('rejects with ApiRequestError on a 500 envelope', async () => {
    installFetch({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'oops' } },
    });

    await expect(marketplace.list()).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe('endpoints.marketplace.get', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GETs /marketplace/items/{itemId} and returns MarketplaceItemResponse', async () => {
    const item = {
      item_id: 'item-1',
      name: 'Aurora',
      description: 'shimmer',
      item_type: 'EchoSkin',
      rarity: 'Common',
      price_tier_required: 'Free',
      price_coins: 0,
      image_url: null,
      is_available: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    const fetchMock = installFetch({ status: 200, body: item });

    const result = await marketplace.get('item-1');

    expect(calledUrl(fetchMock)).toContain('/marketplace/items/item-1');
    expect(calledOptions(fetchMock).method ?? 'GET').toBe('GET');
    expect(result).toEqual(item);
  });

  it('rejects with ApiRequestError on a 404 envelope', async () => {
    installFetch({ status: 404, body: ERROR_ENVELOPE });

    await expect(marketplace.get('missing')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});

describe('endpoints.marketplace.purchase', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs /marketplace/purchase with { item_id } body and returns InventoryRowResponse', async () => {
    const row = {
      inventory_id: 'inv-1',
      item_id: 'item-1',
      acquired_at: '2026-04-26T00:00:00Z',
      equipped: false,
      price_paid_coins: 0,
      item: null,
    };
    const fetchMock = installFetch({ status: 201, body: row });

    const result = await marketplace.purchase('item-1');

    const url = calledUrl(fetchMock);
    const opts = calledOptions(fetchMock);
    expect(url).toContain('/marketplace/purchase');
    // Item id MUST be in the body, not the path.
    expect(url).not.toContain('/marketplace/purchase/item-1');
    expect(url).not.toContain('/marketplace/items/item-1/purchase');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ item_id: 'item-1' });
    expect(result).toEqual(row);
  });

  it('rejects with ApiRequestError on a 403 TIER_INSUFFICIENT envelope', async () => {
    installFetch({
      status: 403,
      body: {
        error: {
          code: 'TIER_INSUFFICIENT',
          message: 'This item requires Core tier or higher',
        },
      },
    });

    await expect(marketplace.purchase('item-1')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
