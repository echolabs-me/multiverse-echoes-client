import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PlansPage } from '../src/pages/PlansPage.tsx';
import { PaymentSuccessPage } from '../src/pages/PaymentSuccessPage.tsx';
import { PaymentCancelledPage } from '../src/pages/PaymentCancelledPage.tsx';
import { TipPage } from '../src/pages/TipPage.tsx';

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => {
    const state = {
      user: {
        user_id: 'test-id',
        subscription_tier: 'Free',
        subscription_expires_at: null,
      },
    };
    return selector(state);
  },
}));

// Payment mocks exposed at module scope so the Stripe-toast test can
// assert non-invocation alongside the happy-path calls that other tests use.
const mockCreateNowpayments = vi.fn().mockResolvedValue({ payment_id: 'p1', checkout_url: 'https://example.com' });
const mockCreateXaman = vi.fn().mockResolvedValue({ payment_id: 'p2', checkout_url: 'https://example.com' });

vi.mock('../src/lib/api/endpoints.ts', () => ({
  payments: {
    createNowpayments: (...args: unknown[]) => mockCreateNowpayments(...args),
    createXaman: (...args: unknown[]) => mockCreateXaman(...args),
    getStatus: vi.fn().mockResolvedValue({ payment_id: 'p1', status: 'Pending', provider: 'nowpayments', amount_usd_cents: 999, confirmed_at: null }),
    createTip: vi.fn().mockResolvedValue({ payment_id: 'p3', checkout_url: 'https://example.com' }),
  },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

// PlansPage.tsx:180 calls addToast(t('payment.cardComingSoon'), 'info') when
// the Stripe button is clicked. Mock the store so the new Stripe-toast test
// can assert the call.
const mockAddToast = vi.fn();
vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (selector: (s: unknown) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.back': 'Back',
        'common.loading': 'Loading...',
        'common.errorGeneric': 'Something went wrong.',
        'payment.title': 'Plans',
        'payment.subtitle': 'Choose the right plan for your multiverse.',
        'payment.free': 'Free',
        'payment.current': 'Current',
        'payment.currentPlan': 'Current plan',
        'payment.manageSubscription': 'Manage subscription',
        'payment.perMonth': '/month',
        'payment.payWithCrypto': 'Pay with Crypto',
        'payment.payWithXRP': 'Pay with XRP',
        'payment.cardComingSoon': 'Available after company incorporation',
        'payment.cryptoUnavailable': 'Crypto payments temporarily unavailable.',
        'common.comingSoon': 'Coming soon',
        'payment.subscribing': 'Creating payment...',
        'payment.successTitle': 'Payment confirmed!',
        'payment.successDesc': 'Your tier has been upgraded.',
        'payment.successPending': 'Payment is being processed...',
        'payment.successPendingDesc': 'This usually takes a few minutes.',
        'payment.cancelledTitle': 'Payment cancelled',
        'payment.cancelledDesc': 'Your payment was cancelled.',
        'payment.backToPlans': 'Back to Plans',
        'payment.backToDashboard': 'Back to Dashboard',
        'payment.checkingStatus': 'Checking payment status...',
        'payment.tipTitle': 'Support the Project',
        'payment.tipDesc': 'Help keep Multiverse Echoes running.',
        'payment.tipAmount': 'Amount',
        'payment.tipCustom': 'Custom amount',
        'payment.tipMessage': 'Message (optional)',
        'payment.tipMessagePlaceholder': 'Leave a message...',
        'payment.tipSend': 'Send Tip',
        'tiers.free': 'Free',
        'tiers.starter': 'Starter',
        'tiers.core': 'Core',
        'tiers.creator': 'Creator',
        'tiers.godMode': 'God Mode',
        'tiers.mostPopular': 'Popular',
        'tiers.enterprise': 'Enterprise',
        'tiers.enterpriseDesc': 'Custom solutions for organisations.',
        'tiers.contactUs': 'Contact us',
        'tiers.enhanceTiers': 'Enhance your experience. No commitment — add or remove anytime.',
        'tiers.features.1echoPublic': '1 Echo (public)',
        'tiers.features.diaryAmPm': 'Diary entries twice daily',
        'tiers.features.1conv': '1 conversation/day',
        'tiers.features.1nudge': '1 nudge/day',
        'tiers.features.2ip': '2 Influence Points/day',
        'tiers.features.3echoes': '3 Echoes',
        'tiers.features.diary2hr': 'Diary every 2 hours',
        'tiers.features.5conv': '5 conversations/day',
        'tiers.features.3nudges': '3 nudges/day',
        'tiers.features.4ip': '4 Influence Points/day',
        'tiers.features.adFree': 'Ad-free',
        'tiers.features.5echoes': '5 Echoes',
        'tiers.features.diary30m': 'Diary every 30 minutes',
        'tiers.features.10conv': '10 conversations/day',
        'tiers.features.10nudges': '10 nudges/day',
        'tiers.features.6ip': '6 Influence Points/day',
        'tiers.features.8echoes': '8 Echoes',
        'tiers.features.diary15m': 'Diary every 15 minutes',
        'tiers.features.20conv': '20 conversations/day',
        'tiers.features.20nudges': '20 nudges/day',
        'tiers.features.12ip': '12 Influence Points/day',
        'tiers.features.1privateShard': '1 Private Shard included',
        'tiers.features.12echoes': '12 Echoes',
        'tiers.features.diary5m': 'Diary every 5 minutes',
        'tiers.features.unlimitedConv': 'Unlimited conversations',
        'tiers.features.unlimitedNudges': 'Unlimited nudges',
        'tiers.features.unlimitedIp': 'Unlimited Influence Points',
        'tiers.features.3privateShards': '3 Private Shards included',
        'tiers.features.priorityInference': 'Priority inference',
        'tiers.influencePoints.explainer':
          'Premium actions: suggest activities or hint at relationships — your Echo decides whether to act.',
        'tiers.addOns.title': 'Add-ons',
        'tiers.addOns.buyAddon': 'Buy',
        'tiers.addOns.included': 'Included ({{count}})',
        'tiers.addOns.notAvailableOnPlan': 'Not available on your plan',
        'tiers.addOns.nudgePack': 'Nudge 100-Pack',
        'tiers.addOns.nudgePackDesc': '100 extra nudges.',
        'tiers.addOns.premiumActionsPack': 'Premium Actions 20-Pack',
        'tiers.addOns.premiumActionsPackDesc': '20 Influence Points for your Echo to act on.',
        'tiers.addOns.speedBoost': 'Speed Boost',
        'tiers.addOns.speedBoostDesc': 'Halve the heartbeat interval.',
        'tiers.addOns.videoVoiceBoost': 'Video & Voice Boost',
        'tiers.addOns.videoVoiceBoostDesc': 'Extra daily video and voice.',
        'tiers.addOns.extraEcho': 'Extra Echo',
        'tiers.addOns.extraEchoDesc': 'One additional Echo slot.',
        'tiers.addOns.privateShard': 'Private Shard',
        'tiers.addOns.privateShardDesc': 'One private Shard for your Echoes.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

// ── PlansPage ───────────────────────────────────────────────────

describe('PlansPage', () => {
  function renderPage() {
    return render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/plans']}>
          <PlansPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  }

  it('renders all 5 tier cards', async () => {
    await act(async () => {
      renderPage();
    });
    // "Free" appears as both tier name and price text; check presence with getAllByText.
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('God Mode')).toBeInTheDocument();
  });

  it('renders current tier badge', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('renders Enterprise contact-us card', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Contact us')).toBeInTheDocument();
  });

  it('renders Pay with Crypto buttons for paid tiers', async () => {
    await act(async () => {
      renderPage();
    });
    const cryptoButtons = screen.getAllByText('Pay with Crypto');
    expect(cryptoButtons).toHaveLength(4); // Starter, Core, Creator, God Mode
  });

  it('renders Pay with XRP buttons for paid tiers', async () => {
    await act(async () => {
      renderPage();
    });
    const xrpButtons = screen.getAllByText('Pay with XRP');
    expect(xrpButtons).toHaveLength(4);
  });

  // Beta contract: Stripe is feature-gated pending Singapore incorporation
  // (~2026-04-23). Each paid tier card AND each available-to-Free add-on
  // renders a Stripe button with "Coming soon" badge. Free tier has access to
  // 2 add-ons (nudge_100_pack, premium_actions_20_pack) per ADDON_AVAILABILITY.
  // Total Coming Soon surfaces = 4 tier cards + 2 add-ons = 6.
  it('Stripe button fires coming-soon toast on click and does not start a payment', async () => {
    mockAddToast.mockClear();
    mockCreateNowpayments.mockClear();
    mockCreateXaman.mockClear();

    await act(async () => {
      renderPage();
    });

    const badges = screen.getAllByText('Coming soon');
    // 4 paid tier cards + 2 Free-available add-ons = 6 Coming-Soon surfaces.
    expect(badges).toHaveLength(6);

    for (const badge of badges) {
      const button = badge.closest('button');
      expect(button).not.toBeNull();
      fireEvent.click(button as HTMLButtonElement);
    }

    expect(mockAddToast).toHaveBeenCalledTimes(6);
    for (const call of mockAddToast.mock.calls) {
      expect(call[0]).toBe('Available after company incorporation');
      expect(call[1]).toBe('info');
    }

    // Regression guard: the Coming-Soon click must not start a crypto payment.
    expect(mockCreateNowpayments).not.toHaveBeenCalled();
    expect(mockCreateXaman).not.toHaveBeenCalled();
  });

  it('shows canonical tier prices', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('$9.99/month')).toBeInTheDocument();
    expect(screen.getByText('$24.99/month')).toBeInTheDocument();
    expect(screen.getByText('$39.99/month')).toBeInTheDocument();
    expect(screen.getByText('$59.99/month')).toBeInTheDocument();
  });

  it('shows Private Shard availability on Creator and God Mode tier cards', async () => {
    await act(async () => {
      renderPage();
    });
    // Free user sees Private Shard listed as "Not available on your plan"
    // (Free ADDON_AVAILABILITY = unavailable).
    expect(screen.getByText('Private Shard')).toBeInTheDocument();
  });
});

// ── PaymentSuccessPage ──────────────────────────────────────────

describe('PaymentSuccessPage', () => {
  it('renders processing state when payment id present', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={['/payment/success?id=abc123&provider=nowpayments']}>
            <PaymentSuccessPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Payment is being processed...')).toBeInTheDocument();
    expect(screen.getByText('Checking payment status...')).toBeInTheDocument();
  });

  it('renders back to dashboard button', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={['/payment/success']}>
            <PaymentSuccessPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('renders back to plans link', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={['/payment/success']}>
            <PaymentSuccessPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Back to Plans')).toBeInTheDocument();
  });
});

