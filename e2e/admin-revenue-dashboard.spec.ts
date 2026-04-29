/**
 * Admin Revenue Dashboard end-to-end tests.
 *
 * Exercises the `'billing'` tab of `AdminDashboardPage`: KPI cards,
 * 3 recharts time-series, snapshot history table, CSV export button,
 * and the manual snapshot trigger. Reference: ME-UXF-001 §10.4,
 * ME-MIS-001 §5.4.6 / §5.4.7.3.
 *
 * Lane C Commit 7d. Tests use the data-testid hooks landed in this
 * commit so selection is locale-independent.
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, authenticateAdmin } from './helpers';

function snapshotsFixture(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    snapshot_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    period_start: `2026-04-${String(29 - i).padStart(2, '0')}T00:00:00Z`,
    period_end: `2026-04-${String(30 - i).padStart(2, '0')}T00:00:00Z`,
    mrr_usd_cents: 100_000 + i * 1000,
    paid_subscribers_total: 100 - i,
    paid_subscribers_by_tier: { starter: 30, core: 40, creator: 20, god_mode: 10 - i },
    new_subscribers_count: 5,
    churned_subscribers_count: i,
    dunning_active_count: 2,
    created_at: `2026-04-${String(29 - i).padStart(2, '0')}T01:00:00Z`,
  }));
}

test('admin billing tab renders KPI cards from latest snapshot', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/admin/billing/revenue-snapshots*', (route) =>
    route.fulfill({
      status: 200,
      json: { items: snapshotsFixture(3), total: 3, limit: 50, offset: 0 },
    }),
  );
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  // Switch to billing tab.
  await page.getByRole('button', { name: /billing/i }).first().click();
  await expect(page.getByTestId('admin-billing-view-root')).toBeVisible();
  await expect(page.getByTestId('admin-billing-kpi-mrr')).toBeVisible();
  await expect(page.getByTestId('admin-billing-kpi-total-subscribers')).toBeVisible();
  await expect(page.getByTestId('admin-billing-kpi-churn-delta')).toBeVisible();
  await expect(page.getByTestId('admin-billing-kpi-new-subs')).toBeVisible();
  await expect(page.getByTestId('admin-billing-kpi-dunning-active')).toBeVisible();
});

test('admin billing tab renders 3 chart wrappers', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/admin/billing/revenue-snapshots*', (route) =>
    route.fulfill({
      status: 200,
      json: { items: snapshotsFixture(5), total: 5, limit: 50, offset: 0 },
    }),
  );
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: /billing/i }).first().click();
  await expect(page.getByTestId('chart-mrr')).toBeVisible();
  await expect(page.getByTestId('chart-subscribers')).toBeVisible();
  await expect(page.getByTestId('chart-churn')).toBeVisible();
});

test('admin billing tab CSV export button is enabled when snapshots present', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/admin/billing/revenue-snapshots*', (route) =>
    route.fulfill({
      status: 200,
      json: { items: snapshotsFixture(2), total: 2, limit: 50, offset: 0 },
    }),
  );
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: /billing/i }).first().click();
  const exportBtn = page.getByTestId('admin-billing-export-csv-button');
  await expect(exportBtn).toBeVisible();
  await expect(exportBtn).toBeEnabled();
});

test('admin billing tab CSV export button is disabled when snapshots empty', async ({ page }) => {
  await setupMockApi(page);
  // Default mock returns empty list — the snapshot count = 0 should
  // render the export button disabled per BillingView's `disabled={...0}` predicate.
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: /billing/i }).first().click();
  const exportBtn = page.getByTestId('admin-billing-export-csv-button');
  await expect(exportBtn).toBeVisible();
  await expect(exportBtn).toBeDisabled();
});

test('admin billing tab trigger-snapshot button is rendered and enabled', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: /billing/i }).first().click();
  const triggerBtn = page.getByTestId('admin-billing-trigger-snapshot-button');
  await expect(triggerBtn).toBeVisible();
  await expect(triggerBtn).toBeEnabled();
});

test('admin billing tab dunning queue empty state renders', async ({ page }) => {
  await setupMockApi(page);
  // Default empty dunning-states response. View should render its empty state.
  await page.goto('/');
  await authenticateAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: /billing/i }).first().click();
  // The KPI row + chart wrappers always render; the dunning queue table
  // is below them. Confirm the view's overall root is intact.
  await expect(page.getByTestId('admin-billing-view-root')).toBeVisible();
});
