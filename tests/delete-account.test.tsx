import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DeleteAccountPage } from '../src/pages/DeleteAccountPage.tsx';
import { account } from '../src/lib/api/endpoints.ts';

// The mock applies the selector and answers `getState` and `subscribe`, as
// the store does; it never changes, so it notifies nobody (R296.1).
vi.mock('../src/stores/useAuthStore.ts', () => {
  const state = { user: null, logout: vi.fn() };
  return {
    useAuthStore: Object.assign(
      (selector: (s: typeof state) => unknown) => selector(state),
      { getState: () => state, subscribe: () => () => {} },
    ),
  };
});

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

  it('two clicks on Delete send one deletion (R296.2)', async () => {
    vi.mocked(account.deleteAccount).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      renderPage();
    });
    fireEvent.change(screen.getByPlaceholderText('DELETE'), {
      target: { value: 'DELETE' },
    });
    const del = screen.getByRole('button', { name: 'Delete Account' });

    // Two clicks are two events, and React handles the first one's state
    // update before the second (ME_REPORT_66), so the second reaches a
    // disabled button. Each fireEvent is its own act, as each click is its
    // own event; two clicks inside one act would hold the first update back
    // until both had run, which no browser does.
    fireEvent.click(del);
    fireEvent.click(del);
    await act(async () => {});
    expect(account.deleteAccount).toHaveBeenCalledTimes(1);
    expect(del).toBeDisabled();
  });

  it('has delete button', async () => {
    await act(async () => {
      renderPage();
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
