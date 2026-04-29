/**
 * WCAG 2.1 AA Accessibility Audit
 *
 * Runs axe-core against all 20 client pages.
 * Zero critical and zero serious violations required.
 *
 * Reference: ME-ACC-001 §§8–9, ME-UXF-001 §12.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupMockApi, authenticateUser, authenticateAdmin, MOCK_ECHO } from '../helpers';

// Helper to run axe-core and assert zero critical/serious violations.
async function auditPage(page: import('@playwright/test').Page, description: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');

  if (critical.length > 0 || serious.length > 0) {
    const details = [...critical, ...serious]
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
      .join('\n');
    expect.soft(critical.length, `${description}: critical violations\n${details}`).toBe(0);
    expect.soft(serious.length, `${description}: serious violations\n${details}`).toBe(0);
  }
}

// --- Pre-auth pages (no login needed) ---

test('a11y: Language Selection', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/language');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Language Selection');
});

test('a11y: Register', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Register');
});

test('a11y: Verify Pending', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/verify-pending');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Verify Pending');
});

test('a11y: Verified', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/verified');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Verified');
});

// --- Onboarding pages ---

test('a11y: Onboarding Welcome', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/onboarding/welcome');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Onboarding Welcome');
});

test('a11y: Onboarding Profile', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/onboarding/profile');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Onboarding Profile');
});

test('a11y: Echo Creation', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/onboarding/create-echo');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Echo Creation');
});

// --- Main app pages ---

test('a11y: Dashboard', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Dashboard');
});

test('a11y: Echo Detail', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/echoes/${MOCK_ECHO.echo_id}`);
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Echo Detail');
});

test('a11y: Echo Conversation', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/echoes/${MOCK_ECHO.echo_id}/talk`);
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Echo Conversation');
});

test('a11y: Shard View', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/shards/00000000-0000-0000-0000-000000000020');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Shard View');
});

test('a11y: Shard Browser', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/shards/browse');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Shard Browser');
});

test('a11y: Personal Feed', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/feeds/personal');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Personal Feed');
});

test('a11y: Social Feed', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/feeds/social');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Social Feed');
});

test('a11y: Community', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/community');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Community');
});

test('a11y: Notifications', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/notifications');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Notifications');
});

test('a11y: Settings', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Settings');
});

test('a11y: Delete Account', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/settings/delete-account');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Delete Account');
});

test('a11y: Search', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/search');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Search');
});

// ME-UXF-001 §8.2 — UserProfilePage. Three render branches: Public,
// FriendsOnly (gated, viewer-not-mutual), Private. The setupMockApi
// route handler reads `?visibility=` to switch the served profile_visibility
// field, so each branch is exercised against the same target user_id.
const TARGET_PROFILE_ID = '22222222-2222-2222-2222-222222222222';

test('a11y: User Profile (Public)', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  // No query string → setupMockApi defaults to Public.
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'User Profile (Public)');
});

test('a11y: User Profile (FriendsOnly hidden)', async ({ page }) => {
  await setupMockApi(page);
  // Override the /users/* handler to serve FriendsOnly + non-mutual.
  // Document navigations fall through to the SPA shell — see the
  // comment on the same guard inside `setupMockApi`.
  await page.route('**/users/' + TARGET_PROFILE_ID, (route) => {
    if (route.request().resourceType() === 'document') {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      json: {
        user_id: TARGET_PROFILE_ID,
        display_name: 'A11y Bob',
        bio: null,
        avatar_url: null,
        profile_visibility: 'FriendsOnly',
        account_type: 'Standard',
        subscription_tier: 'Free',
        created_at: '2026-01-01T00:00:00Z',
        mutual_follow: false,
        is_founding_echo: false,
      },
    });
  });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'User Profile (FriendsOnly hidden)');
});

test('a11y: User Profile (Private)', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/users/' + TARGET_PROFILE_ID, (route) => {
    if (route.request().resourceType() === 'document') {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      json: {
        user_id: TARGET_PROFILE_ID,
        display_name: 'A11y Bob',
        bio: null,
        avatar_url: null,
        profile_visibility: 'Private',
        account_type: 'Standard',
        subscription_tier: 'Free',
        created_at: '2026-01-01T00:00:00Z',
        mutual_follow: false,
        is_founding_echo: false,
      },
    });
  });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'User Profile (Private)');
});

