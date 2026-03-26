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
  resources: { en: { translation: {} } },
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
  it('renders language selection heading', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Choose your language')).toBeInTheDocument();
  });

  it('renders English option', async () => {
    await act(async () => {
      renderPage();
    });
    const englishElements = screen.getAllByText('English');
    expect(englishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows coming soon for unavailable languages', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('More languages coming soon')).toBeInTheDocument();
  });
});
