import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ErrorBoundary } from '../src/components/ErrorBoundary.tsx';
import enTranslations from '../src/locales/en.json';
import arTranslations from '../src/locales/ar.json';

function makeI18n(locale: 'en' | 'ar', resources: Record<string, unknown>) {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    resources: { [locale]: { translation: resources } },
    lng: locale,
    interpolation: { escapeValue: false },
  });
  return instance;
}

function Crash(): JSX.Element {
  throw new Error('boom');
}

function SafeChild(): JSX.Element {
  return <div>safe-child</div>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught errors to console.error in tests — silence the noise
    // but keep the spy so we can assert the ErrorBoundary's own log still fires.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error thrown', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ErrorBoundary>
          <SafeChild />
        </ErrorBoundary>
      </I18nextProvider>
    );
    expect(screen.getByText('safe-child')).toBeInTheDocument();
  });

  it('renders ErrorFallback with i18n title + body + reload button + status link when child throws', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>
      </I18nextProvider>
    );

    // Title + body from errors.appCrashed
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/unexpected error.*reloading.*platform status page/i)
    ).toBeInTheDocument();

    // Reload button
    const reload = screen.getByRole('button', { name: /^Reload$/ });
    expect(reload).toBeInTheDocument();

    // Status link — new tab, safe rel attrs, correct URL
    const link = screen.getByRole('link', { name: /check platform status/i });
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('reload button calls window.location.reload', () => {
    const reloadSpy = vi.fn();
    const origLocation = window.location;
    // @ts-expect-error — happy-dom allows replacing location for test
    delete window.location;
    // @ts-expect-error — minimal Location stub
    window.location = { ...origLocation, reload: reloadSpy };

    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>
      </I18nextProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /^Reload$/ }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // Restore
    // @ts-expect-error — restore
    window.location = origLocation;
  });

  it('logs full error + componentStack to console.error (not the UI)', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>
      </I18nextProvider>
    );

    // Our [ErrorBoundary] log fired with the actual error object
    const ourLog = consoleErrorSpy.mock.calls.find(
      (call) => call[0] === '[ErrorBoundary]'
    );
    expect(ourLog).toBeDefined();
    expect(ourLog?.[1]).toBeInstanceOf(Error);
    expect((ourLog?.[1] as Error).message).toBe('boom');

    // UI does NOT surface the raw message "boom"
    expect(screen.queryByText(/boom/i)).toBeNull();
  });

  it('renders fallback in Arabic (RTL) locale', () => {
    const testI18n = makeI18n('ar', arTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>
      </I18nextProvider>
    );

    // Arabic "Reload" (إعادة تحميل)
    expect(
      screen.getByRole('button', {
        name: /\u0625\u0639\u0627\u062f\u0629/,
      })
    ).toBeInTheDocument();
    // Status link URL stable in Latin script across all locales
    const link = screen.getByRole('link', { name: /status\.echolabsme\.com/ });
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
  });
});

describe('ErrorBoundary — Rule #30 cycle: without the wrap, default React crash resumes', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('crashes (throws) when ErrorBoundary is removed', () => {
    // Without ErrorBoundary wrapping, React propagates the throw upward.
    // @testing-library/render rethrows synchronously.
    expect(() => {
      render(<Crash />);
    }).toThrow('boom');

    // Re-add the wrap — fallback UI returns.
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>
      </I18nextProvider>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
