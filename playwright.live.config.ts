/**
 * Playwright live E2E config.
 *
 * Runs against the production server at echolabsme.com via Cloudflare tunnel.
 * Separate from the existing mocked suite at ./e2e/ — see playwright.config.ts.
 *
 * Tests are sequential by design — Test N depends on account/echo created by
 * Test N-1. Retries are zero so failures are visible, not masked.
 *
 * Prerequisites (env vars):
 *   - ME_ADMIN_EMAIL   — admin user email for /auth/login
 *   - ME_ADMIN_PASSWORD — admin user password
 *
 * Credentials must never be committed. Set them in your shell before running:
 *   npx playwright test --config=playwright.live.config.ts
 */

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.ME_LIVE_BASE_URL ?? 'https://echolabsme.com';

export default defineConfig({
  testDir: './e2e/live',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',

  globalSetup: './e2e/live/global-setup.ts',
  globalTeardown: './e2e/live/global-teardown.ts',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
