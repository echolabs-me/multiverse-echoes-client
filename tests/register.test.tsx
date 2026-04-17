import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { RegisterPage } from '../src/pages/RegisterPage.tsx';

vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ user: null }),
    { setState: vi.fn() },
  ),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  auth: {
    register: vi.fn().mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
      email_verified: false,
    }),
  },
}));

vi.mock('../src/lib/auth.ts', () => ({
  setTokens: vi.fn(),
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'auth.createAccount': 'Create account',
        'auth.email': 'Email',
        'auth.displayName': 'Display name',
        'auth.displayNameHint': '3-30 characters',
        'auth.password': 'Password',
        'auth.passwordHint': 'At least 12 characters',
        'auth.confirmPassword': 'Confirm password',
        'auth.tosAgree': 'I agree to the',
        'auth.tosLink': 'Terms of Service',
        'auth.privacyAgree': 'I agree to the',
        'auth.privacyLink': 'Privacy Policy',
        'auth.alreadyHaveAccount': 'Already have an account?',
        'auth.logIn': 'Log in',
        'auth.passwordTooShort': 'Password too short',
        'auth.passwordMismatch': 'Passwords do not match',
        'auth.displayNameInvalid': 'Invalid display name',
        'auth.tosRequired': 'Must accept ToS',
        'auth.privacyRequired': 'Must accept Privacy',
        'auth.emailTaken': 'Email taken',
        'auth.displayNameTaken': 'Name taken',
        'common.loading': 'Loading...',
        'common.error': 'Error',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    // RegisterPage.tsx:34-37 early-returns <Navigate to="/language?…"> when
    // localStorage.locale_selected !== 'true'. Set the flag so the form
    // actually mounts in the test tree.
    localStorage.setItem('locale_selected', 'true');
  });

  it('renders registration form', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('renders ToS and Privacy checkboxes', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });

  it('has link to login page', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });
});
