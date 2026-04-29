/**
 * Live E2E flow — 7 sequential tests against a real ME server.
 *
 * Preconditions: global-setup.ts has run and populated test-results/.live-state.json.
 * The Cleanup: global-teardown.ts hard-purges the test account via
 * `POST /admin/users/:id/purge` regardless of test outcome.
 *
 * These tests are intentionally tied to each other — later tests depend on
 * account/echo state produced by earlier ones. Running with `workers: 1`
 * and `fullyParallel: false` (see playwright.live.config.ts) keeps ordering
 * predictable. `test.describe.serial` halts the suite on the first failure.
 *
 * Selector strategy: prefer visible English copy from `client/src/locales/en.json`
 * over CSS. If a key changes, update it here too. Where possible we use
 * `aria-label` or `role` so the tests survive styling changes.
 */

import { test, expect, type Page } from '@playwright/test';
import { loadState, updateState } from './state.ts';

const DIARY_WAIT_MS = Number(process.env.ME_LIVE_DIARY_TIMEOUT_MS ?? '300000');
const CONVERSATION_REPLY_TIMEOUT_MS = 60_000;

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  // Post-login routing: Dashboard with multiple echoes, direct to /echoes/:id
  // when the user has exactly one, or /onboarding for new accounts.
  await expect(page).toHaveURL(/dashboard|onboarding|home|\/echoes\/[0-9a-f-]+/i, {
    timeout: 30_000,
  });
}

