import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { OnboardingProfilePage } from '../src/pages/OnboardingProfilePage.tsx';

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'onboarding.profileTitle': 'Set up your profile',
        'onboarding.avatar': 'Choose an avatar',
        'onboarding.bio': 'Bio',
        'onboarding.bioHint': 'Max 500 characters',
        'onboarding.timezone': 'Timezone',
        'common.skip': 'Skip',
        'common.continue': 'Continue',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/onboarding/profile']}>
        <OnboardingProfilePage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('OnboardingProfilePage', () => {
  it('renders profile setup title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Set up your profile')).toBeInTheDocument();
  });

  it('renders skip and continue buttons', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue' }),
    ).toBeInTheDocument();
  });

  it('renders bio textarea', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
  });
});
