import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { OnboardingWelcomePage } from '../src/pages/OnboardingWelcomePage.tsx';

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'onboarding.welcomeTitle': 'Welcome to Multiverse Echoes',
        'onboarding.card1Title': 'Your Echo lives',
        'onboarding.card1Body': 'Your Echo makes choices autonomously.',
        'onboarding.card2Title': 'Watch and nudge',
        'onboarding.card2Body': 'You observe and guide.',
        'onboarding.card3Title': 'Share the stories',
        'onboarding.card3Body': 'Export your Echo diary.',
        'onboarding.understand': 'I understand',
        'common.next': 'Next',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/onboarding/welcome']}>
        <OnboardingWelcomePage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('OnboardingWelcomePage', () => {
  it('renders welcome title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByText('Welcome to Multiverse Echoes'),
    ).toBeInTheDocument();
  });

  it('renders first card content', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Your Echo lives')).toBeInTheDocument();
  });

  it('has next button', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('advances through cards', async () => {
    await act(async () => {
      renderPage();
    });
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await act(async () => {
      fireEvent.click(nextButton);
    });
    expect(screen.getByText('Watch and nudge')).toBeInTheDocument();
  });
});
