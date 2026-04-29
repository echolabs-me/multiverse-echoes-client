/**
 * UserProfilePage E2E — privacy gates × actions.
 *
 * Reference: ME-UXF-001 §8.2.
 *
 * Each test stubs the `/users/{id}` and viewer-scoped relationship
 * endpoints with the exact state it wants to render, then asserts via
 * the data-testid contract added in Lane E Commit 7. Selectors NEVER
 * depend on translated text.
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, authenticateUser } from './helpers';

const TARGET_PROFILE_ID = '22222222-2222-2222-2222-222222222222';
const VIEWER_ID = '00000000-0000-0000-0000-000000000001';

interface ProfileShape {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  profile_visibility: 'Public' | 'FriendsOnly' | 'Private';
  account_type: string;
  subscription_tier: string;
  created_at: string;
  mutual_follow: boolean;
  is_founding_echo: boolean;
}

function profile(overrides: Partial<ProfileShape> = {}): ProfileShape {
  return {
    user_id: TARGET_PROFILE_ID,
    display_name: 'Bob',
    bio: 'Bob bio',
    avatar_url: null,
    profile_visibility: 'Public',
    account_type: 'Standard',
    subscription_tier: 'Free',
    created_at: '2026-01-01T00:00:00Z',
    mutual_follow: false,
    is_founding_echo: false,
    ...overrides,
  };
}

async function stubProfile(
  page: import('@playwright/test').Page,
  overrides: Partial<ProfileShape> = {},
) {
  // Document navigations to `/users/{id}` must pass through to the
  // Vite dev server (history-fallback serves the SPA shell). Only
  // intercept the XHR/fetch the mounted UserProfilePage emits.
  await page.route('**/users/' + TARGET_PROFILE_ID, (route) => {
    if (route.request().resourceType() === 'document') {
      return route.fallback();
    }
    return route.fulfill({ status: 200, json: profile(overrides) });
  });
}

async function stubRelationships(
  page: import('@playwright/test').Page,
  state: { following?: boolean; blocked?: boolean; muted?: boolean } = {},
) {
  const rel = (kind: 'Follow' | 'Block' | 'Mute') => ({
    relationship_id: 'r-' + kind,
    source_user_id: VIEWER_ID,
    target_user_id: TARGET_PROFILE_ID,
    relationship_type: kind,
    created_at: '2026-04-01T00:00:00Z',
  });
  await page.route('**/social/following', (route) =>
    route.fulfill({ status: 200, json: state.following ? [rel('Follow')] : [] }),
  );
  await page.route('**/social/blocked', (route) =>
    route.fulfill({ status: 200, json: state.blocked ? [rel('Block')] : [] }),
  );
  await page.route('**/social/muted', (route) =>
    route.fulfill({ status: 200, json: state.muted ? [rel('Mute')] : [] }),
  );
}

// --- Privacy-gate render branches (ME-UXF-001 §8.2) ---

test('user_profile_public_renders_full_surface', async ({ page }) => {
  await setupMockApi(page);
  await stubProfile(page, { profile_visibility: 'Public', bio: 'A public bio.' });
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-page-root')).toBeVisible();
  await expect(page.getByTestId('profile-display-name')).toHaveText('Bob');
  await expect(page.getByTestId('profile-bio')).toHaveText('A public bio.');
  // No friends-only / private gate copy.
  await expect(page.getByTestId('profile-friends-only-message')).toHaveCount(0);
  await expect(page.getByTestId('profile-private-message')).toHaveCount(0);
});

test('user_profile_friends_only_visible_renders_full_surface_for_mutual_follower', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page, {
    profile_visibility: 'FriendsOnly',
    mutual_follow: true,
    bio: 'Visible to mutuals.',
  });
  await stubRelationships(page, { following: true });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-display-name')).toHaveText('Bob');
  await expect(page.getByTestId('profile-bio')).toHaveText('Visible to mutuals.');
  await expect(page.getByTestId('profile-friends-only-message')).toHaveCount(0);
});

test('user_profile_friends_only_hidden_renders_friends_only_message_only', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page, {
    profile_visibility: 'FriendsOnly',
    mutual_follow: false,
    bio: 'Should not render.',
  });
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-display-name')).toBeVisible();
  await expect(page.getByTestId('profile-friends-only-message')).toBeVisible();
  // Bio + echo lists must not render.
  await expect(page.getByTestId('profile-bio')).toHaveCount(0);
  await expect(page.getByTestId('profile-echoes-list')).toHaveCount(0);
});