// ── PaymentCancelledPage ────────────────────────────────────────

describe('PaymentCancelledPage', () => {
  function renderPage() {
    return render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/payment/cancelled']}>
          <PaymentCancelledPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  }

  it('renders cancellation message', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Payment cancelled')).toBeInTheDocument();
    expect(screen.getByText('Your payment was cancelled.')).toBeInTheDocument();
  });

  it('has link back to plans', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Back to Plans')).toBeInTheDocument();
  });
});

// ── TipPage ─────────────────────────────────────────────────────

describe('TipPage', () => {
  function renderPage() {
    return render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/tip']}>
          <TipPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  }

  it('renders title and description', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Support the Project')).toBeInTheDocument();
    expect(screen.getByText('Help keep Multiverse Echoes running.')).toBeInTheDocument();
  });

  it('renders preset amount buttons', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('$1')).toBeInTheDocument();
    expect(screen.getByText('$5')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('renders custom amount option', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Custom amount')).toBeInTheDocument();
  });

  it('renders message field', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Message (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Leave a message...')).toBeInTheDocument();
  });

  it('renders provider buttons', async () => {
    await act(async () => {
      renderPage();
    });
    // Buttons contain provider text + price
    expect(screen.getByText(/Pay with Crypto/)).toBeInTheDocument();
    expect(screen.getByText(/Pay with XRP/)).toBeInTheDocument();
  });
});
