import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NotificationsPage } from '../src/pages/NotificationsPage.tsx';

vi.mock('../src/stores/useNotificationStore.ts', () => ({
  useNotificationStore: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    fetchNotifications: vi.fn(),
    markRead: vi.fn(),
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
        'notifications.title': 'Notifications',
        'notifications.preferencesLink': 'Preferences',
        'notifications.empty': 'No notifications',
        'notifications.emptyDesc': 'You are all caught up',
        'common.back': 'Back',
        'common.markAllRead': 'Mark all read',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationsPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('NotificationsPage', () => {
  it('renders notifications title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });
});
