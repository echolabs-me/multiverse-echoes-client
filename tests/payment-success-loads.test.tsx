import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { StrictMode, Profiler } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PaymentSuccessPage } from '../src/pages/PaymentSuccessPage.tsx';
import { payments } from '../src/lib/api/endpoints.ts';

// R361, R371.1, R381.1: the page shows and writes only the status of the
// payment its query names, and of the polls it starts only the last one
// started writes.
vi.mock('../src/lib/api/endpoints.ts', () => ({
  payments: { getStatus: vi.fn() },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'payment.successTitle': 'Payment confirmed',
        'payment.successDesc': 'Thank you',
        'payment.successPending': 'Payment pending',
        'payment.successPendingDesc': 'We are confirming it',
        'payment.checkingStatus': 'Checking status',
        'payment.backToDashboard': 'Dashboard',
        'payment.backToPlans': 'Plans',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

type Status = Awaited<ReturnType<typeof payments.getStatus>>;

function status(payment_id: string, value: string): Status {
  return {
    payment_id,
    status: value,
    provider: 'nowpayments',
    amount_usd_cents: 999,
    confirmed_at: null,
  } as Status;
}

function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function GoToP2() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/payment/success?id=p2')}>go to p2</button>
  );
}

/** The page's text at every commit, read in a layout effect after it. */
const commits: string[] = [];
/** Records the page's text at every commit of what it wraps. */
function CommitProbe({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="page"
      onRender={() => {
        commits.push(document.body.textContent ?? '');
      }}
    >
      {children}
    </Profiler>
  );
}

function renderPage({
  strict = false,
  entry = '/payment/success?id=p1',
}: { strict?: boolean; entry?: string } = {}) {
  const page = (
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[entry]}>
        <GoToP2 />
        <CommitProbe>
          <Routes>
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
          </Routes>
        </CommitProbe>
      </MemoryRouter>
    </I18nextProvider>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

beforeEach(() => {
  commits.length = 0;
  vi.mocked(payments.getStatus).mockReset();
});

describe('PaymentSuccessPage loads (R361)', () => {
  it.each([
    ['an empty', '/payment/success?id='],
    ['an absent', '/payment/success'],
  ])(
    'with %s payment id the page polls nothing and shows the pending view, never checking status',
    async (_, entry) => {
      await act(async () => {
        renderPage({ entry });
      });
      expect(payments.getStatus).not.toHaveBeenCalled();
      expect(screen.getByText('Payment pending')).toBeInTheDocument();
      expect(screen.queryByText('Checking status')).toBeNull();
    },
  );

  it('a read for an earlier payment that settles after the later payment’s leaves the later payment’s status (R361.3)', async () => {
    const p1 = held<Status>();
    vi.mocked(payments.getStatus).mockImplementation((id: string) =>
      id === 'p1' ? p1.promise : Promise.resolve(status('p2', 'Failed')),
    );
    await act(async () => {
      renderPage();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go to p2' }));
    });
    expect(screen.queryByText('Checking status')).toBeNull();
    await act(async () => {
      p1.resolve(status('p1', 'Finished'));
    });
    expect(screen.queryByText('Payment confirmed')).toBeNull();
    expect(screen.getByText('Payment pending')).toBeInTheDocument();
    expect(screen.queryByText('Checking status')).toBeNull();
  });

  it('from a confirmed payment to the route of another, the first render for it shows it pending, never the earlier confirmation (R371.1)', async () => {
    vi.mocked(payments.getStatus).mockImplementation((id: string) =>
      id === 'p1'
        ? Promise.resolve(status('p1', 'Finished'))
        : new Promise(() => undefined),
    );
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Payment confirmed')).toBeInTheDocument();
    commits.length = 0;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go to p2' }));
    });
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('Payment confirmed');
    }
  });

  it('of two polls for one payment, an older one that reads last writes nothing (R381.1)', async () => {
    const older = held<Status>();
    const newer = held<Status>();
    vi.mocked(payments.getStatus)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await act(async () => {
      renderPage({ strict: true });
    });
    expect(vi.mocked(payments.getStatus).mock.calls).toEqual([['p1'], ['p1']]);
    await act(async () => {
      newer.resolve(status('p1', 'Finished'));
    });
    await act(async () => {
      older.resolve(status('p1', 'Failed'));
    });
    expect(screen.getByText('Payment confirmed')).toBeInTheDocument();
  });
});
