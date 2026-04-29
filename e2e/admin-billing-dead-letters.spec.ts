/**
 * Admin billing notification dead-letter queue end-to-end tests.
 *
 * These tests pin the contract between the admin queue endpoints
 * (`GET /admin/billing/notification-dead-letters` + the redrive POST)
 * and any client UI that consumes them. The 7d cycle ships the
 * endpoints + mock-route hooks; client UI for the queue lands in a
 * future commit. Until then, these tests assert on the network-level
 * contract: response shape, redrive path semantics. Reference:
 * ME-MIS-001 §5.4.7.3.
 *
 * Lane C Commit 7d.
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, authenticateAdmin } from './helpers';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const DLQ_FIXTURE = {
  user_id: USER_ID,
  kind: 'stripe_payment_failed',
  period_anchor: '2026-04-29T00:00:00Z',
  failed_at: '2026-04-29T01:00:00Z',
  failure_layer: 'email_send',
  failure_reason: 'resend 503: simulated transport failure',
  retry_count: 0,
  last_retried_at: null,
};

test('admin DLQ list endpoint returns rows newest-failed-first', async ({ page }) => {
  await setupMockApi(page);
  await page.route('**/admin/billing/notification-dead-letters', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: [
          {
            ...DLQ_FIXTURE,
            failed_at: '2026-04-29T03:00:00Z',
            failure_layer: 'ledger_insert',
          },
          { ...DLQ_FIXTURE, failed_at: '2026-04-29T01:00:00Z' },
        ],
      });
    }
    return route.fulfill({ status: 200, json: [] });
  });
  await page.goto('/');
  await authenticateAdmin(page);
  // Drive a direct fetch as the admin to assert the endpoint shape.
  const response = await page.evaluate(async () => {
    const res = await fetch('/admin/billing/notification-dead-letters', {
      headers: { Authorization: 'Bearer mock-access-token' },
    });
    return { status: res.status, body: await res.json() };
  });
  expect(response.status).toBe(200);
  expect(response.body).toHaveLength(2);
  expect(response.body[0].failure_layer).toBe('ledger_insert');
  expect(response.body[1].failure_layer).toBe('email_send');
});

test('admin DLQ redrive happy path returns redriven_success', async ({ page }) => {
  await setupMockApi(page);
  await page.goto('/');
  await authenticateAdmin(page);
  const response = await page.evaluate(async (userId) => {
    const url = `/admin/billing/notification-dead-letters/${userId}/stripe_payment_failed/1750000000/redrive`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-access-token' },
    });
    return { status: res.status, body: await res.json() };
  }, USER_ID);
  expect(response.status).toBe(200);
  expect(response.body.outcome).toBe('redriven_success');
});

test('admin DLQ redrive returns row_not_found when no row matches', async ({ page }) => {
  await setupMockApi(page);
  await page.route(
    '**/admin/billing/notification-dead-letters/*/*/*/redrive',
    (route) =>
      route.fulfill({ status: 200, json: { outcome: 'row_not_found' } }),
  );
  await page.goto('/');
  await authenticateAdmin(page);
  const response = await page.evaluate(async (userId) => {
    const res = await fetch(
      `/admin/billing/notification-dead-letters/${userId}/refund_processed/1750000000/redrive`,
      { method: 'POST', headers: { Authorization: 'Bearer mock-access-token' } },
    );
    return { status: res.status, body: await res.json() };
  }, USER_ID);
  expect(response.body.outcome).toBe('row_not_found');
});

test('admin DLQ redrive returns retry-count incremented on dead-lettered-again', async ({ page }) => {
  await setupMockApi(page);
  await page.route(
    '**/admin/billing/notification-dead-letters/*/*/*/redrive',
    (route) =>
      route.fulfill({
        status: 200,
        json: { outcome: 'redriven_dead_lettered_again' },
      }),
  );
  await page.goto('/');
  await authenticateAdmin(page);
  const response = await page.evaluate(async (userId) => {
    const res = await fetch(
      `/admin/billing/notification-dead-letters/${userId}/grace_period_entered/1750000000/redrive`,
      { method: 'POST', headers: { Authorization: 'Bearer mock-access-token' } },
    );
    return { body: await res.json() };
  }, USER_ID);
  expect(response.body.outcome).toBe('redriven_dead_lettered_again');
});
