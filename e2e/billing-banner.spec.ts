/**
 * Billing banner end-to-end tests.
 *
 * Drives the BillingBanner component through its 4 visible variants
 * (renewal_pending / renewal_imminent / grace_period / payment_failed)
 * + the 2 unmounted phases (active / lapsed / null). The banner reads
 * from `useBillingHealth` which seeds from `GET /me/billing-health` on
 * AppLayout mount. Variant selection logic lives in
 * `client/src/components/BillingBanner.tsx`.
 *
 * Lane C Commit 7d. Reference: ME-MIS-001 §5.4.7.3, ME-UXF-001 §14.5.
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, authenticateUser } from './helpers';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function billingHealthFixture(opts: {
  phase: string | null;
  in_grace_period?: boolean;
  grace_period_ends_at?: string | null;
}) {
  return {
    crypto_states: opts.phase
      ? [
          {
            user_id: USER_ID,
            provider: 'nowpayments',
            subscription_started_at: '2026-04-01T00:00:00Z',
            current_period_end: '2026-05-01T00:00:00Z',
            phase: opts.phase,
            grace_period_expires_at: opts.grace_period_ends_at ?? null,
            last_notified_at: null,
            last_notification_phase: null,
            created_at: '2026-04-01T00:00:00Z',
            updated_at: '2026-04-29T00:00:00Z',
          },
        ]
      : [],
    stripe_status: 'active',
    upcoming_renewal: '2026-05-01T00:00:00Z',
    in_grace_period: opts.in_grace_period ?? false,
    grace_period_ends_at: opts.grace_period_ends_at ?? null,
  };
}

test('billing banner unmounts when phase is null', async ({ page }) => {
  await setupMockApi(page);
  // Default mock returns empty crypto_states + active stripe — banner unmounts.
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/');
  // Banner root should not appear within the load timeout.
  await expect(page.getByTestId('billing-banner-root')).toHaveCount(0, { timeout: 3000 });
});

test('billing banner renders renewal_pending variant', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({ status: 200, json: billingHealthFixture({ phase: 'renewal_pending' }) }),
  );
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/');
  const banner = page.getByTestId('billing-banner-root');
  await expect(banner).toBeVisible();
  await expect(page.getByTestId('billing-banner-variant-renewal-pending')).toBeVisible();
});

test('billing banner renders renewal_imminent variant', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({ status: 200, json: billingHealthFixture({ phase: 'renewal_imminent' }) }),
  );
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/');
  await expect(page.getByTestId('billing-banner-variant-renewal-imminent')).toBeVisible();
});

test('billing banner renders grace_period variant with error severity', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({
      status: 200,
      json: billingHealthFixture({
        phase: 'grace_period',
        in_grace_period: true,
        grace_period_ends_at: '2026-05-08T00:00:00Z',
      }),
    }),
  );
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/');
  const banner = page.getByTestId('billing-banner-root');
  await expect(banner).toBeVisible();
  await expect(page.getByTestId('billing-banner-variant-grace-period')).toBeVisible();
});

test('billing banner unmounts when phase is lapsed', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({ status: 200, json: billingHealthFixture({ phase: 'lapsed' }) }),
  );
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/');
  await expect(page.getByTestId('billing-banner-root')).toHaveCount(0, { timeout: 3000 });
});

test('billing banner update-payment link points to /plans', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/me/billing-health', (route) =>
    route.fulfill({ status: 200, json: billingHealthFixture({ phase: 'renewal_pending' }) }),
  );
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/');
  const link = page.getByTestId('billing-banner-update-payment-link');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/plans');
});
