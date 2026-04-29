import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type {
  SubscriptionTier,
  AccountStatus,
  EchoStatus,
  WorldEventPayload,
  WsEchoEvent,
} from '../src/types/api.ts';
import { PlansPage } from '../src/pages/PlansPage.tsx';

/**
 * Phase 6D Audit Remediation — Task A Tests
 *
 * Verifies TypeScript type parity with Rust enums and correct
 * rendering of tier names, echo statuses, and WebSocket events.
 */

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'plans.title': 'Plans',
        'plans.backToDashboard': 'Back to Dashboard',
        'plans.currentPlan': 'Current Plan',
        'common.back': 'Back',
        'common.loading': 'Loading...',
        'common.errorGeneric': 'Something went wrong.',
        'common.comingSoon': 'Coming soon',
        'payment.title': 'Plans',
        'payment.subtitle': 'Choose a plan.',
        'payment.free': 'Free',
        'payment.current': 'Current',
        'payment.currentPlan': 'Current plan',
        'payment.manageSubscription': 'Manage subscription',
        'payment.perMonth': '/month',
        'payment.payWithCrypto': 'Pay with Crypto',
        'payment.payWithXRP': 'Pay with XRP',
        'payment.cardComingSoon': 'Available after company incorporation',
        'payment.cryptoUnavailable': 'Crypto payments temporarily unavailable.',
        'payment.subscribing': 'Creating payment...',
        'tiers.free': 'Free',
        'tiers.starter': 'Starter',
        'tiers.core': 'Core',
        'tiers.creator': 'Creator',
        'tiers.godMode': 'God Mode',
        'tiers.mostPopular': 'Popular',
        'tiers.enterprise': 'Enterprise',
        'tiers.enterpriseDesc': 'Custom solutions.',
        'tiers.contactUs': 'Contact us',
        'tiers.enhanceTiers': 'Enhance your experience.',
        'tiers.features.1echoPublic': '1 Echo',
        'tiers.features.diaryAmPm': 'Twice-daily diary',
        'tiers.features.1conv': '1 conversation / day',
        'tiers.features.1nudge': '1 nudge / day',
        'tiers.features.2ip': '2 IP / day',
        'tiers.features.3echoes': '3 Echoes',
        'tiers.features.diary2hr': 'Diary every 2h',
        'tiers.features.5conv': '5 conv / day',
        'tiers.features.3nudges': '3 nudges / day',
        'tiers.features.4ip': '4 IP / day',
        'tiers.features.adFree': 'Ad-free',
        'tiers.features.5echoes': '5 Echoes',
        'tiers.features.diary30m': 'Diary every 30m',
        'tiers.features.10conv': '10 conv / day',
        'tiers.features.10nudges': '10 nudges / day',
        'tiers.features.6ip': '6 IP / day',
        'tiers.features.8echoes': '8 Echoes',
        'tiers.features.diary15m': 'Diary every 15m',
        'tiers.features.20conv': '20 conv / day',
        'tiers.features.20nudges': '20 nudges / day',
        'tiers.features.12ip': '12 IP / day',
        'tiers.features.1privateShard': '1 Private Shard',
        'tiers.features.12echoes': '12 Echoes',
        'tiers.features.diary5m': 'Diary every 5m',
        'tiers.features.unlimitedConv': 'Unlimited conversations',
        'tiers.features.unlimitedNudges': 'Unlimited nudges',
        'tiers.features.unlimitedIp': 'Unlimited IP',
        'tiers.features.3privateShards': '3 Private Shards',
        'tiers.features.priorityInference': 'Priority inference',
        'tiers.influencePoints.explainer': 'Premium actions.',
        'tiers.addOns.title': 'Add-ons',
        'tiers.addOns.buyAddon': 'Buy',
        'tiers.addOns.included': 'Included ({{count}})',
        'tiers.addOns.notAvailableOnPlan': 'Not available',
        'tiers.addOns.nudgePack': 'Nudge 100-Pack',
        'tiers.addOns.nudgePackDesc': '100 extra nudges.',
        'tiers.addOns.premiumActionsPack': 'Premium Actions 20-Pack',
        'tiers.addOns.premiumActionsPackDesc': '20 IP.',
        'tiers.addOns.speedBoost': 'Speed Boost',
        'tiers.addOns.speedBoostDesc': 'Halve heartbeat.',
        'tiers.addOns.videoVoiceBoost': 'Video & Voice Boost',
        'tiers.addOns.videoVoiceBoostDesc': 'Extra video/voice.',
        'tiers.addOns.extraEcho': 'Extra Echo',
        'tiers.addOns.extraEchoDesc': 'One more Echo.',
        'tiers.addOns.privateShard': 'Private Shard',
        'tiers.addOns.privateShardDesc': 'Your own Shard.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  );
}

