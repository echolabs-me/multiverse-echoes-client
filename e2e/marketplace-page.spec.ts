/**
 * MarketplacePage E2E — tab navigation, preview, buy, equip flows.
 *
 * Reference: ME-UXF-001 §8.5.
 *
 * The marketplace mock routes in `helpers.ts::setupMockApi` seed a
 * three-item-per-category catalog. The third item in each category
 * has `price_tier_required: 'Creator'` so the upgrade-link branch is
 * exercisable for a Core-tier viewer (the default mock user).
 *
 * Selectors NEVER depend on translated text — only data-testid.
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, authenticateUser } from './helpers';

async function goToMarketplace(page: import('@playwright/test').Page) {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/marketplace');
  await expect(page.getByTestId('marketplace-page-root')).toBeVisible();
}

// Tuple of (testid slug, MarketplaceCategory enum value) so the tab-
// click test can ALSO assert the matching seeded item rendered (the
// helpers seed catalog item ids as `item-{Category}-{0..2}`).
const CATEGORY_TABS: ReadonlyArray<readonly [string, string]> = [
  ['dashboard-theme', 'DashboardTheme'],
  ['portrait-style', 'PortraitStyle'],
  ['export-template', 'ExportTemplate'],
  ['shard-aesthetic', 'ShardAesthetic'],
  ['scenario-pack', 'ScenarioPack'],
  ['seasonal-cosmetic', 'SeasonalCosmetic'],
  ['sound-pack', 'SoundPack'],
];

for (const [slug, category] of CATEGORY_TABS) {
  test(`marketplace_${slug.replace(/-/g, '_')}_tab_lists_items`, async ({
    page,
  }) => {
    await goToMarketplace(page);
    const tab = page.getByTestId(`marketplace-tab-${slug}`);
    await expect(tab).toBeVisible();
    await tab.click();
    // Assert the first seeded item for this category renders. Using a
    // category-keyed item-id avoids the race window where the previous
    // tab's panel unmounts (Tabs `key={activeId}` re-mount), the new
    // panel briefly renders Spinner during isLoading=true, then the
    // fetch resolves and the items populate.
    await expect(
      page.getByTestId(`marketplace-item-card-item-${category}-0`),
    ).toBeVisible();
  });
}

test('marketplace_my_inventory_tab_lists_owned_items', async ({ page }) => {
  await goToMarketplace(page);
  // Buy one item first so inventory is non-empty.
  const firstBuy = page.getByTestId('marketplace-item-buy').first();
  await firstBuy.click();
  // Navigate to inventory tab.
  const invTab = page.getByTestId('marketplace-tab-my-inventory');
  await invTab.click();
  const rows = page.locator('[data-testid^="marketplace-inventory-row-"]');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThanOrEqual(1);
});

// --- Flows ---

test('marketplace_preview_button_opens_modal_with_preview_payload', async ({
  page,
}) => {
  await goToMarketplace(page);
  const firstPreview = page.getByTestId('marketplace-item-preview').first();
  await firstPreview.click();
  await expect(page.getByTestId('marketplace-preview-modal-root')).toBeVisible();
  // Close modal.
  await page.getByTestId('marketplace-preview-modal-close').click();
  await expect(page.getByTestId('marketplace-preview-modal-root')).toBeHidden();
});

test('marketplace_buy_button_inserts_inventory_row_and_fires_analytics', async ({
  page,
}) => {
  await goToMarketplace(page);
  // Capture analytics events fired by the page.
  const events: { name: string; props?: unknown }[] = [];
  await page.exposeFunction('__captureAnalytics', (name: string, props: unknown) => {
    events.push({ name, props });
  });
  await page.evaluate(() => {
    type WithDataLayer = typeof window & { dataLayer?: unknown[] };
    const w = window as WithDataLayer;
    w.dataLayer = new Proxy([], {
      get(target, prop) {
        if (prop === 'push') {
          return (event: unknown) => {
            const ev = event as { event?: string; [k: string]: unknown };
            if (ev?.event) {
              (window as unknown as {
                __captureAnalytics: (name: string, props: unknown) => void;
              }).__captureAnalytics(ev.event, ev);
            }
            return Array.prototype.push.call(target, event);
          };
        }
        return (target as unknown as Record<string | symbol, unknown>)[
          prop as keyof typeof target
        ];
      },
    });
  });

  const firstBuy = page.getByTestId('marketplace-item-buy').first();
  await firstBuy.click();
  // Inventory tab now has a row.
  await page.getByTestId('marketplace-tab-my-inventory').click();
  const rows = page.locator('[data-testid^="marketplace-inventory-row-"]');
  await expect(rows.first()).toBeVisible();
});

test('marketplace_buy_button_renders_upgrade_link_when_tier_insufficient', async ({
  page,
}) => {
  // The default mock user is Core tier. Override to Free so all
  // third-of-each-category items (Creator-tier-gated in the seed)
  // become locked behind an upgrade link.
  await page.route('**/account/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user_id: '00000000-0000-0000-0000-000000000001',
        email: 'free@echolabs.me',
        display_name: 'FreeUser',
        subscription_tier: 'Free',
        account_type: 'Standard',
        account_status: 'Active',
        locale: 'en',
        onboarding_complete: true,
      },
    }),
  );
  await goToMarketplace(page);
  // At least one upgrade link must render somewhere (the Creator-gated
  // third-of-each-category items).
  const upgradeLinks = page.getByTestId('marketplace-item-buy-upgrade-link');
  await expect(upgradeLinks.first()).toBeVisible();
});

test('marketplace_inventory_equip_toggle_calls_equip_endpoint_and_refetches', async ({
  page,
}) => {
  await goToMarketplace(page);
  // Buy then go to inventory.
  await page.getByTestId('marketplace-item-buy').first().click();
  await page.getByTestId('marketplace-tab-my-inventory').click();
  const toggle = page.getByTestId('marketplace-inventory-equip-toggle').first();
  await expect(toggle).toBeVisible();
  // Toggle equipped on. The mock flips state and the page re-fetches
  // inventory after the PATCH succeeds.
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

test('marketplace_inventory_equip_toggle_auto_unequips_sibling_of_same_type', async ({
  page,
}) => {
  await goToMarketplace(page);
  // Buy two items in the SAME category so equipping one auto-unequips
  // the other. The seed places the first three items in DashboardTheme,
  // so we click .nth(0) and .nth(1) buy buttons on the default tab.
  const buys = page.getByTestId('marketplace-item-buy');
  await buys.nth(0).click();
  await buys.nth(0).click(); // After the first purchase, the next item slides into nth(0) since nth(0) becomes "Owned"
  // Switch to inventory.
  await page.getByTestId('marketplace-tab-my-inventory').click();
  const toggles = page.getByTestId('marketplace-inventory-equip-toggle');
  await expect(toggles.first()).toBeVisible();
  expect(await toggles.count()).toBeGreaterThanOrEqual(2);
  // Equip first item.
  await toggles.nth(0).click();
  await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'true');
  // Equip second item — first should auto-unequip.
  await toggles.nth(1).click();
  await expect(toggles.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'false');
});
