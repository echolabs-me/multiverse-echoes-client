/**
 * Live E2E global teardown.
 *
 * Hard-purges the test user via `POST /admin/users/:id/purge` so the account
 * does not linger in PendingDeletion for 30 days. If the `userId` was never
 * captured (registration failed), we skip the purge but still clean the
 * state file.
 *
 * This runs regardless of test outcome. Uses fetch (not the Playwright
 * browser) because we only need HTTP, not a page.
 */

import { setDefaultResultOrder } from 'node:dns';
import { existsSync, unlinkSync } from 'node:fs';
import { loadState, statePath } from './state.ts';

// Same opt-in escape hatch as global-setup. Kept in sync so both phases use
// the same resolver order when this flag is set.
if (process.env.ME_LIVE_DNS_IPV6_FIRST === '1') {
  setDefaultResultOrder('ipv6first');
}

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(statePath())) {
    console.log('[live-teardown] no state file — nothing to clean');
    return;
  }
  const state = loadState();
  try {
    if (state.userId) {
      // Disambiguate endpoint-not-deployed (404 because the route is missing)
      // from user-genuinely-gone (404 because the user row was deleted). A
      // GET /admin/users/:id that succeeds before a purge 404 means the
      // purge route itself isn't on the running binary.
      const probe = await fetch(
        `${state.baseURL}/admin/users/${state.userId}`,
        { headers: { authorization: `Bearer ${state.adminToken}` } },
      );
      const userExists = probe.ok;

      const resp = await fetch(
        `${state.baseURL}/admin/users/${state.userId}/purge`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${state.adminToken}` },
        },
      );
      if (resp.ok) {
        const body = (await resp.json()) as { echoes_deleted?: number };
        console.log(
          `[live-teardown] purged test user (echoes=${body.echoes_deleted ?? '?'})`,
        );
      } else if (resp.status === 404 && !userExists) {
        console.log('[live-teardown] user already gone (404) — OK');
      } else if (resp.status === 404 && userExists) {
        console.error(
          `[live-teardown] PURGE ENDPOINT MISSING on deployed binary.`,
        );
        console.error(
          `[live-teardown] user ${state.userId} (${state.testEmail}) STILL EXISTS on server.`,
        );
        console.error(
          `[live-teardown] Deploy the new binary with the /admin/users/:id/purge route, then run cleanup.`,
        );
      } else {
        const text = await resp.text();
        console.error(
          `[live-teardown] PURGE FAILED: HTTP ${resp.status} ${text}`,
        );
        console.error(
          `[live-teardown] manual cleanup required for user ${state.userId}`,
        );
      }
    } else {
      console.log('[live-teardown] no user id captured — skipping purge');
    }
  } finally {
    try {
      unlinkSync(statePath());
    } catch {
      /* ignore */
    }
  }
}
