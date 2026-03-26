/**
 * Monetization analytics instrumentation — ME-UXF-001 §16.6.
 * Pre-wired for when Stripe integration is built.
 * These functions are imported by purchase/subscription flows.
 */

import { trackEvent } from './analytics.ts';

export function trackSubscriptionUpgraded(fromTier: string, toTier: string) {
  trackEvent('subscription.upgraded', { from_tier: fromTier, to_tier: toTier });
}

export function trackSubscriptionDowngraded(fromTier: string, toTier: string) {
  trackEvent('subscription.downgraded', { from_tier: fromTier, to_tier: toTier });
}

export function trackSubscriptionCancelled(tier: string) {
  trackEvent('subscription.cancelled', { tier });
}

export function trackSubscriptionPaymentFailed(tier: string) {
  trackEvent('subscription.payment_failed', { tier });
}

export function trackMarketplaceItemViewed(itemId: string, category: string) {
  trackEvent('marketplace.item_viewed', { item_id: itemId, category });
}

export function trackMarketplaceItemPurchased(itemId: string, category: string) {
  trackEvent('marketplace.item_purchased', { item_id: itemId, category });
}

export function trackMarketplaceBrowse(categoryFilter?: string) {
  trackEvent('marketplace.browse', { category_filter: categoryFilter });
}
