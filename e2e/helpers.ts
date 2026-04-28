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
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 200, json: {} }));

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
    route.fulfill({ status: 200, json: { sessions: [] } }),
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
    route.fulfill({ status: 200, json: {} }),
  );

  // Echoes
  await page.route('**/echoes', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: MOCK_ECHO });
    }
    return route.fulfill({ status: 200, json: { echoes: [MOCK_ECHO] } });
  });
  await page.route('**/echoes/*/relationships', (route) =>
    route.fulfill({ status: 200, json: { relationships: [] } }),
  );
  await page.route('**/echoes/*/memories', (route) =>
    route.fulfill({ status: 200, json: { memories: [] } }),
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
    return route.fulfill({ status: 200, json: { conversations: [] } });
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
    return route.fulfill({ status: 200, json: { messages: [] } });
  });
  await page.route('**/conversations/*/save', (route) =>
    route.fulfill({ status: 200, json: { diary_id: 'diary-saved' } }),
  );

  // Shards
  await page.route('**/shards', (route) =>
    route.fulfill({ status: 200, json: { shards: [MOCK_SHARD] } }),
  );
  await page.route('**/shards/*/echoes', (route) =>
    route.fulfill({ status: 200, json: { echoes: [MOCK_ECHO] } }),
  );

  // Feeds
  await page.route('**/feeds/personal', (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: [
          {
            item_id: 'feed-001',
            echo_id: MOCK_ECHO.echo_id,
            echo_name: 'Luna',
            event_type: 'DiaryEntry',
            content: 'Today I explored a beautiful coral reef near the underwater city.',
            significance: 80,
            created_at: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.route('**/feeds/social', (route) =>
    route.fulfill({ status: 200, json: { items: [] } }),
  );

  // Notifications
  await page.route('**/notifications', (route) =>
    route.fulfill({ status: 200, json: { notifications: [] } }),
  );
  await page.route('**/notifications/preferences', (route) =>
    route.fulfill({ status: 200, json: { preferences: {} } }),
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
        results: [
          {
            result_id: 'sr-001',
            type: 'diary',
            echo_id: MOCK_ECHO.echo_id,
            echo_name: 'Luna',
            snippet: 'Explored a beautiful coral reef near the underwater city.',
            created_at: new Date().toISOString(),
          },
        ],
      },
    }),
  );

  // API Keys
  await page.route('**/keys', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: { key_id: 'key-001', key: 'me_live_abc123xyz', name: 'Test Key', created_at: new Date().toISOString() },
      });
    }
    return route.fulfill({ status: 200, json: { keys: [] } });
  });
  await page.route('**/keys/*', (route) =>
    route.fulfill({ status: 200, json: {} }),
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
      json: {
        channels: [
          { channel_id: 'ch-001', name: 'general', channel_type: 'Global' },
          { channel_id: 'ch-002', name: 'feedback', channel_type: 'Global' },
        ],
      },
    }),
  );
  await page.route('**/channels/*/messages', (route) =>
    route.fulfill({ status: 200, json: { messages: [] } }),
  );

  // Health
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, json: { status: 'ok' } }),
  );

  // System
  await page.route('**/system/**', (route) =>
    route.fulfill({ status: 200, json: { status: 'running', tick_number: 1042 } }),
  );

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
    const url = new URL(route.request().url());
    const visibility =
      url.searchParams.get('visibility') ?? 'Public';
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
