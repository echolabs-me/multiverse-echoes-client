/**
 * Shared test helpers for E2E tests.
 * Sets up mock API routes so tests don't need a live engine.
 */

import type { Page } from '@playwright/test';

const MOCK_USER = {
  user_id: '00000000-0000-0000-0000-000000000001',
  email: 'test@echolabs.me',
  display_name: 'TestUser',
  subscription_tier: 'Core',
  account_type: 'Standard',
  account_status: 'Active',
  locale: 'en',
  onboarding_complete: true,
};

const MOCK_ECHO = {
  echo_id: '00000000-0000-0000-0000-000000000010',
  name: 'Luna',
  persona_text: 'A curious marine biologist',
  what_if_prompt: 'What if I lived in an underwater city?',
  status: 'Active',
  current_mood: 'Curious',
  current_tick: 42,
  current_shard_id: '00000000-0000-0000-0000-000000000020',
  age_at_creation: 28,
};

// Wire-shape (narrower) for /shards/{id}/echoes — matches the canonical
// `ShardEchoSummary` Specta type. Distinct from MOCK_ECHO's `EchoResponse`
// shape which carries persona/what_if/birth_hash/etc. that the
// /shards/{id}/echoes server route does NOT return.
const MOCK_SHARD_ECHO_SUMMARY = {
  echo_id: '00000000-0000-0000-0000-000000000010',
  name: 'Luna',
  status: 'Active',
  current_mood: 'Curious',
  current_location_id: '00000000-0000-0000-0000-000000000030',
  current_tick: 42,
};

const MOCK_SHARD = {
  shard_id: '00000000-0000-0000-0000-000000000020',
  name: 'Cyber-Tokyo 2045',
  shard_type: 'Public',
  status: 'Active',
  current_active_count: 5,
  max_active_echoes: 50,
};

const MOCK_TOKENS = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
};