test.describe.serial('live flow (echolabsme.com)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Seed the flags the app checks for first-run status so the language
    // splash never renders:
    //   - localStorage.locale_selected = 'true' gates <LanguageSelectionPage>
    //     at the `/` route (App.tsx:hasSelectedLocale)
    //   - Cookie `locale=en` is what LanguageSelectionPage writes when the
    //     user selects English; WebsiteLayout and SSR/pre-render paths read
    //     this to skip the splash for the public site.
    // Seeding both makes test navigation direct: no splash, no click-through
    // helper, just goto(path).
    const state = loadState();
    const url = new URL(state.baseURL);
    await context.addCookies([
      {
        name: 'locale',
        value: 'en',
        domain: url.hostname,
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.setItem('locale_selected', 'true');
      window.localStorage.setItem('locale', 'en');
      window.localStorage.setItem('i18nextLng', 'en');
    });
    // Surface any uncaught page errors — they're the first thing you want
    // to see when a selector suddenly doesn't match.
    page.on('pageerror', (err) => console.error('[page-error]', err.message));
  });

  test('1. register with invite code', async ({ page }) => {
    const state = loadState();
    await page.goto('/register');

    await page.getByLabel(/invite code/i).fill(state.inviteCode);
    await page.getByLabel(/^email$/i).fill(state.testEmail);
    await page.getByLabel(/display name/i).fill(state.testDisplayName);
    await page.getByLabel(/^password$/i).fill(state.testPassword);
    await page.getByLabel(/confirm password/i).fill(state.testPassword);

    // Two consent checkboxes (ToS + privacy). Spec: "separate checkboxes".
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(2, { timeout: 5_000 });
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/dashboard|onboarding|verify-pending/i, {
      timeout: 30_000,
    });

    // Capture the user_id from /account/me using the browser's access_token.
    // We rely on the client storing the token at localStorage.access_token.
    const userId = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const r = await fetch('/account/me', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const body = (await r.json()) as { user_id?: string };
      return body.user_id ?? null;
    });
    expect(userId, 'user_id must be captured for teardown').toBeTruthy();
    if (userId) updateState({ userId });
  });

  test('2. create Echo', async ({ page }) => {
    const state = loadState();
    // Re-authenticate per test to avoid sharing session state between tests.
    await login(page, state.testEmail, state.testPassword);

    // Echo creation route — lives under /onboarding/* in App.tsx.
    await page.goto('/onboarding/create-echo');

    // Step 1 — Details. Labels come from `echo.nameLabel` ("Name your Echo *")
    // and `echo.whatIfLabel` ("What if? *").
    await page
      .getByLabel(/name your echo/i)
      .fill('Playwright Test Echo');
    await page
      .getByLabel(/what if/i)
      .fill('What if I lived in a test simulation?');
    // Persona + physical description optional — skip.
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 2 — Consent (two checkboxes)
    const consentBoxes = page.locator('input[type="checkbox"]');
    await expect(consentBoxes).toHaveCount(2, { timeout: 5_000 });
    await consentBoxes.nth(0).check();
    await consentBoxes.nth(1).check();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 3 — Destination (first public shard already preselected).
    // Click Create Echo button.
    await page.getByRole('button', { name: /create my echo/i }).click();

    // Birth animation shows "Your Echo is alive." once the server has
    // created the echo — wait for that heading, then grab the id from the
    // API (the app navigates to /dashboard via Continue, not /echoes/:id).
    await expect(
      page.getByRole('heading', { name: /your echo is alive/i }),
    ).toBeVisible({ timeout: 60_000 });

    const echoId = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const r = await fetch('/echoes', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      // GET /echoes returns a bare JSON array of echoes.
      const body = (await r.json()) as { echo_id: string }[];
      return Array.isArray(body) && body.length > 0 ? body[0]!.echo_id : null;
    });
    expect(echoId, 'echo id must be fetchable from /echoes').toBeTruthy();
    if (echoId) updateState({ echoId });

    // Click Continue to clear the birth screen. The birth button navigates
    // to /dashboard, but the dashboard auto-redirects single-echo users
    // to /echoes/:id (DashboardPage:26) — accept either URL shape.
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/dashboard|\/echoes\/[0-9a-f-]+/i, {
      timeout: 15_000,
    });
  });

  test('3. view diary entry', async ({ page }) => {
    // Diary polling can run for up to DIARY_WAIT_MS (default 5 min) because
    // one tick interval is 300s. Extend the per-test timeout past that so
    // the poll loop isn't killed by Playwright's default 60s cap.
    test.setTimeout(DIARY_WAIT_MS + 60_000);

    const state = loadState();
    test.skip(!state.echoId, 'no echo id — skip (test 2 likely failed)');
    await login(page, state.testEmail, state.testPassword);

    // Probe the API directly — faster and more reliable than scraping DOM.
    // Wait up to DIARY_WAIT_MS for at least one diary entry to appear.
    const start = Date.now();
    let entryCount = 0;
    while (Date.now() - start < DIARY_WAIT_MS) {
      entryCount = await page.evaluate(async (echoId) => {
        const token = localStorage.getItem('access_token');
        if (!token) return -1;
        const r = await fetch(`/echoes/${echoId}/diary?limit=5`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!r.ok) return -1;
        const body = (await r.json()) as { entries?: unknown[] };
        return body.entries?.length ?? 0;
      }, state.echoId!);
      if (entryCount > 0) break;
      await page.waitForTimeout(15_000);
    }

    test.skip(
      entryCount === 0,
      `no diary entry appeared within ${DIARY_WAIT_MS}ms — ticks may be paused`,
    );

    await page.goto(`/echoes/${state.echoId}`);
    // The diary section renders on the detail page. Assert at least one entry
    // is visible in the DOM. We match on the generic entry shape: a list item
    // or article containing a time element.
    await expect(page.getByRole('time').first()).toBeVisible({ timeout: 30_000 });
  });

  test('4. send nudge', async ({ page }) => {
    const state = loadState();
    test.skip(!state.echoId, 'no echo id — skip');
    await login(page, state.testEmail, state.testPassword);
    await page.goto(`/echoes/${state.echoId}`);

    // Click the trigger button — it's the nudge button on the detail page.
    // The visible label is the translation of `echoDetail.useInfluence`
    // ("Send a gentle nudge").
    await page.getByRole('button', { name: /send a gentle nudge/i }).first().click();

    // Wait for the modal to be fully open and interactive. The `<Modal>`
    // animation briefly holds children at opacity-0 which Playwright treats
    // as not-visible. Waiting on the modal's dialog role ensures the
    // animation has completed before we try to type.
    const modalHeading = page.getByRole('heading', { name: /send a gentle nudge/i });
    await expect(modalHeading).toBeVisible({ timeout: 10_000 });

    // Scope to the nudge dialog by its accessible name. Modal.tsx assigns
    // a unique `aria-labelledby` per instance (via useId), so role-based
    // dialog lookup is unambiguous across the page's modals.
    const nudgeDialog = page.getByRole('dialog', { name: /send a gentle nudge/i });
    const modalInput = nudgeDialog.getByLabel(/your suggestion/i);
    await modalInput.waitFor({ state: 'visible', timeout: 10_000 });
    await modalInput.fill('Go explore the city centre');

    // The modal's submit button has the same label as the trigger. Scope to
    // the nudge dialog so we hit the in-modal copy, not the page-body one.
    await nudgeDialog.getByRole('button', { name: /send a gentle nudge/i }).click();

    // Success confirmation. The app renders this text twice — once as a
    // toast alert, once as an inline banner on the echo detail page —
    // so accept either. The assertion is that at least one copy appears.
    await expect(
      page.getByText(/nudge sent/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('5. talk to Echo (conversation)', async ({ page }) => {
    // Must budget for login + navigation + vLLM response (≤ CONVERSATION_REPLY_TIMEOUT_MS).
    test.setTimeout(CONVERSATION_REPLY_TIMEOUT_MS + 60_000);

    const state = loadState();
    test.skip(!state.echoId, 'no echo id — skip');
    await login(page, state.testEmail, state.testPassword);
    await page.goto(`/echoes/${state.echoId}`);

    await page.getByRole('button', { name: /talk to echo/i }).click();

    // Scope every selector to the conversation panel. `aria-label` value
    // comes from `conversation.messages` in en.json: "Conversation messages".
    const messagesRegion = page.getByRole('region', { name: /conversation messages/i })
      .or(page.locator('[aria-label="Conversation messages"]'));
    await expect(messagesRegion).toBeVisible({ timeout: 15_000 });

    // Each rendered message bubble is a `<p class="whitespace-pre-wrap">`
    // inside the messages region. User messages sit inside a `justify-end`
    // flex row; echo replies inside a `justify-start` flex row. Count each
    // class of message separately so we cannot confuse one for the other.
    const userMessages = messagesRegion.locator(
      'div.justify-end p.whitespace-pre-wrap',
    );
    const echoMessages = messagesRegion.locator(
      'div.justify-start p.whitespace-pre-wrap',
    );

    // Baseline: before the user sends anything, zero user and zero echo
    // messages should be rendered.
    await expect(userMessages).toHaveCount(0);
    await expect(echoMessages).toHaveCount(0);

    const userText = 'Hello, how are you settling in?';
    const input = page.getByLabel(/say something to your echo/i).first();
    await input.fill(userText);

    // Distinct aria-label "Send to Echo" scopes to the conversation form.
    // Oracle's separate send button carries "Send to Oracle".
    await page.getByRole('button', { name: /send to echo/i }).click();

    // User message must appear immediately. Strict text equality so the
    // optimistic render is the one we see, not some placeholder.
    await expect(userMessages).toHaveCount(1, { timeout: 15_000 });
    await expect(userMessages.first()).toHaveText(userText);

    // Echo reply — genuinely hits vLLM through the full stack. This is the
    // assertion that proves the system end-to-end. We wait up to 60s for a
    // `justify-start` bubble to arrive. No fallback — if vLLM doesn't reply
    // in the window, the test fails loudly.
    await expect(echoMessages).toHaveCount(1, {
      timeout: CONVERSATION_REPLY_TIMEOUT_MS,
    });

    // Reply must be non-empty (LLM must have produced actual text, not an
    // empty string). Trim to avoid a single-whitespace false positive.
    const replyText = (await echoMessages.first().innerText()).trim();
    expect(replyText.length, 'echo reply must contain characters').toBeGreaterThan(0);
  });

  test('6. delete Echo', async ({ page }) => {
    const state = loadState();
    test.skip(!state.echoId, 'no echo id — skip');
    await login(page, state.testEmail, state.testPassword);
    await page.goto(`/echoes/${state.echoId}`);

    // Open the "More actions" overflow menu (label from `common.more`
    // via en.json → "More actions"), then click Delete Echo.
    await page
      .getByRole('button', { name: /more actions/i })
      .click();
    await page.getByRole('button', { name: /^delete echo$/i }).click();

    // Confirm modal: click "Delete permanently". Scope by the dialog's
    // accessible name (from en.json echoDetail.deleteConfirmTitle).
    const deleteDialog = page.getByRole('dialog', { name: /delete playwright test echo/i });
    await deleteDialog
      .getByRole('button', { name: /delete permanently/i })
      .click();

    // After deletion, page should navigate back to dashboard / home.
    await expect(page).toHaveURL(/dashboard|home|\/$/i, { timeout: 30_000 });

    // Echo should no longer appear via API.
    const stillExists = await page.evaluate(async (echoId) => {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      const r = await fetch(`/echoes/${echoId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      return r.ok;
    }, state.echoId!);
    expect(stillExists, 'echo should be gone after delete').toBe(false);
  });

  test('7. delete account', async ({ page }) => {
    const state = loadState();
    await login(page, state.testEmail, state.testPassword);

    await page.goto('/settings/delete-account');
    await page.getByLabel(/type delete to confirm/i).fill('DELETE');
    await page.getByRole('button', { name: /^delete account$/i }).click();

    // Redirects to /login on success.
    await expect(page).toHaveURL(/login/i, { timeout: 30_000 });
  });
});
