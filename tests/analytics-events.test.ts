import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 6D Audit Remediation — Task C Tests
 *
 * Verifies analytics event instrumentation across client pages.
 * Tests that trackEvent() is called with correct event names and properties.
 */

// Mock the analytics module
const mockTrackEvent = vi.fn();
vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  setAnalyticsOptOut: vi.fn(),
}));

beforeEach(() => {
  mockTrackEvent.mockClear();
});

describe('Analytics Event Instrumentation — ME-UXF-001 §16', () => {
  describe('§16.1 Account & Auth events', () => {
    it('account.registered event exists in RegisterPage', async () => {
      const mod = await import('../src/pages/RegisterPage.tsx');
      expect(mod).toBeDefined();
      // Verify trackEvent import is used in the module
      const source = await import('../src/pages/RegisterPage.tsx?raw');
      expect(source.default).toContain("trackEvent('account.registered'");
    });

    it('account.login event exists in LoginPage', async () => {
      const source = await import('../src/pages/LoginPage.tsx?raw');
      expect(source.default).toContain("trackEvent('account.login'");
    });

    it('account.password_changed event exists in SettingsPage', async () => {
      const source = await import('../src/pages/SettingsPage.tsx?raw');
      expect(source.default).toContain("trackEvent('account.password_changed'");
    });

    it('account.deletion_initiated event exists in DeleteAccountPage', async () => {
      const source = await import('../src/pages/DeleteAccountPage.tsx?raw');
      expect(source.default).toContain("trackEvent('account.deletion_initiated'");
    });

    it('account.deletion_cancelled event exists in SettingsPage', async () => {
      const source = await import('../src/pages/SettingsPage.tsx?raw');
      expect(source.default).toContain("trackEvent('account.deletion_cancelled'");
    });

    it('account.locale_changed event exists in LanguageSelectionPage', async () => {
      const source = await import('../src/pages/LanguageSelectionPage.tsx?raw');
      expect(source.default).toContain("trackEvent('account.locale_changed'");
    });
  });

  describe('§16.2 Echo events', () => {
    it('echo.created event exists in EchoCreationPage', async () => {
      const source = await import('../src/pages/EchoCreationPage.tsx?raw');
      expect(source.default).toContain("trackEvent('echo.created'");
    });

    // NOTE: 'echo.persona_edited' and 'echo.renamed' assertions deleted
    // per ME-UXF-001 §16.2 v1.1 amendment. Product decision: Echo
    // persona_text and name are IMMUTABLE after creation (birth_hash
    // integrity). There is no edit-path, so no edit-event. The two
    // tests previously here were the last client-side fossils of the
    // old editable-persona spec — removed together with the spec rows.

    it('echo.hibernated event exists in EchoDetailPage', async () => {
      const source = await import('../src/pages/EchoDetailPage.tsx?raw');
      expect(source.default).toContain("trackEvent('echo.hibernated'");
    });

    it('echo.woken event exists in EchoDetailPage', async () => {
      const source = await import('../src/pages/EchoDetailPage.tsx?raw');
      expect(source.default).toContain("trackEvent('echo.woken'");
    });

    it('echo.travel_initiated event exists in ShardViewPage', async () => {
      const source = await import('../src/pages/ShardViewPage.tsx?raw');
      expect(source.default).toContain("trackEvent('echo.travel_initiated'");
    });

    it('echo.travel_completed event exists in EchoDetailPage WS handler', async () => {
      const source = await import('../src/pages/EchoDetailPage.tsx?raw');
      expect(source.default).toContain("trackEvent('echo.travel_completed'");
    });
  });

  describe('§16.3 Content Consumption events', () => {
    it('diary.viewed event exists in EchoDetailPage', async () => {
      const source = await import('../src/pages/EchoDetailPage.tsx?raw');
      expect(source.default).toContain("trackEvent('diary.viewed'");
    });

    it('feed.viewed event exists in PersonalFeedPage', async () => {
      const source = await import('../src/pages/PersonalFeedPage.tsx?raw');
      expect(source.default).toContain("trackEvent('feed.viewed'");
    });

    it('feed.viewed event exists in SocialFeedPage', async () => {
      const source = await import('../src/pages/SocialFeedPage.tsx?raw');
      expect(source.default).toContain("trackEvent('feed.viewed'");
    });

    it('feed.scrolled event exists in PersonalFeedPage', async () => {
      const source = await import('../src/pages/PersonalFeedPage.tsx?raw');
      expect(source.default).toContain("trackEvent('feed.scrolled'");
    });

    it('notification.clicked event exists in NotificationsPage', async () => {
      const source = await import('../src/pages/NotificationsPage.tsx?raw');
      expect(source.default).toContain("trackEvent('notification.clicked'");
    });

    it('notification.dismissed event exists in NotificationsPage', async () => {
      const source = await import('../src/pages/NotificationsPage.tsx?raw');
      expect(source.default).toContain("trackEvent('notification.dismissed'");
    });
  });

  describe('§16.4 Social events', () => {
    it('conversation.started event exists in EchoConversationPage', async () => {
      const source = await import('../src/pages/EchoConversationPage.tsx?raw');
      expect(source.default).toContain("trackEvent('conversation.started'");
    });

    it('conversation.message_sent event exists in EchoConversationPage', async () => {
      const source = await import('../src/pages/EchoConversationPage.tsx?raw');
      expect(source.default).toContain("trackEvent('conversation.message_sent'");
    });

    it('community.message_sent event exists in CommunityPage', async () => {
      const source = await import('../src/pages/CommunityPage.tsx?raw');
      expect(source.default).toContain("trackEvent('community.message_sent'");
    });

    it('community.channel_joined event exists in CommunityPage', async () => {
      const source = await import('../src/pages/CommunityPage.tsx?raw');
      expect(source.default).toContain("trackEvent('community.channel_joined'");
    });

    it('search.performed event exists in SearchPage', async () => {
      const source = await import('../src/pages/SearchPage.tsx?raw');
      expect(source.default).toContain("trackEvent('search.performed'");
    });

    it('search.result_clicked event exists in SearchPage', async () => {
      const source = await import('../src/pages/SearchPage.tsx?raw');
      expect(source.default).toContain("trackEvent('search.result_clicked'");
    });
  });

  describe('§16.5 Navigation events', () => {
    it('page.viewed event exists in AppLayout', async () => {
      const source = await import('../src/components/AppLayout.tsx?raw');
      expect(source.default).toContain("trackEvent('page.viewed'");
    });

    it('onboarding.step_completed event exists in OnboardingWelcomePage', async () => {
      const source = await import('../src/pages/OnboardingWelcomePage.tsx?raw');
      expect(source.default).toContain("trackEvent('onboarding.step_completed'");
    });

    it('onboarding.completed event exists in OnboardingProfilePage', async () => {
      const source = await import('../src/pages/OnboardingProfilePage.tsx?raw');
      expect(source.default).toContain("trackEvent('onboarding.completed'");
    });
  });

  describe('§16.6 Monetization events (pre-wired)', () => {
    it('all monetization tracking functions are exported from analytics-monetization', async () => {
      const mod = await import('../src/lib/analytics-monetization.ts');
      expect(typeof mod.trackSubscriptionUpgraded).toBe('function');
      expect(typeof mod.trackSubscriptionDowngraded).toBe('function');
      expect(typeof mod.trackSubscriptionCancelled).toBe('function');
      expect(typeof mod.trackSubscriptionPaymentFailed).toBe('function');
      expect(typeof mod.trackMarketplaceItemViewed).toBe('function');
      expect(typeof mod.trackMarketplaceItemPurchased).toBe('function');
      expect(typeof mod.trackMarketplaceBrowse).toBe('function');
    });

    it('trackSubscriptionUpgraded calls trackEvent with correct name', async () => {
      const { trackSubscriptionUpgraded } = await import('../src/lib/analytics-monetization.ts');
      trackSubscriptionUpgraded('Free', 'Core');
      expect(mockTrackEvent).toHaveBeenCalledWith('subscription.upgraded', {
        from_tier: 'Free',
        to_tier: 'Core',
      });
    });

    it('trackMarketplaceBrowse calls trackEvent with correct name', async () => {
      const { trackMarketplaceBrowse } = await import('../src/lib/analytics-monetization.ts');
      trackMarketplaceBrowse('themes');
      expect(mockTrackEvent).toHaveBeenCalledWith('marketplace.browse', {
        category_filter: 'themes',
      });
    });
  });
});
