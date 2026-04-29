import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Live-suite specs target a real backend at echolabsme.com via the
  // separate `playwright.live.config.ts` (its own globalSetup creates
  // a beta-invite + test account). The default config does NOT have a
  // backend running, so the live globalSetup's state file is missing
  // here and every live spec fails on the first preconditions check.
  // Excluding the directory keeps the default suite runnable without
  // network credentials.
  testIgnore: ['**/live/**'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      testDir: './e2e/accessibility',
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
