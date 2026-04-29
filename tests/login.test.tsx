import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LoginPage } from '../src/pages/LoginPage.tsx';

vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: null, login: vi.fn() }),
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'auth.loginTitle': 'Log in',
        'auth.loginTitleReturning': 'Welcome back',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.logIn': 'Log in',
        'auth.loginFailed': 'Login failed',
        'auth.noAccount': "Don't have an account?",
        'auth.createOne': 'Create one',
        'common.loading': 'Loading...',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('LoginPage', () => {
  it('renders login form', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('has link to register page', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Create one')).toBeInTheDocument();
  });
});
