import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PrivacyPolicyPage } from '../src/pages/PrivacyPolicyPage.tsx';
import { TermsPage } from '../src/pages/TermsPage.tsx';
import { VerifiedPage } from '../src/pages/VerifiedPage.tsx';
import { VerifyPendingPage } from '../src/pages/VerifyPendingPage.tsx';

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'auth.verifiedTitle': 'Email Verified',
        'auth.verifiedDescription': 'Your email has been verified.',
        'auth.verifyTitle': 'Check your email',
        'auth.verifyDescription': 'We sent a verification link to {{email}}',
        'auth.resend': 'Resend',
        'auth.resendCooldown': 'Resend in {{seconds}}s',
        'common.continue': 'Continue',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

describe('PrivacyPolicyPage', () => {
  it('renders privacy policy content', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter>
            <PrivacyPolicyPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });
});

describe('TermsPage', () => {
  it('renders terms of service content', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter>
            <TermsPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});

describe('VerifiedPage', () => {
  it('renders verification success', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter>
            <VerifiedPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Email Verified')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue' }),
    ).toBeInTheDocument();
  });
});

describe('VerifyPendingPage', () => {
  it('renders verification pending', async () => {
    await act(async () => {
      render(
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={[{ pathname: '/verify-pending', state: { email: 'test@example.com' } }]}>
            <VerifyPendingPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    expect(screen.getByText('Check your email')).toBeInTheDocument();
  });
});
