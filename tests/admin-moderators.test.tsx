import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

// Mock admin user so AdminDashboardPage renders tab content.
vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { display_name: 'Admin', account_type: 'Admin', subscription_tier: 'Free' } }),
}));

const mockListModerators = vi.fn();
const mockPromoteModerator = vi.fn();
const mockDemoteModerator = vi.fn();

vi.mock('../src/lib/api/endpoints.ts', () => ({
  admin: {
    // Non-moderator endpoints stubbed so tab-switching doesn't explode.
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
    listModerators: (...args: unknown[]) => mockListModerators(...args),
    promoteModerator: (...args: unknown[]) => mockPromoteModerator(...args),
    demoteModerator: (...args: unknown[]) => mockDemoteModerator(...args),
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
        'admin.tabModerators': 'Moderators',
        'admin.tabShards': 'Shards',
        'admin.tabControls': 'Controls',
        'admin.tabAnalytics': 'Analytics',
        'admin.tabFeedback': 'Feedback',
        'admin.userName': 'Name',
        'admin.userEmail': 'Email',
        'admin.actions': 'Actions',
        'admin.moderators.heading': 'Current Moderators',
        'admin.moderators.promote': 'Promote',
        'admin.moderators.promotePlaceholder': 'User ID to promote to Moderator',
        'admin.moderators.demote': 'Demote',
        'admin.moderators.empty': 'No Moderators yet.',
        'admin.moderators.updatedAt': 'Updated',
        'common.back': 'Back',
        'common.confirm': 'Confirm',
        'common.cancel': 'Cancel',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <I18nextProvider i18n={testI18n}>
        <AdminDashboardPage />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

function selectModeratorsTab() {
  const tab = screen.getByRole('tab', { name: 'Moderators' });
  fireEvent.click(tab);
}

const MOD_ALICE = {
  user_id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@example.com',
  display_name: 'Alice',
  account_type: 'Moderator' as const,
  updated_at: '2026-04-17T12:00:00Z',
};

const MOD_BOB = {
  user_id: '22222222-2222-4222-8222-222222222222',
  email: 'bob@example.com',
  display_name: 'Bob',
  account_type: 'Moderator' as const,
  updated_at: '2026-04-17T13:00:00Z',
};

describe('AdminDashboardPage — Moderators tab', () => {
  beforeEach(() => {
    mockListModerators.mockReset();
    mockPromoteModerator.mockReset();
    mockDemoteModerator.mockReset();
  });

  it('renders the Moderators tab alongside siblings', () => {
    mockListModerators.mockResolvedValue([]);
    renderPage();
    expect(screen.getByRole('tab', { name: 'Moderators' })).toBeInTheDocument();
  });

  it('renders moderator list rows fetched from the API', async () => {
    mockListModerators.mockResolvedValue([MOD_ALICE, MOD_BOB]);
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(mockListModerators).toHaveBeenCalledTimes(1);
  });

  it('shows empty-state message when no moderators exist', async () => {
    mockListModerators.mockResolvedValue([]);
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    expect(await screen.findByText('No Moderators yet.')).toBeInTheDocument();
  });

  it('promote flow calls promoteModerator and refreshes the list on success', async () => {
    mockListModerators.mockResolvedValueOnce([]).mockResolvedValueOnce([MOD_ALICE]);
    mockPromoteModerator.mockResolvedValue(MOD_ALICE);
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    const input = await screen.findByLabelText('User ID to promote to Moderator');
    fireEvent.change(input, { target: { value: MOD_ALICE.user_id } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
    });
    expect(mockPromoteModerator).toHaveBeenCalledWith(MOD_ALICE.user_id);
    expect(mockListModerators).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
  });

  it('promote flow keeps the input value when the API rejects', async () => {
    mockListModerators.mockResolvedValue([]);
    mockPromoteModerator.mockRejectedValue(new Error('boom'));
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    const input = (await screen.findByLabelText(
      'User ID to promote to Moderator',
    )) as HTMLInputElement;
    fireEvent.change(input, { target: { value: MOD_ALICE.user_id } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
    });
    expect(mockPromoteModerator).toHaveBeenCalledWith(MOD_ALICE.user_id);
    expect(input.value).toBe(MOD_ALICE.user_id);
    expect(mockListModerators).toHaveBeenCalledTimes(1);
  });

  it('demote flow requires confirmation and calls demoteModerator', async () => {
    mockListModerators.mockResolvedValueOnce([MOD_ALICE]).mockResolvedValueOnce([]);
    mockDemoteModerator.mockResolvedValue({
      ...MOD_ALICE,
      account_type: 'Standard' as const,
    });
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    await screen.findByText('alice@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Demote' }));
    expect(mockDemoteModerator).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    });
    expect(mockDemoteModerator).toHaveBeenCalledWith(MOD_ALICE.user_id);
    expect(mockListModerators).toHaveBeenCalledTimes(2);
  });

  it('demote flow preserves the row when the API rejects', async () => {
    mockListModerators.mockResolvedValue([MOD_ALICE]);
    mockDemoteModerator.mockRejectedValue(new Error('nope'));
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    await screen.findByText('alice@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Demote' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    });
    expect(mockDemoteModerator).toHaveBeenCalledWith(MOD_ALICE.user_id);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(mockListModerators).toHaveBeenCalledTimes(1);
  });

  it('demote Cancel button closes the confirmation without calling the API', async () => {
    mockListModerators.mockResolvedValue([MOD_ALICE]);
    renderPage();
    await act(async () => {
      selectModeratorsTab();
    });
    await screen.findByText('alice@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Demote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDemoteModerator).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Demote' })).toBeInTheDocument();
  });
});
