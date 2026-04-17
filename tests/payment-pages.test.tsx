import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

vi.mock('../src/lib/api/endpoints.ts', () => ({
  payments: {
    createNowpayments: vi.fn().mockResolvedValue({ payment_id: 'p1', checkout_url: 'https://example.com' }),
    createXaman: vi.fn().mockResolvedValue({ payment_id: 'p2', checkout_url: 'https://example.com' }),
    getStatus: vi.fn().mockResolvedValue({ payment_id: 'p1', status: 'Pending', provider: 'nowpayments', amount_usd_cents: 999, confirmed_at: null }),
    createTip: vi.fn().mockResolvedValue({ payment_id: 'p3', checkout_url: 'https://example.com' }),
  },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.back': 'Back',
        'payment.title': 'Plans',
        'payment.subtitle': 'Choose the right plan for your multiverse.',
        'payment.free': 'Free',
        'payment.current': 'Current',
        'payment.perMonth': '/month',
        'payment.payWithCrypto': 'Pay with Crypto',
        'payment.payWithXRP': 'Pay with XRP',
        'payment.cardComingSoon': 'Available after company incorporation',
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

  it('renders all 4 tier cards', async () => {
    await act(async () => {
      renderPage();
    });
    // "Free" appears as both tier name and price text; check heading role
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
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

  it('renders Pay with Crypto buttons for paid tiers', async () => {
    await act(async () => {
      renderPage();
    });
    const cryptoButtons = screen.getAllByText('Pay with Crypto');
    expect(cryptoButtons).toHaveLength(3); // Core, Creator, God Mode
  });

  it('renders Pay with XRP buttons for paid tiers', async () => {
    await act(async () => {
      renderPage();
    });
    const xrpButtons = screen.getAllByText('Pay with XRP');
    expect(xrpButtons).toHaveLength(3);
  });

  it('renders Stripe coming-soon buttons for paid tiers', async () => {
    await act(async () => {
      renderPage();
    });
    // PlansPage replaced the "Pay with Card" text with a StripeLogo button
    // that fires a "coming soon" toast — see client/src/pages/PlansPage.tsx.
    // One Stripe button per paid tier (Core, Creator, God Mode).
    const comingSoonBadges = screen.getAllByText('Coming soon');
    expect(comingSoonBadges).toHaveLength(3);
  });

  it('shows tier prices', async () => {
    await act(async () => {
      renderPage();
    });
    // Prices render as `$<dollars>/month` via `(tier.price / 100).toFixed(0)`
    // on integer dollar prices 900 / 2900 / 9900 cents = $9 / $29 / $99.
    expect(screen.getByText('$9/month')).toBeInTheDocument();
    expect(screen.getByText('$29/month')).toBeInTheDocument();
    expect(screen.getByText('$99/month')).toBeInTheDocument();
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
