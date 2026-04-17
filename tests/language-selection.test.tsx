import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LanguageSelectionPage } from '../src/pages/LanguageSelectionPage.tsx';

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'onboarding.languageSelectionLabel': 'Language selection',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/language']}>
        <LanguageSelectionPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('LanguageSelectionPage', () => {
  it('renders multilingual welcome subtitle', async () => {
    await act(async () => {
      renderPage();
    });
    // Subtitle is hardcoded multilingual: "Choose your language · 选择语言 · भाषा चुनें"
    // See LanguageSelectionPage.tsx — intentional so visitors recognise their
    // language before a locale is chosen.
    const matches = screen.getAllByText(/Choose your language/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the full grid of 20 live language tiles', async () => {
    await act(async () => {
      renderPage();
    });
    // Each tile is a role="option" button. The page was redesigned in
    // commit 7770536 to show only live languages (no "coming soon"
    // placeholders). The live-language list has since grown to 20 — see
    // LanguageSelectionPage.tsx `languages` array.
    const tiles = screen.getAllByRole('option');
    expect(tiles).toHaveLength(20);
  });

  it('English tile is present with aria-label Select English', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole('option', { name: 'Select English' })).toBeInTheDocument();
  });
});
