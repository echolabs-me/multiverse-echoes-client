import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

// Default mock: non-admin user
vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { display_name: 'Test', account_type: 'Standard', subscription_tier: 'Free' } }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  admin: {
    systemHealth: vi.fn().mockResolvedValue({
      tick_number: 100,
      tick_duration_ms: 500,
      ram_usage_mb: 2048,
      vram_usage_mb: 4096,
      active_echoes: 50,
      hibernated_echoes: 10,
      total_users: 200,
      total_shards: 5,
    }),
    alerts: vi.fn().mockResolvedValue([]),
    reports: vi.fn().mockResolvedValue([]),
    users: vi.fn().mockResolvedValue([]),
    shards: vi.fn().mockResolvedValue([]),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'admin.title': 'Admin Dashboard',
        'admin.accessDenied': 'Access Denied',
        'admin.accessDeniedDesc': 'You must be an administrator.',
        'admin.tabDashboard': 'Dashboard',
        'admin.tabReports': 'Reports',
        'admin.tabUsers': 'Users',
        'admin.tabShards': 'Shards',
        'admin.tabControls': 'Controls',
        'common.back': 'Back',
        'common.search': 'Search',
        'common.noResults': 'No results',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <I18nextProvider i18n={testI18n}>
        <AdminDashboardPage />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  it('shows access denied for non-admin users', () => {
    renderAdmin();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('shows back button on access denied', () => {
    renderAdmin();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('shows admin description on access denied', () => {
    renderAdmin();
    expect(screen.getByText('You must be an administrator.')).toBeInTheDocument();
  });
});
