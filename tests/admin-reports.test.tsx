import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: {
        display_name: 'Admin',
        account_type: 'Admin',
        subscription_tier: 'Free',
      },
    }),
}));

// One report, in the shape `GET /admin/reports` answers (`ReportResponse`).
vi.mock('../src/lib/api/endpoints.ts', () => ({
  admin: {
    systemHealth: vi.fn().mockResolvedValue({
      tick_number: 0,
      tick_duration_ms: 0,
      ram_usage_mb: 0,
      vram_usage_mb: 0,
      vram_total_mb: 0,
      active_echoes: 0,
      hibernated_echoes: 0,
      total_users: 0,
      total_shards: 0,
    }),
    reports: vi.fn().mockResolvedValue([
      {
        report_id: '0197a000-0000-7000-8000-000000000001',
        reporter_user_id: '0197a000-0000-7000-8000-000000000002',
        target_type: 'Echo',
        target_id: '0197a000-0000-7000-8000-000000000003',
        reason: 'Harassment',
        details: 'Details of the report',
        status: 'Open',
        priority: 1,
        created_at: '2026-09-30T00:00:00Z',
        resolved_at: null,
        resolution: null,
      },
    ]),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'admin.title': 'Admin Dashboard',
        'admin.tabDashboard': 'Dashboard',
        'admin.tabReports': 'Reports',
        // R284.5: the heading and its count are one key. The test text
        // differs from what code once wrote, so a join in code fails here.
        'admin.reportQueueCount': 'Reports waiting: {{number}}',
        'admin.slaDeadline': 'SLA deadline',
        'common.back': 'Back',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

describe('AdminDashboardPage reports', () => {
  it('shows a report with its numeric priority as a P-level, and no date the server does not send', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/admin']}>
          <I18nextProvider i18n={testI18n}>
            <AdminDashboardPage />
          </I18nextProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Reports'));
    });

    expect(screen.getByText('Harassment')).toBeInTheDocument();
    const badge = screen.getByText('P1');
    expect(badge.className).toContain('warning');
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SLA deadline/)).not.toBeInTheDocument();
    expect(screen.getByText('Reports waiting: 1')).toBeInTheDocument();
  });
});