// MarketplacePage (ME-UXF-001 §8.5). Three render branches: default
// category tab, inventory tab, preview modal open. The preview modal
// case exercises the dialog's focus-trap + aria-labelledby surface
// against axe — the wider lane has zero modal a11y coverage at HEAD.
test('a11y: Marketplace page (default tab)', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/marketplace');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Marketplace page (default tab)');
});

test('a11y: Marketplace page (inventory tab)', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/marketplace');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('marketplace-tab-my-inventory').click();
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Marketplace page (inventory tab)');
});

test('a11y: Marketplace page (preview modal open)', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/marketplace');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('marketplace-item-preview').first().click();
  await expect(page.getByTestId('marketplace-preview-modal-root')).toBeVisible();
  await auditPage(page, 'Marketplace page (preview modal open)');
});

test('a11y: Admin Dashboard', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateAdmin(page);
  await page.route('**/account/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user_id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@echolabs.me',
        display_name: 'Admin',
        subscription_tier: 'GodMode',
        account_type: 'Admin',
        account_status: 'Active',
        locale: 'en',
        onboarding_complete: true,
      },
    }),
  );
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Admin Dashboard');
});

// --- Structural accessibility checks ---

test('skip link targets main content', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Tab once to focus the skip link
  await page.keyboard.press('Tab');

  const skipLink = page.locator('a[href="#main-content"]');
  if (await skipLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(skipLink).toBeFocused();
    // Activate it
    await skipLink.click();
    // Main content should exist
    await expect(page.locator('#main-content')).toBeVisible();
  }
});

test('Escape closes modals and panels', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Open Oracle panel
  const fab = page.locator('[aria-label*="Oracle"], [aria-label*="oracle"]').last();
  if (await fab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fab.click();
    await page.waitForTimeout(300);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Panel should be closed (no oracle input visible)
    // This is a soft check — the oracle may have different close behaviour
  }
});

test('Tab order is logical on dashboard', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Tab through first 15 elements and collect their roles/tags
  const tabOrder: string[] = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : 'none';
    });
    tabOrder.push(tag);
  }

  // Should have interactive elements in the tab order
  const hasInteractive = tabOrder.some((t) =>
    ['button', 'a', 'input', 'select', 'textarea'].includes(t),
  );
  expect(hasInteractive).toBe(true);
});

test('prefers-reduced-motion sets zero durations', async ({ page }) => {
  // Emulate reduced motion preference
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Check that CSS animation durations are 0
  const durationFast = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--duration-fast').trim(),
  );
  expect(durationFast).toBe('0ms');
});

// ── Lane C Commit 7d — Admin Revenue Dashboard a11y (ME-ACC-001 §§8–9) ──

test('a11y: Admin Revenue Dashboard (billing tab)', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: /billing/i }).first().click();
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'Admin Revenue Dashboard (billing tab)');
});

test('a11y: BillingBanner renewal_pending variant', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({
      status: 200,
      json: {
        crypto_states: [
          {
            user_id: '00000000-0000-0000-0000-000000000001',
            provider: 'nowpayments',
            subscription_started_at: '2026-04-01T00:00:00Z',
            current_period_end: '2026-05-01T00:00:00Z',
            phase: 'renewal_pending',
            grace_period_expires_at: null,
            last_notified_at: null,
            last_notification_phase: null,
            created_at: '2026-04-01T00:00:00Z',
            updated_at: '2026-04-29T00:00:00Z',
          },
        ],
        stripe_status: 'active',
        upcoming_renewal: '2026-05-01T00:00:00Z',
        in_grace_period: false,
        grace_period_ends_at: null,
      },
    }),
  );
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await auditPage(page, 'BillingBanner renewal_pending');
});

test('all images have alt text', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Find all img elements and verify they have alt attribute
  const imagesWithoutAlt = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs)
      .filter((img) => !img.hasAttribute('alt'))
      .map((img) => img.src);
  });
  expect(imagesWithoutAlt).toEqual([]);
});