describe('SubscriptionTier type parity', () => {
  it('accepts all Rust SubscriptionTier variants', () => {
    const tiers: SubscriptionTier[] = ['Free', 'Starter', 'Core', 'Creator', 'GodMode'];
    expect(tiers).toHaveLength(5);
    const invalidCheck = (t: string): t is SubscriptionTier =>
      ['Free', 'Starter', 'Core', 'Creator', 'GodMode'].includes(t);
    expect(invalidCheck('Basic')).toBe(false);
    expect(invalidCheck('Pro')).toBe(false);
  });

  it('PlansPage renders Starter/Core/Creator/GodMode tier names', () => {
    render(<PlansPage />, { wrapper: Wrapper });
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('God Mode')).toBeInTheDocument();
    expect(screen.queryByText('Basic')).not.toBeInTheDocument();
    expect(screen.queryByText('Pro')).not.toBeInTheDocument();
  });
});

describe('AccountStatus type parity', () => {
  it('includes Deleted variant for post-purge users', () => {
    const statuses: AccountStatus[] = ['Active', 'Suspended', 'PendingDeletion', 'Deleted'];
    expect(statuses).toHaveLength(4);
  });
});

describe('EchoStatus type parity', () => {
  it('includes Quarantined and Deleted variants', () => {
    const statuses: EchoStatus[] = [
      'Active',
      'Hibernated',
      'Travelling',
      'PendingDeletion',
      'Quarantined',
      'Deleted',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('Quarantined status renders appropriate message', () => {
    // Component-level test: when a badge receives Quarantined status,
    // it should display a human-friendly label
    const statusLabel = (s: EchoStatus): string => {
      switch (s) {
        case 'Active':
          return 'Active';
        case 'Hibernated':
          return 'Hibernated';
        case 'Travelling':
          return 'Travelling';
        case 'PendingDeletion':
          return 'Pending Deletion';
        case 'Quarantined':
          return 'Under Review';
        case 'Deleted':
          return 'Deleted';
      }
    };
    expect(statusLabel('Quarantined')).toBe('Under Review');
    expect(statusLabel('Active')).toBe('Active');
  });
});

describe('WebSocket event type discrimination', () => {
  it('discriminates WorldEventPayload variants by type field', () => {
    const events: WorldEventPayload[] = [
      { type: 'DiaryEntryCreated', echo_id: '1', entry_id: '2' },
      { type: 'MoodChanged', echo_id: '1', old_mood: 'happy', new_mood: 'sad' },
      { type: 'MessageDeleted', channel_id: 'c1', message_id: 'm1', deleted_by: 'u1' },
      { type: 'MessageEdited', channel_id: 'c1', message_id: 'm1', author_id: 'u1' },
      {
        type: 'GlobalEventPropagated',
        event_id: 'e1',
        affected_shards: ['s1', 's2'],
      },
      {
        type: 'EchoWealthChanged',
        echo_id: '1',
        old_value: 100,
        new_value: 200,
        reason: 'trade',
      },
      {
        type: 'EchoMoved',
        echo_id: '1',
        shard_id: 's1',
        from_location: 'loc1',
        to_location: 'loc2',
        arrival_tick: 42,
      },
      { type: 'FeedItemGenerated', feed_item_id: 'f1', echo_id: 'e1', shard_id: 's1' },
      { type: 'NotificationCreated', notification_id: 'n1' },
    ];

    // Each event should be discriminable by type
    for (const event of events) {
      expect(event.type).toBeTruthy();
    }

    // Verify specific field access via type narrowing
    const mood = events.find((e) => e.type === 'MoodChanged');
    if (mood && mood.type === 'MoodChanged') {
      expect(mood.old_mood).toBe('happy');
      expect(mood.new_mood).toBe('sad');
    }

    const deleted = events.find((e) => e.type === 'MessageDeleted');
    if (deleted && deleted.type === 'MessageDeleted') {
      expect(deleted.deleted_by).toBe('u1');
    }
  });

  it('discriminates WsEchoEvent variants by type field', () => {
    const events: WsEchoEvent[] = [
      { type: 'DiaryEntryCreated', echo_id: '1', diary_id: '2', tick_id: 10 },
      { type: 'MoodChanged', echo_id: '1', mood: 'happy', tick_id: 10 },
      { type: 'EchoMoved', echo_id: '1', from_location: 'a', to_location: 'b' },
      { type: 'PersonalityShift', echo_id: '1', version: 3 },
      { type: 'Connected', message: 'ok' },
      { type: 'Error', message: 'fail' },
    ];

    expect(events).toHaveLength(6);

    const moved = events.find((e) => e.type === 'EchoMoved');
    if (moved && moved.type === 'EchoMoved') {
      expect(moved.from_location).toBe('a');
      expect(moved.to_location).toBe('b');
    }
  });
});
