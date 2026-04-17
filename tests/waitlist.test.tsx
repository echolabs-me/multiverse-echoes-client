import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { WaitlistPage } from '../src/pages/WaitlistPage.tsx';

// WaitlistPage uses raw `fetch` against an external waitlist worker URL,
// not ../src/lib/api/endpoints.ts — so we mock global.fetch directly.
// See WaitlistPage.tsx fetchWaitlistCount / signupForWaitlist.
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (url.endsWith('/waitlist/count')) {
      return Promise.resolve(
        new Response(JSON.stringify({ total: 847, invited: 0 }), { status: 200 }),
      );
    }
    if (url.endsWith('/waitlist')) {
      return Promise.resolve(new Response(null, { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.loading': 'Loading...',
        'auth.joinWaitlist': 'Join the waitlist',
        'waitlist.heroSubtitle': 'Create an AI Echo of yourself.',
        'waitlist.alreadyWaiting': 'already waiting',
        'waitlist.emailPlaceholder': 'Enter your email',
        'waitlist.joinButton': 'Join',
        'waitlist.invalidEmail': 'Please enter a valid email address.',
        'waitlist.signupError': 'Something went wrong.',
        'waitlist.alreadyRegistered': 'Already on waitlist.',
        'waitlist.checkEmailTitle': 'Check your email',
        'waitlist.checkEmailDesc': 'Confirmation sent to {{email}}.',
        'waitlist.expectTitle': 'What to expect',
        'waitlist.expectStep1': 'Create your persona.',
        'waitlist.expectStep2': 'Watch your Echo live autonomously.',
        'waitlist.expectStep3': "Share the stories from your Echo's diary.",
        'waitlist.haveInviteCode': 'Have an invite code?',
        'waitlist.registerHere': 'Register here',
        'waitlist.metaTitle': 'Waitlist — Multiverse Echoes',
        'waitlist.metaDesc': 'Join the waitlist.',
        'waitlist.ogTitle': 'Join the waitlist',
        'waitlist.ogDesc': 'An Autonomous Life Simulation Platform.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <HelmetProvider>
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/waitlist']}>
          <WaitlistPage />
        </MemoryRouter>
      </I18nextProvider>
    </HelmetProvider>,
  );
}

describe('WaitlistPage', () => {
  it('renders hero heading (auth.joinWaitlist) and subtitle', async () => {
    await act(async () => {
      renderPage();
    });
    // Page now uses auth.joinWaitlist for the h1 (shared with RegisterPage
    // CTA) and waitlist.heroSubtitle as the pitch. The earlier "What would
    // your life look like…" heroTitle was removed in the rewrite.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Join the waitlist' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create an AI Echo of yourself.')).toBeInTheDocument();
  });

  it('renders email input and join button', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByLabelText('Enter your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
  });

  it('shows the what-to-expect section with three steps', async () => {
    await act(async () => {
      renderPage();
    });
    // Replaces the legacy "How it works" section. Uses waitlist.expect*
    // keys (see WaitlistPage.tsx <section> with t('waitlist.expectTitle')).
    expect(screen.getByText('What to expect')).toBeInTheDocument();
    expect(screen.getByText('Create your persona.')).toBeInTheDocument();
    expect(
      screen.getByText('Watch your Echo live autonomously.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Share the stories from your Echo's diary."),
    ).toBeInTheDocument();
  });

  it('shows the social-proof count banner with live number', async () => {
    await act(async () => {
      renderPage();
    });
    // Count banner: big number + "already waiting" label. Number comes
    // from mocked /waitlist/count → total: 847. Rendered via
    // toLocaleString() so '847' not '847 people are already waiting'.
    expect(await screen.findByText('847')).toBeInTheDocument();
    expect(screen.getByText('already waiting')).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    await act(async () => {
      renderPage();
    });
    const input = screen.getByLabelText('Enter your email');
    const button = screen.getByRole('button', { name: 'Join' });
    // Use a value that passes the <input type="email"> HTML5 check
    // (contains '@') but fails the page's own client-side validator
    // on length < 5 — see handleSubmit in WaitlistPage.tsx.
    fireEvent.change(input, { target: { value: 'a@b' } });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(
      screen.getByText('Please enter a valid email address.'),
    ).toBeInTheDocument();
  });

  it('shows check-your-email confirmation after successful signup', async () => {
    await act(async () => {
      renderPage();
    });

    const input = screen.getByLabelText('Enter your email');
    const button = screen.getByRole('button', { name: 'Join' });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.click(button);
    });

    // Flow changed from "#42 on waitlist!" to a check-email verification.
    // Assert the checkEmailTitle appears and the email is interpolated
    // into checkEmailDesc.
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText('Confirmation sent to test@example.com.'),
    ).toBeInTheDocument();
  });

  // NOTE: The earlier "renders footer links" test asserted Privacy Policy
  // and Terms of Service were rendered by WaitlistPage itself. Those
  // links moved to WebsiteLayout in the waitlist rewrite — see commit
  // history on WaitlistPage.tsx. Footer-link coverage now belongs to a
  // WebsiteLayout test, not here. Product-decision deletion.
});
