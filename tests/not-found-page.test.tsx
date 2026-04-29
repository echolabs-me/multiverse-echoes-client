import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NotFoundPage } from '../src/pages/NotFoundPage.tsx';
import enTranslations from '../src/locales/en.json';
import arTranslations from '../src/locales/ar.json';
import zhHansTranslations from '../src/locales/zh-Hans.json';

function makeI18n(locale: 'en' | 'ar' | 'zh-Hans', resources: Record<string, unknown>) {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    resources: { [locale]: { translation: resources } },
    lng: locale,
    interpolation: { escapeValue: false },
  });
  return instance;
}

function renderWith(locale: 'en' | 'ar' | 'zh-Hans', resources: Record<string, unknown>) {
  const testI18n = makeI18n(locale, resources);
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('NotFoundPage status link', () => {
  it('renders the status link in English', () => {
    renderWith('en', enTranslations);
    const link = screen.getByRole('link', {
      name: /check platform status at status\.echolabsme\.com/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
  });

  it('opens the status link in a new tab with safe rel attributes', () => {
    renderWith('en', enTranslations);
    const link = screen.getByRole('link', {
      name: /check platform status/i,
    });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the status link in Arabic (RTL locale) with the translated label and stable URL', () => {
    renderWith('ar', arTranslations);
    const link = screen.getByRole('link', { name: /status\.echolabsme\.com/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
    // The Arabic phrase for "check platform status" appears in the visible text
    expect(link.textContent).toContain('\u062d\u0627\u0644\u0629');
  });

  it('renders the status link in Simplified Chinese (CJK locale)', () => {
    renderWith('zh-Hans', zhHansTranslations);
    const link = screen.getByRole('link', { name: /status\.echolabsme\.com/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
    expect(link.textContent).toContain('\u5e73\u53f0\u72b6\u6001');
  });
});