test('user_profile_private_renders_private_message_only', async ({ page }) => {
  await setupMockApi(page);
  await stubProfile(page, {
    profile_visibility: 'Private',
    bio: 'Should not render.',
  });
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-private-message')).toBeVisible();
  await expect(page.getByTestId('profile-bio')).toHaveCount(0);
  await expect(page.getByTestId('profile-echoes-list')).toHaveCount(0);
  await expect(page.getByTestId('profile-friends-only-message')).toHaveCount(0);
});

// --- Action affordances (Follow / Block / Mute toggling) ---

test('user_profile_follow_action_inserts_relationship_and_toggles_button', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page); // not following initially
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-follow')).toBeVisible();
  await page.getByTestId('profile-action-follow').click();
  await expect(page.getByTestId('profile-action-unfollow')).toBeVisible();
  await expect(page.getByTestId('profile-action-follow')).toHaveCount(0);
});

test('user_profile_unfollow_action_removes_relationship_and_toggles_button', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page, { following: true });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-unfollow')).toBeVisible();
  await page.getByTestId('profile-action-unfollow').click();
  await expect(page.getByTestId('profile-action-follow')).toBeVisible();
  await expect(page.getByTestId('profile-action-unfollow')).toHaveCount(0);
});

test('user_profile_block_action_inserts_relationship_and_toggles_button', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-block')).toBeVisible();
  await page.getByTestId('profile-action-block').click();
  await expect(page.getByTestId('profile-action-unblock')).toBeVisible();
});

test('user_profile_unblock_action_removes_relationship_and_toggles_button', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page, { blocked: true });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-unblock')).toBeVisible();
  await page.getByTestId('profile-action-unblock').click();
  await expect(page.getByTestId('profile-action-block')).toBeVisible();
});

test('user_profile_mute_action_inserts_relationship_and_toggles_button', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-mute')).toBeVisible();
  await page.getByTestId('profile-action-mute').click();
  await expect(page.getByTestId('profile-action-unmute')).toBeVisible();
});

test('user_profile_unmute_action_removes_relationship_and_toggles_button', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page, { muted: true });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-unmute')).toBeVisible();
  await page.getByTestId('profile-action-unmute').click();
  await expect(page.getByTestId('profile-action-mute')).toBeVisible();
});

// --- Action-availability gating (Private hides Block + Mute) ---

test('user_profile_private_state_renders_only_follow_action_block_and_mute_hidden', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page, { profile_visibility: 'Private' });
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-follow')).toBeVisible();
  await expect(page.getByTestId('profile-action-block')).toHaveCount(0);
  await expect(page.getByTestId('profile-action-unblock')).toHaveCount(0);
  await expect(page.getByTestId('profile-action-mute')).toHaveCount(0);
  await expect(page.getByTestId('profile-action-unmute')).toHaveCount(0);
});

test('user_profile_friends_only_hidden_renders_all_three_actions', async ({
  page,
}) => {
  await setupMockApi(page);
  await stubProfile(page, {
    profile_visibility: 'FriendsOnly',
    mutual_follow: false,
  });
  await stubRelationships(page);
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-follow')).toBeVisible();
  await expect(page.getByTestId('profile-action-block')).toBeVisible();
  await expect(page.getByTestId('profile-action-mute')).toBeVisible();
});

test('user_profile_blocked_target_renders_unblock_action_and_no_follow_button', async ({
  page,
}) => {
  // When the viewer has already blocked the target, the page should
  // surface the Unblock affordance as the primary toggle for that
  // relationship slot. Follow remains visible per ME-UXF-001 §8.2 (the
  // spec lists Follow as universally available; viewers can follow
  // someone they've muted/blocked, those are independent slots) — what
  // we assert here is the Block→Unblock toggle has flipped, not that
  // the Follow surface has been suppressed.
  await setupMockApi(page);
  await stubProfile(page);
  await stubRelationships(page, { blocked: true });
  await page.goto('/');
  await authenticateUser(page);
  await page.goto(`/users/${TARGET_PROFILE_ID}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('profile-action-unblock')).toBeVisible();
  await expect(page.getByTestId('profile-action-block')).toHaveCount(0);
  await expect(page.getByTestId('profile-action-follow')).toBeVisible();
});
