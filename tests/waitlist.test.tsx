import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { WaitlistPage } from '../src/pages/WaitlistPage.tsx';

// WaitlistPage.tsx:32-54 calls raw fetch(WAITLIST_API + '/waitlist/count')
// and fetch(WAITLIST_API + '/waitlist') directly — NOT endpoints.ts. Mock
// globalThis.fetch so the page sees 200 responses and its useEffect/submit
// paths complete.
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

// Only keys actually used by WaitlistPage.tsx today (grep-verified against
// source). Earlier "heroTitle / howItWorksTitle / step{1,2,3}{Title,Desc} /
// socialProof* / confirmationTitle / referralHint / diaryPreview* /
// privacyPolicy / termsOfService / footerTagline" keys were defined in the
// old bundle but are not referenced by the current page.
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.loading': 'Loading...',
        'auth.joinWaitlist': 'Join the Waitlist',
        'waitlist.heroSubtitle': 'Create an AI Echo of yourself.',
        'waitlist.alreadyWaiting': 'people already waiting',
        'waitlist.emailPlaceholder': 'Enter your email',
        'waitlist.joinButton': 'Join the waitlist',
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
  // WaitlistPage.tsx:16 imports Helmet from 'react-helmet-async'. Without a
  // HelmetProvider wrapper the component renders but throws in strict mode
  // and leaks warnings; the provider is the same piece of plumbing the real
  // app uses.
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
  it('renders hero h1 with auth.joinWaitlist and the subtitle', async () => {
    await act(async () => {
      renderPage();
    });
    // WaitlistPage.tsx:133-135 renders <h1>{t('auth.joinWaitlist')}</h1>.
    // The previous 'waitlist.heroTitle' key was removed in the page rewrite.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Join the Waitlist' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create an AI Echo of yourself.')).toBeInTheDocument();
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

  it('shows the what-to-expect section with three steps', async () => {
    await act(async () => {
      renderPage();
    });
    // Source <section> with t('waitlist.expectTitle') + expectStep1-3
    // (WaitlistPage.tsx:196-219) replaces the legacy "How it works" section.
    expect(screen.getByText('What to expect')).toBeInTheDocument();
    expect(screen.getByText('Create your persona.')).toBeInTheDocument();
    expect(
      screen.getByText('Watch your Echo live autonomously.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Share the stories from your Echo's diary."),
    ).toBeInTheDocument();
  });

  it('shows the social-proof count banner with live number and label', async () => {
    await act(async () => {
      renderPage();
    });
    // Count banner (WaitlistPage.tsx:142-147) renders the number via
    // toLocaleString() and the label via t('waitlist.alreadyWaiting')
    // as separate elements (not a single interpolated string like the
    // legacy 'socialProofCount' key).
    expect(await screen.findByText('847')).toBeInTheDocument();
    expect(screen.getByText('people already waiting')).toBeInTheDocument();
  });

  // NOTE: empty-input validation is enforced by HTML5 <input required> + the
  // page's own length < 5 check at WaitlistPage.tsx:87. happy-dom blocks
  // empty-form submit before reaching the page's handler, so this test
  // covers only the too-short path. End-to-end empty-form coverage belongs
  // in a Playwright/real-browser test suite if/when that exists.
  it('shows validation error for too-short email', async () => {
    await act(async () => {
      renderPage();
    });
    const input = screen.getByLabelText('Enter your email');
    const button = screen.getByRole('button', { name: 'Join the waitlist' });
    // 'a@b' satisfies HTML5 type="email" (has '@') but fails the page's
    // own `trimmed.length < 5` check → sets waitlist.invalidEmail error.
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
    const button = screen.getByRole('button', { name: 'Join the waitlist' });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.click(button);
    });

    // Success flow changed from position/referral (the old 'confirmationTitle'
    // "#N on the waitlist" copy) to magic-link check-email. Source renders
    // t('waitlist.checkEmailTitle') + checkEmailDesc with the email
    // interpolated — see WaitlistPage.tsx:186-191.
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText('Confirmation sent to test@example.com.'),
    ).toBeInTheDocument();
  });

  // NOTE: The previous 'renders footer links' test asserted 'Privacy Policy'
  // + 'Terms of Service' text. Those strings match neither WebsiteFooter
  // (which renders 'Privacy' and 'Terms' via website.footer.* keys) nor the
  // render tree the test set up (which never included WebsiteLayout). The
  // test was non-functional in-place. Footer-link coverage migrated to
  // client/tests/website-layout.test.tsx in this same commit, scoped to
  // the component that actually owns the contract.
});
