import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { WaitlistPage } from '../src/pages/WaitlistPage.tsx';

// Mock the API module.
vi.mock('../src/lib/api/endpoints.ts', () => ({
  waitlist: {
    signup: vi.fn().mockResolvedValue({
      entry_id: 'test-id',
      position: 42,
      referral_code: 'ME-12345678',
    }),
    count: vi.fn().mockResolvedValue({ count: 847 }),
    position: vi.fn().mockResolvedValue({
      entry_id: 'test-id',
      position: 42,
      status: 'Waiting',
      referral_count: 0,
    }),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.loading': 'Loading...',
        'common.copy': 'Copy',
        'common.copied': 'Copied!',
        'waitlist.heroTitle':
          "What would your life look like if you'd made different choices?",
        'waitlist.heroSubtitle': 'Create an AI Echo of yourself.',
        'waitlist.diaryPreviewLabel': 'Echo diary entry',
        'waitlist.diaryPreviewText': 'The neon lights reflected…',
        'waitlist.emailPlaceholder': 'Enter your email',
        'waitlist.joinButton': 'Join the waitlist',
        'waitlist.invalidEmail': 'Please enter a valid email address.',
        'waitlist.signupError': 'Something went wrong.',
        'waitlist.alreadyRegistered': 'Already on waitlist.',
        'waitlist.socialProofCount': '{{count}} people are already waiting',
        'waitlist.confirmationTitle': "You're #{{position}} on the waitlist!",
        'waitlist.confirmationDesc': 'Share your referral link.',
        'waitlist.referralHint': 'Each referral moves you up 5 positions.',
        'waitlist.howItWorksTitle': 'How it works',
        'waitlist.step1Title': 'Create your persona',
        'waitlist.step1Desc': 'Tell us who you\'d be.',
        'waitlist.step2Title': 'Watch your Echo live',
        'waitlist.step2Desc': 'Your Echo lives autonomously.',
        'waitlist.step3Title': 'Share the stories',
        'waitlist.step3Desc': 'Export your Echo\'s diary.',
        'waitlist.socialProofTitle': 'Built different',
        'waitlist.socialProofDesc': 'Built by one person.',
        'waitlist.socialProofQuote': '"The most interesting stories…"',
        'waitlist.privacyPolicy': 'Privacy Policy',
        'waitlist.termsOfService': 'Terms of Service',
        'waitlist.footerTagline': 'All rights reserved.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/waitlist']}>
        <WaitlistPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('WaitlistPage', () => {
  it('renders hero title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByText(
        "What would your life look like if you'd made different choices?",
      ),
    ).toBeInTheDocument();
  });

  it('renders email input and join button', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByLabelText('Enter your email')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Join the waitlist' }),
    ).toBeInTheDocument();
  });

  it('shows how-it-works section', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText('Create your persona')).toBeInTheDocument();
    expect(screen.getByText('Watch your Echo live')).toBeInTheDocument();
    expect(screen.getByText('Share the stories')).toBeInTheDocument();
  });

  it('shows social proof count', async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByText('847 people are already waiting'),
    ).toBeInTheDocument();
  });

  it('shows validation error for empty email', async () => {
    await act(async () => {
      renderPage();
    });
    const button = screen.getByRole('button', { name: 'Join the waitlist' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(
      screen.getByText('Please enter a valid email address.'),
    ).toBeInTheDocument();
  });

  it('shows confirmation after successful signup', async () => {
    await act(async () => {
      renderPage();
    });

    const input = screen.getByLabelText('Enter your email');
    const button = screen.getByRole('button', { name: 'Join the waitlist' });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.click(button);
    });

    expect(
      screen.getByText("You're #42 on the waitlist!"),
    ).toBeInTheDocument();
  });

  it('renders footer links', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});
