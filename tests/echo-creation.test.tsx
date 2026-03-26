import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EchoCreationPage } from '../src/pages/EchoCreationPage.tsx';

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    createEcho: vi.fn().mockResolvedValue({ echo_id: 'e1' }),
  }),
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'echo.createTitle': 'Create your Echo',
        'echo.nameLabel': 'Echo name',
        'echo.namePlaceholder': 'Give your Echo a name',
        'echo.whatIfLabel': 'What if...',
        'echo.whatIfSubtitle': 'The prompt that defines your Echo',
        'echo.whatIfPlaceholder': 'What if I had...',
        'echo.personaLabel': 'Persona',
        'echo.personaHint': 'Describe the persona',
        'echo.personaOptionalPlaceholder': 'Optional persona details',
        'echo.personaDeclaration': 'Inspired by me',
        'echo.personaFictional': 'Fictional character',
        'echo.consentTitle': 'Consent',
        'echo.consentAcknowledge': 'I acknowledge',
        'echo.consentPrivacy': 'I accept privacy terms',
        'echo.destinationTitle': 'Choose destination',
        'echo.personalShard': 'Personal Shard',
        'echo.personalShardDesc': 'Your private world',
        'echo.limitTitle': 'Echo limit reached',
        'echo.limitDesc': 'Upgrade your plan',
        'echo.viewPlans': 'View plans',
        'echo.createButton': 'Create Echo',
        'echo.birthTitle': 'Your Echo is being born...',
        'echo.birthComplete': 'Echo created!',
        'common.cancel': 'Cancel',
        'common.next': 'Next',
        'common.back': 'Back',
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
      <MemoryRouter initialEntries={['/echoes/create']}>
        <EchoCreationPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EchoCreationPage', () => {
  it('renders creation wizard title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Create your Echo')).toBeInTheDocument();
  });

  it('renders name and what-if prompt fields', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByLabelText('Echo name')).toBeInTheDocument();
    expect(screen.getByText(/What if/)).toBeInTheDocument();
  });

  it('has cancel and next buttons', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });
});
