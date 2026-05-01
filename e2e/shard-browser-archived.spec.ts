/**
 * ShardBrowserPage archived-card render path E2E.
 *
 * Closes the test-coverage gap surfaced during Lane MOCK_SHARD-cleanup
 * Phase 1: ShardBrowserPage gates the archive chip + Badge variant flip
 * on `isShardArchived(shard) === true`
 * (i.e. `provisioning_type === 'Archived'`), but no e2e fixture
 * exercised the archived branch until now. Pairs with the canonical
 * 15-field MOCK_SHARD + MOCK_SHARD_ARCHIVED fixtures in helpers.ts and
 * the data-testid + data-archived selector hooks added in
 * ShardBrowserPage.tsx.
 *
 * Reference: ME-MIS-001 §5.2 Surface B (archived Shard card chip);
 * client/src/lib/hibernation.ts::isShardArchived.
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, authenticateUser } from './helpers';

const ACTIVE_SHARD_ID = '00000000-0000-0000-0000-000000000020';
const ARCHIVED_SHARD_ID = '00000000-0000-0000-0000-000000000021';

test('archived shard card renders chip + Badge data-archived="true"; active card does not', async ({
  page,
}) => {
  await setupMockApi(page, { shards: 'both' });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto('/shards/browse');
  await page.waitForLoadState('networkidle');

  const activeCard = page.locator(`[data-shard-id="${ACTIVE_SHARD_ID}"]`);
  const archivedCard = page.locator(`[data-shard-id="${ARCHIVED_SHARD_ID}"]`);

  // Both cards render.
  await expect(activeCard).toBeVisible();
  await expect(archivedCard).toBeVisible();

  // Archived card: chip with data-testid="shard-archive-chip" is visible.
  // The chip is gated on `archived && archiveDeletion`; both must hold.
  // (Switched from a `getByRole('status').filter({ hasText: 'Deletes' })`
  // selector — the 'Deletes' fragment is the English translation of
  // `t('tiers.deletion.shardDeletesOn', ...)` and would silently fail
  // the locator if the test runner locale ever changed. Copilot review
  // on PR #53 flagged the locale coupling.)
  await expect(
    archivedCard.getByTestId('shard-archive-chip'),
  ).toBeVisible();

  // Archived card: Badge data-archived flag flipped on.
  await expect(
    archivedCard.locator('[data-testid="shard-status-badge"]'),
  ).toHaveAttribute('data-archived', 'true');

  // Active card: chip is absent (gating proof — without
  // `provisioning_type === 'Archived'`, isShardArchived returns false
  // and the chip <p> is not rendered).
  await expect(
    activeCard.getByTestId('shard-archive-chip'),
  ).toHaveCount(0);

  // Active card: Badge data-archived flag flipped off.
  await expect(
    activeCard.locator('[data-testid="shard-status-badge"]'),
  ).toHaveAttribute('data-archived', 'false');
});
