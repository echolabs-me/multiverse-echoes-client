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

  // The previous "renders disabled Pay with Card buttons" test was deleted.
  // Product-decision rationale: during closed beta, PlansPage.tsx:178-186
  // replaces the card-payment button with a clickable Stripe-logo button that
  // fires a "coming soon" toast. The button is NOT disabled at the HTML level
  // (it has an active onClick); the "disabled" contract the old test asserted
  // no longer exists. The new test below covers the actual beta contract.

  it('Stripe button fires coming-soon toast on click and does not start a payment', async () => {
    mockAddToast.mockClear();
    mockCreateNowpayments.mockClear();
    mockCreateXaman.mockClear();

    await act(async () => {
      renderPage();
    });

    // Each paid-tier card renders a Stripe button containing a "Coming soon"
    // badge (PlansPage.tsx:184 — span with t('common.comingSoon')). Find the
    // 3 badges, walk up to the button element, click each.
    const badges = screen.getAllByText('Coming soon');
    expect(badges).toHaveLength(3);

    for (const badge of badges) {
      const button = badge.closest('button');
      expect(button).not.toBeNull();
      fireEvent.click(button as HTMLButtonElement);
    }

    // Contract: 3 clicks → 3 addToast calls with payment.cardComingSoon text
    // (i18n-resolved via the test bundle to 'Available after company incorporation').
    expect(mockAddToast).toHaveBeenCalledTimes(3);
    for (const call of mockAddToast.mock.calls) {
      expect(call[0]).toBe('Available after company incorporation');
      expect(call[1]).toBe('info');
    }

    // Regression guard: if Stripe ever gets wired up without removing this
    // coming-soon mechanism, handlePayment (nowpayments/xaman) must not fire
    // as a side-effect of the Stripe click.
    expect(mockCreateNowpayments).not.toHaveBeenCalled();
    expect(mockCreateXaman).not.toHaveBeenCalled();
  });

  it('shows tier prices', async () => {
    await act(async () => {
      renderPage();
    });
    // Prices render as `$<dollars>/month` via `(tier.price / 100).toFixed(0)`
    // on the integer-cent TIERS literal in PlansPage.tsx: 900 / 2900 / 9900.
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
