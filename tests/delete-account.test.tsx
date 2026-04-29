import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DeleteAccountPage } from '../src/pages/DeleteAccountPage.tsx';

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: () => ({ logout: vi.fn() }),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: { deleteAccount: vi.fn() },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'settings.deleteAccount': 'Delete Account',
        'settings.deleteAccountWarning': 'This will permanently delete your account',
        'settings.deleteAccountConfirm': 'Type DELETE to confirm',
        'settings.cancelDeletion': 'Cancel',
        'settings.deleteAccountGrace': '30-day grace period',
        'common.back': 'Back',
        'common.error': 'Error',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/settings/delete']}>
        <DeleteAccountPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('DeleteAccountPage', () => {
  it('renders deletion warning', async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByText('This will permanently delete your account'),
    ).toBeInTheDocument();
  });

  it('renders confirmation input', async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByText('Type DELETE to confirm'),
    ).toBeInTheDocument();
  });

  it('has delete button', async () => {
    await act(async () => {
      renderPage();
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
