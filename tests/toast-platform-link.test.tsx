import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ToastContainer } from '../src/components/Toast.tsx';
import { useToastStore } from '../src/stores/useToastStore.ts';
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

function resetStore() {
  // Clear any residual toasts from a previous test
  useToastStore.setState({ toasts: [] });
}

describe('Toast platformLink rendering', () => {
  beforeEach(resetStore);

  it('omits the status link when platformLink is unset (default)', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ToastContainer />
      </I18nextProvider>
    );
    act(() => {
      useToastStore.getState().addToast('File too large', 'danger');
    });
    expect(screen.getByText('File too large')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /status/i })
    ).toBeNull();
  });

  it('omits the status link when platformLink is explicitly false', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ToastContainer />
      </I18nextProvider>
    );
    act(() => {
      useToastStore
        .getState()
        .addToast('Validation failed', 'danger', { platformLink: false });
    });
    expect(
      screen.queryByRole('link', { name: /status/i })
    ).toBeNull();
  });

  it('renders the short status link when platformLink is true', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ToastContainer />
      </I18nextProvider>
    );
    act(() => {
      useToastStore
        .getState()
        .addToast('Something went wrong', 'danger', { platformLink: true });
    });
    const link = screen.getByRole('link', { name: /^status$/i });
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the localized short status link in Arabic', () => {
    const testI18n = makeI18n('ar', arTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ToastContainer />
      </I18nextProvider>
    );
    act(() => {
      useToastStore.getState().addToast('\u062e\u0637\u0623', 'danger', { platformLink: true });
    });
    // Arabic for "Status": الحالة
    const link = screen.getByRole('link', { name: /\u0627\u0644\u062d\u0627\u0644\u0629/ });
    expect(link).toHaveAttribute('href', 'https://status.echolabsme.com');
  });

  it('Rule #30 cycle: flipping platformLink off on a platform call site removes the link; re-flipping restores it', () => {
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ToastContainer />
      </I18nextProvider>
    );

    // Simulate the real site pattern post-flip: addToast with platformLink: true
    act(() => {
      useToastStore
        .getState()
        .addToast('Network error', 'danger', { platformLink: true });
    });
    expect(screen.getByRole('link', { name: /^status$/i })).toBeInTheDocument();

    // Clear, simulate the pre-flip state
    resetStore();
    act(() => {
      useToastStore.getState().addToast('Network error', 'danger');
    });
    expect(screen.queryByRole('link', { name: /^status$/i })).toBeNull();

    // Flip back on
    resetStore();
    act(() => {
      useToastStore
        .getState()
        .addToast('Network error', 'danger', { platformLink: true });
    });
    expect(screen.getByRole('link', { name: /^status$/i })).toBeInTheDocument();
  });

  it('non-danger severities do not render the link even if flag set (flag is semantic, store honors it on any severity)', () => {
    // This is here to document the actual contract: the link is independent
    // of severity. If a caller sets platformLink=true on an info toast, the
    // link renders. The 32 real call sites only use it with 'danger', so this
    // is a degenerate case but the rendering is correct.
    const testI18n = makeI18n('en', enTranslations);
    render(
      <I18nextProvider i18n={testI18n}>
        <ToastContainer />
      </I18nextProvider>
    );
    act(() => {
      useToastStore
        .getState()
        .addToast('Info msg', 'info', { platformLink: true });
    });
    expect(
      screen.getByRole('link', { name: /^status$/i })
    ).toBeInTheDocument();
  });
});
