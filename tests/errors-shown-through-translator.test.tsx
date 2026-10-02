import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { translateCaughtError } from '../src/lib/translateError.ts';
import { auth, payments, adminBilling } from '../src/lib/api/endpoints.ts';
import { useAuthStore } from '../src/stores/useAuthStore.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { LoginPage } from '../src/pages/LoginPage.tsx';
import { RegisterPage } from '../src/pages/RegisterPage.tsx';
import { TipPage } from '../src/pages/TipPage.tsx';
import { TriggerSnapshotButton } from '../src/components/admin/billing/TriggerSnapshotButton.tsx';

/**
 * R264: every page shows a caught server error through the translator. One
 * page from each class (B: showed the server's message; C: showed one fixed
 * string; D: branched first), and the defects R264.5 names. The pages run on
 * the app's own i18n, so a page's text and the translator's agree.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  auth: { login: vi.fn(), register: vi.fn() },
  account: { getProfile: vi.fn() },
  payments: { createTip: vi.fn() },
  adminBilling: { triggerRevenueSnapshot: vi.fn() },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const text = (key: string) => i18n.t(key);

function renderAt(path: string, page: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
    </I18nextProvider>,
  );
}

function toastMessages(): string[] {
  return useToastStore.getState().toasts.map((t) => t.message);
}

beforeEach(() => {
  vi.mocked(auth.login).mockReset();
  vi.mocked(auth.register).mockReset();
  vi.mocked(payments.createTip).mockReset();
  vi.mocked(adminBilling.triggerRevenueSnapshot).mockReset();
  useToastStore.setState({ toasts: [] });
  localStorage.clear();
});

describe('translateCaughtError', () => {
  it("shows a code's text first, then the server's message, then the fallback", () => {
    expect(
      translateCaughtError(
        new ApiRequestError(400, 'WRONG_STATE', 'session is Completed'),
        'fallback',
      ),
    ).toBe(text('errors.WRONG_STATE'));
    expect(
      translateCaughtError(
        new ApiRequestError(400, 'NO_TEXT_FOR_THIS_CODE', 'the server says'),
        'fallback',
      ),
    ).toBe('the server says');
    expect(
      translateCaughtError(new ApiRequestError(502, 'UNKNOWN', ''), 'fallback'),
    ).toBe('fallback');
    // A server error with no code still shows the server's message.
    expect(
      translateCaughtError(
        new ApiRequestError(500, '', 'the server says'),
        'fallback',
      ),
    ).toBe('the server says');
  });

  it("shows the fallback for an error that is not the server's, whatever its message", () => {
    expect(
      translateCaughtError(new TypeError('Failed to fetch'), 'fallback'),
    ).toBe('fallback');
    expect(translateCaughtError(new Error('ECHO_LIMIT'))).toBe(
      text('errors.INTERNAL_ERROR'),
    );
  });
});

describe('the auth store passes on the error it caught (R264.5)', () => {
  it('login rethrows the server error itself', async () => {
    const err = new ApiRequestError(400, 'CAPTCHA_FAILED', 'captcha failed');
    vi.mocked(auth.login).mockRejectedValue(err);
    await expect(
      useAuthStore.getState().login({ email: 'a@b.c', password: 'x' }),
    ).rejects.toBe(err);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('register rethrows the server error itself', async () => {
    const err = new ApiRequestError(409, 'EMAIL_TAKEN', 'email taken');
    vi.mocked(auth.register).mockRejectedValue(err);
    await expect(
      useAuthStore.getState().register({
        email: 'a@b.c',
        password: 'x',
        display_name: 'abc',
        tos_accepted: true,
        privacy_accepted: true,
        age_confirmed: true,
        invite_code: 'INVITE1',
      }),
    ).rejects.toBe(err);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('class C: the login page shows the server error, with its fixed string as the fallback', () => {
  async function submitLogin() {
    await act(async () => {
      renderAt('/login', <LoginPage />);
    });
    fireEvent.change(screen.getByLabelText(text('auth.email')), {
      target: { value: 'a@b.c' },
    });
    fireEvent.change(screen.getByLabelText(text('auth.password')), {
      target: { value: 'password-123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: text('auth.logIn') }));
    });
  }

  it("shows the code's text", async () => {
    vi.mocked(auth.login).mockRejectedValue(
      new ApiRequestError(400, 'CAPTCHA_FAILED', 'captcha failed'),
    );
    await submitLogin();
    expect(screen.getByText(text('errors.CAPTCHA_FAILED'))).toBeInTheDocument();
    expect(
      screen.queryByText(text('auth.loginFailed')),
    ).not.toBeInTheDocument();
  });

  it('shows its own string for a failure that is not the server error', async () => {
    vi.mocked(auth.login).mockRejectedValue(new TypeError('Failed to fetch'));
    await submitLogin();
    expect(screen.getByText(text('auth.loginFailed'))).toBeInTheDocument();
  });
});

describe('class D: the registration page keeps its field branches and translates the rest', () => {
  async function submitRegister() {
    localStorage.setItem('locale_selected', 'true');
    await act(async () => {
      renderAt('/register', <RegisterPage />);
    });
    const fill = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(text(label)), {
        target: { value },
      });
    fill('auth.inviteCode', 'INVITE1');
    fill('auth.email', 'a@b.c');
    fill('auth.displayName', 'Someone');
    fill('auth.password', 'password-12345');
    fill('auth.confirmPassword', 'password-12345');
    for (const box of screen.getAllByRole('checkbox')) {
      fireEvent.click(box);
    }
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: text('auth.createAccount') }),
      );
    });
  }

  it('shows a taken email at the email field', async () => {
    vi.mocked(auth.register).mockRejectedValue(
      new ApiRequestError(409, 'EMAIL_TAKEN', 'email taken'),
    );
    await submitRegister();
    expect(screen.getByText(text('auth.emailTaken'))).toBeInTheDocument();
  });

  it('shows a bad invite code at the invite field', async () => {
    vi.mocked(auth.register).mockRejectedValue(
      new ApiRequestError(400, 'INVALID_INVITE_CODE', 'bad code'),
    );
    await submitRegister();
    expect(
      screen.getByText(text('auth.invalidInviteCode')),
    ).toBeInTheDocument();
  });

  it("shows any other code's text for the form", async () => {
    vi.mocked(auth.register).mockRejectedValue(
      new ApiRequestError(400, 'CAPTCHA_FAILED', 'captcha failed'),
    );
    await submitRegister();
    expect(screen.getByText(text('errors.CAPTCHA_FAILED'))).toBeInTheDocument();
  });
});

describe('class B: the snapshot button shows the translator, with its own string as the fallback', () => {
  it("shows the code's text, not the server's message", async () => {
    vi.mocked(adminBilling.triggerRevenueSnapshot).mockRejectedValue(
      new ApiRequestError(403, 'ADMIN_REQUIRED', 'Admin access required'),
    );
    await act(async () => {
      renderAt('/', <TriggerSnapshotButton onInserted={() => undefined} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(toastMessages()).toEqual([text('errors.ADMIN_REQUIRED')]);
  });

  it("shows its own string for a failure that is not the server's", async () => {
    vi.mocked(adminBilling.triggerRevenueSnapshot).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await act(async () => {
      renderAt('/', <TriggerSnapshotButton onInserted={() => undefined} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(toastMessages()).toEqual([
      text('admin.billing.snapshot.errorPrefix'),
    ]);
  });
});

describe('the tip page shows a failed tip (R264.5)', () => {
  it("shows the code's text", async () => {
    vi.mocked(payments.createTip).mockRejectedValue(
      new ApiRequestError(400, 'RATE_LOOKUP_FAILED', 'rate lookup failed'),
    );
    await act(async () => {
      renderAt('/tip', <TipPage />);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: new RegExp(text('payment.payWithCrypto')),
        }),
      );
    });
    expect(toastMessages()).toEqual([text('errors.RATE_LOOKUP_FAILED')]);
  });
});