/** Set up mock API routes for authenticated flows. */
export async function setupMockApi(page: Page) {
  // Auth
  await page.route('**/auth/register', (route) =>
    route.fulfill({ status: 200, json: { ...MOCK_USER, ...MOCK_TOKENS } }),
  );
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 200, json: { ...MOCK_USER, ...MOCK_TOKENS } }),
  );
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ status: 200, json: MOCK_TOKENS }),
  );
  await page.route('**/auth/logout', (route) =>
    route.fulfill({ status: 200, json: { message: 'Logged out successfully' } }),
  );

  // Account
  await page.route('**/account/me', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: MOCK_USER });
    }
    return route.fulfill({ status: 200, json: MOCK_USER });
  });
  await page.route('**/account/me/privacy', (route) =>
    route.fulfill({ status: 200, json: { solo_mode: false } }),
  );
  await page.route('**/account/me/sessions', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/account/me/export', (route) =>
    route.fulfill({
      status: 200,
      json: {
        export_id: 'export-001',
        status: 'Processing',
        format: 'text',
        created_at: new Date().toISOString(),
      },
    }),
  );
  await page.route('**/account/me/export/*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        export_id: 'export-001',
        status: 'Processing',
        format: 'text',
        created_at: new Date().toISOString(),
      },
    }),
  );
  await page.route('**/account/me/discord', (route) =>
    route.fulfill({ status: 200, json: { linked: false } }),
  );
  await page.route('**/account/me/password', (route) =>
    route.fulfill({ status: 200, json: { message: 'Password updated' } }),
  );

  // Echoes
  await page.route('**/echoes', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: MOCK_ECHO });
    }
    return route.fulfill({ status: 200, json: [MOCK_ECHO] });
  });
  await page.route('**/echoes/*/relationships', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/echoes/*/memories', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/echoes/*/influence', (route) =>
    route.fulfill({ status: 200, json: { balance: 3, daily_limit: 5 } }),
  );
  await page.route('**/echoes/*/conversations', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          conversation_id: 'conv-001',
          echo_id: MOCK_ECHO.echo_id,
          created_at: new Date().toISOString(),
        },
      });
    }
    return route.fulfill({ status: 200, json: [] });
  });

  // Conversations
  await page.route('**/conversations/*/messages', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        json: {
          message_id: 'msg-002',
          role: 'echo',
          content: 'The ocean currents have been particularly strong today near the coral formations.',
          created_at: new Date().toISOString(),
        },
      });
    }
    return route.fulfill({ status: 200, json: [] });
  });
  await page.route('**/conversations/*/save', (route) =>
    route.fulfill({ status: 200, json: { diary_id: 'diary-saved' } }),
  );

  // Shards
  await page.route('**/shards', (route) =>
    route.fulfill({ status: 200, json: [MOCK_SHARD] }),
  );
  await page.route('**/shards/*/echoes', (route) =>
    route.fulfill({ status: 200, json: [MOCK_SHARD_ECHO_SUMMARY] }),
  );

  // Feeds
  await page.route('**/feeds/personal', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [
          {
            item_id: 'feed-001',
            item_type: 'diary_entry',
            echo_id: MOCK_ECHO.echo_id,
            shard_id: MOCK_SHARD.shard_id,
            title: 'Coral reef',
            body: 'Today I explored a beautiful coral reef near the underwater city.',
            significance: 80,
            tick_id: 42,
            created_at: new Date().toISOString(),
            is_public: true,
          },
        ],
        next_cursor: null,
      },
    }),
  );
  await page.route('**/feeds/social', (route) =>
    route.fulfill({ status: 200, json: { data: [], next_cursor: null } }),
  );

  // Notifications
  await page.route('**/account/me/notifications', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/account/me/notifications/preferences', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user_id: MOCK_USER.user_id,
        echo_life_events: 'Off',
        daily_digest: 'Off',
        social: 'Off',
        community: 'Off',
        shard_activity: 'Off',
        platform: 'Off',
        marketplace: 'Off',
        billing: 'Off',
        moderation: 'Off',
        account: 'Off',
        quiet_hours_start: null,
        quiet_hours_end: null,
        updated_at: '2026-04-30T00:00:00Z',
      },
    }),
  );

  // Oracle
  await page.route('**/oracle/ask', (route) =>
    route.fulfill({
      status: 200,
      json: {
        response:
          'Luna is feeling curious because she just discovered an unusual species near the thermal vents in the underwater city.',
        deep_links: [],
      },
    }),
  );

  // Search
  await page.route('**/search/**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [
          {
            item_type: 'diary',
            item_id: 'sr-001',
            echo_id: MOCK_ECHO.echo_id,
            snippet: 'Explored a beautiful coral reef near the underwater city.',
            created_at: new Date().toISOString(),
          },
        ],
        next_cursor: null,
      },
    }),
  );

  // API Keys
  await page.route('**/account/me/api-keys', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: { key_id: 'key-001', key: 'me_live_abc123xyz', name: 'Test Key', created_at: new Date().toISOString() },
      });
    }
    return route.fulfill({ status: 200, json: [] });
  });
  await page.route('**/account/me/api-keys/*', (route) =>
    route.fulfill({ status: 200, json: { revoked: true } }),
  );

  // Reports
  await page.route('**/reports', (route) =>
    route.fulfill({ status: 201, json: { report_id: 'rpt-001' } }),
  );

  // Admin
  await page.route('**/admin/**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        health: {
          tick_number: 1042,
          tick_duration_ms: 850,
          ram_usage_mb: 512,
          vram_usage_mb: 2048,
          active_echoes: 24,
          hibernated_echoes: 156,
          total_users: 50,
          total_shards: 3,
        },
        alerts: [],
        reports: [
          {
            report_id: 'rpt-001',
            reporter_id: MOCK_USER.user_id,
            target_type: 'Echo',
            target_id: MOCK_ECHO.echo_id,
            reason: 'Inappropriate content',
            priority: 'P2',
            status: 'Open',
            created_at: new Date().toISOString(),
            sla_deadline: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
        users: [],
        shards: [],
      },
    }),
  );

  // Channels
  await page.route('**/channels', (route) =>
    route.fulfill({
      status: 200,
      json: [
        { channel_id: 'ch-001', name: 'general', channel_type: 'Global' },
        { channel_id: 'ch-002', name: 'feedback', channel_type: 'Global' },
      ],
    }),
  );
  await page.route('**/channels/*/messages', (route) =>
    route.fulfill({ status: 200, json: { data: [], next_cursor: null } }),
  );

  // Health
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, json: { status: 'ok' } }),
  );

  // System
  await page.route('**/system/**', (route) =>
    route.fulfill({ status: 200, json: { status: 'running', tick_number: 1042 } }),
  );

  // ME-UXF-001 §8.5 — Marketplace.
  //
  // Stateful in-memory catalog + inventory keyed per `Page` so each
  // test sees an isolated marketplace world. The catalog is seeded
  // with three items per category so the tab tests can assert non-
  // empty grids; the inventory starts empty and grows on purchase.
  // `equip` flips the row's `equipped` flag and auto-unequips any
  // sibling already equipped in the same category — mirroring the
  // server-side rule the real `marketplace.equip` invariant
  // documents in `crates/api/src/routes/marketplace.rs`.
  type MockItem = {
    item_id: string;
    name: string;
    description: string;
    item_type: 'EchoSkin' | 'ShardTheme' | 'DiaryStyle' | 'Badge';
    category:
      | 'DashboardTheme'
      | 'PortraitStyle'
      | 'ExportTemplate'
      | 'ShardAesthetic'
      | 'ScenarioPack'
      | 'SeasonalCosmetic'
      | 'SoundPack';
    rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
    price_tier_required: 'Free' | 'Starter' | 'Core' | 'Creator' | 'GodMode';
    price_coins: number;
    image_url: string | null;
    is_available: boolean;
    is_limited_time: boolean;
    available_until: string | null;
    creator_id: string | null;
    created_at: string;
  };
  type MockInvRow = {
    inventory_id: string;
    item_id: string;
    acquired_at: string;
    equipped: boolean;
    price_paid_coins: number;
    item: MockItem | null;
  };
  const CATEGORIES: MockItem['category'][] = [
    'DashboardTheme',
    'PortraitStyle',
    'ExportTemplate',
    'ShardAesthetic',
    'ScenarioPack',
    'SeasonalCosmetic',
    'SoundPack',
  ];
  const catalog: MockItem[] = [];
  for (const cat of CATEGORIES) {
    for (let i = 0; i < 3; i++) {
      const idx = catalog.length + 1;
      catalog.push({
        item_id: `item-${cat}-${i}`,
        name: `${cat} Item ${i}`,
        description: `Mock item ${idx}`,
        item_type: 'EchoSkin',
        category: cat,
        rarity: 'Common',
        price_tier_required: i === 2 ? 'Creator' : 'Free',
        price_coins: 100 * (i + 1),
        image_url: null,
        is_available: true,
        is_limited_time: false,
        available_until: null,
        creator_id: null,
        created_at: '2026-04-01T00:00:00Z',
      });
    }
  }
  const inventory: MockInvRow[] = [];

  // Glob matching note: Playwright's glob does NOT strip the query
  // string before matching, so `**/marketplace/items` only matches the
  // bare path. The endpoints helper appends `?category=...` for
  // category-filtered requests, so we register a companion glob that
  // captures the query-string variant (`?` is a single-char wildcard
  // in playwright glob; `**` after it captures the rest).
  const respondMarketplaceItems = (
    route: import('@playwright/test').Route,
  ) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const category = url.searchParams.get('category');
    const filtered = category
      ? catalog.filter((i) => i.category === category)
      : catalog;
    return route.fulfill({
      status: 200,
      json: { data: filtered, next_cursor: null },
    });
  };
  await page.route('**/marketplace/items', respondMarketplaceItems);
  await page.route('**/marketplace/items?**', respondMarketplaceItems);
  await page.route('**/marketplace/items/*/preview', (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/');
    const itemId = segments[segments.length - 2]!;
    // 1×1 transparent PNG data URL — gives the modal-content div
    // non-zero rendered dimensions so playwright's `toBeVisible()`
    // assertion can resolve.
    return route.fulfill({
      status: 200,
      json: {
        item_id: itemId,
        preview_image_url:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
        preview_demo_url: null,
      },
    });
  });
  await page.route('**/marketplace/purchase', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() ?? '{}');
    const item = catalog.find((i) => i.item_id === body.item_id);
    if (!item) {
      return route.fulfill({ status: 404, json: { error: 'item not found' } });
    }
    const row: MockInvRow = {
      inventory_id: `inv-${item.item_id}`,
      item_id: item.item_id,
      acquired_at: new Date().toISOString(),
      equipped: false,
      price_paid_coins: item.price_coins,
      item,
    };
    const idx = inventory.findIndex((r) => r.item_id === item.item_id);
    if (idx >= 0) inventory[idx] = row;
    else inventory.unshift(row);
    return route.fulfill({ status: 200, json: row });
  });
  const respondInventory = (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      json: { data: inventory, next_cursor: null },
    });
  };
  await page.route('**/marketplace/inventory', respondInventory);
  await page.route('**/marketplace/inventory?**', respondInventory);
  await page.route('**/marketplace/inventory/*/equip', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/');
    const itemId = segments[segments.length - 2]!;
    const body = JSON.parse(route.request().postData() ?? '{}');
    const targetRow = inventory.find((r) => r.item_id === itemId);
    if (!targetRow) {
      return route.fulfill({ status: 404, json: { error: 'not in inventory' } });
    }
    if (body.equipped === true && targetRow.item) {
      const cat = targetRow.item.category;
      for (const r of inventory) {
        if (r.item_id !== itemId && r.item?.category === cat) {
          r.equipped = false;
        }
      }
    }
    targetRow.equipped = !!body.equipped;
    return route.fulfill({ status: 200, json: targetRow });
  });

  // ME-UXF-001 §8.2 — Public user profile.
  // The handler maps `?visibility=` → server visibility for the three
  // a11y test scenarios; ignored otherwise (tests not interested in
  // gating just call /users/<id> with no query string).
  await page.route('**/users/*/echoes-in-common', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/users/*/echoes', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/users/*', (route) => {
    // The SPA route `/users/{user_id}` (UserProfilePage) shares its
    // pathname with the API endpoint of the same shape. Document
    // navigations must pass through to the Vite dev server's
    // history-fallback (which serves the SPA shell); only XHR/fetch
    // calls from the mounted page should be intercepted here. Without
    // this guard, `page.goto('/users/{id}')` would render the mock
    // JSON body in the browser as plain text — the SPA never mounts,
    // and every selector on the page fails.
    if (route.request().resourceType() === 'document') {
      return route.fallback();
    }
    const url = new URL(route.request().url());
    const visibility = url.searchParams.get('visibility') ?? 'Public';
    const isMutual =
      url.searchParams.get('mutual') === 'true' || visibility === 'Public';
    return route.fulfill({
      status: 200,
      json: {
        user_id: '22222222-2222-2222-2222-222222222222',
        display_name: 'A11y Bob',
        bio: visibility === 'Public' ? 'Profile bio.' : null,
        avatar_url: null,
        profile_visibility: visibility,
        account_type: 'Standard',
        subscription_tier: 'Free',
        created_at: '2026-01-01T00:00:00Z',
        mutual_follow: isMutual,
        is_founding_echo: false,
      },
    });
  });

  // ME-UXF-001 §8.2 — viewer-scoped relationship lookups.
  await page.route('**/social/following', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/social/blocked', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route('**/social/muted', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  // Action endpoints — answer happily so optimistic UI doesn't revert
  // mid-test.
  await page.route('**/social/follow/*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        relationship_id: 'r1',
        source_user_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: '22222222-2222-2222-2222-222222222222',
        relationship_type: 'Follow',
        created_at: new Date().toISOString(),
      },
    }),
  );
  await page.route('**/social/block/*', (route) =>
    route.fulfill({ status: 200, json: { status: 'removed' } }),
  );
  await page.route('**/social/mute/*', (route) =>
    route.fulfill({ status: 200, json: { status: 'removed' } }),
  );

  // ── Lane C billing-health surfaces (Lane C Commit 7d E2E) ──────────
  // /me/billing-health — self-service summary. Default returns `null`
  // phase + Active stripe so BillingBanner unmounts.
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({
      status: 200,
      json: {
        crypto_states: [],
        stripe_status: 'active',
        upcoming_renewal: null,
        in_grace_period: false,
        grace_period_ends_at: null,
      },
    }),
  );
  // /admin/billing/dunning-states — empty paginated envelope.
  await page.route('**/admin/billing/dunning-states*', (route) =>
    route.fulfill({
      status: 200,
      json: { items: [], total: 0, limit: 50, offset: 0 },
    }),
  );
  // /admin/billing/revenue-snapshots — empty list.
  await page.route('**/admin/billing/revenue-snapshots*', (route) =>
    route.fulfill({
      status: 200,
      json: { items: [], total: 0, limit: 50, offset: 0 },
    }),
  );
  // /admin/billing/dunning-states/{user_id}/{provider}/override — happy path.
  await page.route(
    '**/admin/billing/dunning-states/*/*/override',
    (route) =>
      route.fulfill({
        status: 200,
        json: {
          user_id: '00000000-0000-0000-0000-000000000001',
          provider: 'nowpayments',
          phase: 'active',
          override_reason: 'admin override (test)',
        },
      }),
  );
  // /admin/billing/revenue-snapshots/trigger — happy path: already_exists.
  await page.route('**/admin/billing/revenue-snapshots/trigger', (route) =>
    route.fulfill({
      status: 200,
      json: { outcome: 'already_exists', period_start: '2026-04-29T00:00:00Z' },
    }),
  );
  // /admin/billing/dunning-pass-reports — empty buffer.
  await page.route('**/admin/billing/dunning-pass-reports', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  // /admin/billing/notification-dead-letters — empty queue.
  await page.route('**/admin/billing/notification-dead-letters', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: [] });
    }
    return route.fulfill({ status: 200, json: [] });
  });
  // /admin/billing/notification-dead-letters/{user_id}/{kind}/{period_anchor}/redrive — happy path.
  await page.route(
    '**/admin/billing/notification-dead-letters/*/*/*/redrive',
    (route) =>
      route.fulfill({ status: 200, json: { outcome: 'redriven_success' } }),
  );

  // Vite asset bypass — registered LAST so per LIFO ordering it is
  // checked FIRST. Any URL inside Vite's served-from-source surfaces
  // (`/src/...`, `/@vite/...`, `/@id/...`, `/@fs/...`, `/node_modules/...`)
  // forwards directly to the dev server. Without this guard, broader
  // glob patterns above (e.g. `**/admin/**`, intended for API routes
  // like `/admin/users`) silently swallow Vite-served TS modules whose
  // paths happen to contain the same segment (e.g.
  // `/src/components/admin/billing/X.tsx`), returning JSON for what
  // the browser parses as a JS module — the script-tag fails its MIME
  // check, the SPA never mounts, and tests run against an empty
  // `<div id="root">`. The previously-shipped axe-core suite under
  // `e2e/accessibility/` was silently passing against blank pages
  // because an empty body has zero a11y violations; the new
  // data-testid-keyed suites Lane E Commit 7 introduces surfaced the
  // load failure through their selector assertions, leading to this
  // sibling-fix per Rule #14 in the same edit surface. Note: the Lane
  // C billing-mock additions immediately above are registered BEFORE
  // these bypass routes so the bypass remains the last-registered
  // (and therefore first-checked per LIFO) route handler set.
  await page.route('**/src/**', (route) => route.continue());
  await page.route('**/@vite/**', (route) => route.continue());
  await page.route('**/@id/**', (route) => route.continue());
  await page.route('**/@fs/**', (route) => route.continue());
  await page.route('**/node_modules/**', (route) => route.continue());
}

/** Simulate an authenticated session by setting localStorage tokens. */
export async function authenticateUser(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('access_token', 'mock-access-token');
    localStorage.setItem('refresh_token', 'mock-refresh-token');
    localStorage.setItem('locale', 'en');
    localStorage.setItem('theme', 'dark');
  });
}

/** Set the user as admin in localStorage. */
export async function authenticateAdmin(page: Page) {
  await authenticateUser(page);
  await page.evaluate(() => {
    localStorage.setItem('account_type', 'Admin');
  });
}

export { MOCK_USER, MOCK_ECHO, MOCK_SHARD };
