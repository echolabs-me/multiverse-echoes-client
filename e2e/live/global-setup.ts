/**
 * Live E2E global setup.
 *
 * 1. Verifies ME_ADMIN_EMAIL + ME_ADMIN_PASSWORD are set (never reads them
 *    from files — env var only).
 * 2. Logs in as admin to get a JWT.
 * 3. Creates a single-use beta invite code via POST /admin/beta-invites.
 * 4. Generates a unique test email + password + display name.
 * 5. Writes the above to test-results/.live-state.json for the spec and
 *    the global-teardown to read.
 *
 * Fails loudly if any prerequisite is missing. No fallback to hardcoded
 * secrets — if you set up a manual invite instead, set ME_TEST_INVITE_CODE
 * in the env and skip the admin-login step.
 */

import { setDefaultResultOrder } from 'node:dns';
import type { FullConfig } from '@playwright/test';
import { saveState, maskToken, type LiveState } from './state.ts';

// Opt-in IPv6-first resolution for Node's built-in fetch. Only applied when
// ME_LIVE_DNS_IPV6_FIRST=1, since it's an escape hatch for networks where
// IPv4 paths to Cloudflare are unreliable — not something to force by default.
if (process.env.ME_LIVE_DNS_IPV6_FIRST === '1') {
  setDefaultResultOrder('ipv6first');
}

const BASE_URL = process.env.ME_LIVE_BASE_URL ?? 'https://echolabsme.com';

async function loginAdmin(baseURL: string): Promise<string> {
  const email = process.env.ME_ADMIN_EMAIL;
  const password = process.env.ME_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'ME_ADMIN_EMAIL and ME_ADMIN_PASSWORD must be set in the shell ' +
        'environment before running the live suite. They are never read ' +
        'from a file and never committed.',
    );
  }
  const resp = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    throw new Error(`Admin login failed: HTTP ${resp.status}`);
  }
  const body = (await resp.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('Admin login response missing access_token');
  }
  return body.access_token;
}

async function createInvite(baseURL: string, adminToken: string): Promise<string> {
  const existing = process.env.ME_TEST_INVITE_CODE;
  if (existing) {
    console.log(`[live-setup] using pre-provisioned invite from env`);
    return existing;
  }
  const resp = await fetch(`${baseURL}/admin/beta-invites`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ expires_in_days: 1 }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Beta invite creation failed: HTTP ${resp.status} ${text}`);
  }
  const body = (await resp.json()) as { code?: string };
  if (!body.code) {
    throw new Error('Beta invite response missing code');
  }
  return body.code;
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  void _config;
  console.log(`[live-setup] target: ${BASE_URL}`);

  // Fast-fail if the server isn't reachable.
  const health = await fetch(`${BASE_URL}/health`);
  if (!health.ok) {
    throw new Error(`Server health check failed: HTTP ${health.status}`);
  }

  const adminToken = await loginAdmin(BASE_URL);
  console.log(`[live-setup] admin login OK (token: ${maskToken(adminToken)})`);

  const inviteCode = await createInvite(BASE_URL, adminToken);
  console.log(`[live-setup] invite code: ${inviteCode}`);

  const suffix = Date.now();
  const state: LiveState = {
    baseURL: BASE_URL,
    adminToken,
    inviteCode,
    testEmail: `playwright-test-${suffix}@echolabs.me`,
    testPassword: `PWTest-${suffix}-Aa1!`,
    testDisplayName: `PW ${suffix}`,
  };
  saveState(state);
  console.log(`[live-setup] test account: ${state.testEmail}`);
}
