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
        // Only key actually used by LanguageSelectionPage.tsx (aria-label on
        // the listbox containers — lines 137 and 159). Heading and subtitle
        // are hardcoded in source, not i18n.
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
  it('renders the MULTIVERSE ECHOES brand heading', async () => {
    await act(async () => {
      renderPage();
    });
    // LanguageSelectionPage.tsx:119-123 renders a hardcoded brand h1. The
    // legacy 'Choose your language' heading is now part of a multilingual
    // subtitle (line 128) and is not a standalone element.
    expect(
      screen.getByRole('heading', { level: 1, name: 'MULTIVERSE ECHOES' }),
    ).toBeInTheDocument();
  });

  it('renders English option', async () => {
    await act(async () => {
      renderPage();
    });
    const englishElements = screen.getAllByText('English');
    expect(englishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the 20 live language tiles', async () => {
    await act(async () => {
      renderPage();
    });
    // LanguageSelectionPage.tsx `const languages: Language[]` currently
    // lists 20 live locales; each renders as a role="option" button via
    // LanguageTile (line 229). Commit 7770536 removed the "coming soon"
    // placeholder mechanism — the page now shows only live languages.
    const tiles = screen.getAllByRole('option');
    expect(tiles).toHaveLength(20);
  });

  // NOTE: The previous "shows coming soon for unavailable languages" test
  // was deleted. Product-decision rationale: commit 7770536 redesigned the
  // page to show only live languages, removing both the placeholder tiles
  // and the "More languages coming soon" tooltip. No source contract
  // remains to assert. Replacement coverage is the 20-tile test above.
});
