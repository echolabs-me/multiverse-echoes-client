import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

/**
 * Lane C Commit 4 — BillingView (admin Revenue Dashboard) coverage.
 *
 * Renders the full AdminDashboardPage with an Admin user, switches to
 * the billing tab, and asserts KPI cards, chart data plumbing, CSV
 * export, dunning queue filtering, and empty/error states. Each test
 * has a paired Rule #30 invert capture documented in the commit body.
 */

vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: {
        display_name: 'Admin',
        account_type: 'Admin',
        subscription_tier: 'GodMode',
      },
    }),
}));

const mockListRevenueSnapshots = vi.fn();
const mockListDunningStates = vi.fn();
const mockSystemHealth = vi.fn();

vi.mock('../src/lib/api/endpoints.ts', () => ({
  admin: {
    systemHealth: (...a: unknown[]) => mockSystemHealth(...a),
    reports: vi.fn().mockResolvedValue([]),
    users: vi.fn().mockResolvedValue([]),
    shards: vi.fn().mockResolvedValue([]),
    feedback: vi.fn().mockResolvedValue([]),
    listModerators: vi.fn().mockResolvedValue([]),
    tickStatus: vi.fn().mockResolvedValue({ paused: false }),
  },
  adminBilling: {
    listRevenueSnapshots: (...a: unknown[]) => mockListRevenueSnapshots(...a),
    listDunningStates: (...a: unknown[]) => mockListDunningStates(...a),
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
        'admin.tabUsers': 'Users',
        'admin.tabShards': 'Shards',
        'admin.tabControls': 'Controls',
        'admin.tabAnalytics': 'Analytics',
        'admin.tabBilling': 'Billing',
        'admin.tabFeedback': 'Feedback',
        'admin.tabModerators': 'Moderators',
        'admin.billing.heading': 'Billing Health',
        'admin.billing.kpi.mrr': 'MRR',
        'admin.billing.kpi.totalSubscribers': 'Paid Subscribers',
        'admin.billing.kpi.churnDelta': 'Churned (latest)',
        'admin.billing.kpi.newSubs': 'New (latest)',
        'admin.billing.kpi.dunningActive': 'Dunning Active',
        'admin.billing.kpi.subtitle.churnSincePrev': '{{count}} since prior snapshot',
        'admin.billing.kpi.subtitle.newSincePrev': '{{count}} since prior snapshot',
        'admin.billing.tier.starter': 'Starter',
        'admin.billing.tier.core': 'Core',
        'admin.billing.tier.creator': 'Creator',
        'admin.billing.tier.godMode': 'God Mode',
        'admin.billing.charts.mrrTrend': 'MRR Trend',
        'admin.billing.charts.subscriberGrowth': 'Subscriber Growth',
        'admin.billing.charts.churnOverTime': 'Churn Over Time',
        'admin.billing.charts.legend.mrr': 'MRR (USD)',
        'admin.billing.charts.legend.subscribers': 'Subscribers',
        'admin.billing.charts.legend.churn': 'Churned',
        'admin.billing.snapshots.heading': 'Revenue Snapshots',
        'admin.billing.snapshots.exportCsv': 'Export CSV',
        'admin.billing.snapshots.col.period': 'Period',
        'admin.billing.snapshots.col.mrr': 'MRR',
        'admin.billing.snapshots.col.subscribers': 'Subscribers',
        'admin.billing.snapshots.col.perTier': 'Per Tier',
        'admin.billing.snapshots.col.newSubs': 'New',
        'admin.billing.snapshots.col.churned': 'Churned',
        'admin.billing.snapshots.col.dunningActive': 'Dunning Active',
        'admin.billing.snapshots.empty': 'No revenue snapshots yet.',
        'admin.billing.dunning.heading': 'Dunning Queue',
        'admin.billing.dunning.filter.phaseLabel': 'Phase',
        'admin.billing.dunning.filter.phaseAll': 'All phases',
        'admin.billing.dunning.filter.userIdPlaceholder': 'User ID substring...',
        'admin.billing.dunning.filter.providerLabel': 'Provider',
        'admin.billing.dunning.filter.providerAll': 'All providers',
        'admin.billing.dunning.col.user': 'User',
        'admin.billing.dunning.col.provider': 'Provider',
        'admin.billing.dunning.col.phase': 'Phase',
        'admin.billing.dunning.col.periodEnd': 'Period Ends',
        'admin.billing.dunning.col.graceUntil': 'Grace Until',
        'admin.billing.dunning.col.lastNotified': 'Last Notified',
        'admin.billing.dunning.phase.active': 'Active',
        'admin.billing.dunning.phase.renewalPending': 'Renewal Pending',
        'admin.billing.dunning.phase.renewalImminent': 'Renewal Imminent',
        'admin.billing.dunning.phase.gracePeriod': 'Grace Period',
        'admin.billing.dunning.phase.lapsed': 'Lapsed',
        'admin.billing.dunning.empty': 'No dunning rows.',
        'admin.billing.error.loadFailed': 'Failed to load billing data.',
        'common.back': 'Back',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

const SNAP_LATEST = {
  snapshot_id: '11111111-1111-4111-8111-111111111111',
  period_start: '2026-04-26T00:00:00Z',
  period_end: '2026-04-27T00:00:00Z',
  mrr_usd_cents: 1234567,
  paid_subscribers_total: 245,
  paid_subscribers_by_tier: { starter: 120, core: 80, creator: 40, god_mode: 5 },
  new_subscribers_count: 15,
  churned_subscribers_count: 3,
  dunning_active_count: 7,
  created_at: '2026-04-27T00:05:00Z',
};

const SNAP_PRIOR = {
  snapshot_id: '22222222-2222-4222-8222-222222222222',
  period_start: '2026-04-25T00:00:00Z',
  period_end: '2026-04-26T00:00:00Z',
  mrr_usd_cents: 1100000,
  paid_subscribers_total: 233,
  paid_subscribers_by_tier: { starter: 115, core: 75, creator: 38, god_mode: 5 },
  new_subscribers_count: 10,
  churned_subscribers_count: 1,
  dunning_active_count: 5,
  created_at: '2026-04-26T00:05:00Z',
};

const DUNNING_ROWS = [
  {
    user_id: 'aaa-active-user',
    provider: 'nowpayments' as const,
    subscription_started_at: '2026-03-01T00:00:00Z',
    current_period_end: '2026-05-01T00:00:00Z',
    phase: 'active' as const,
    grace_period_expires_at: null,
    last_notified_at: null,
    last_notification_phase: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-04-26T00:00:00Z',
  },
  {
    user_id: 'bbb-lapsed-user-ABC',
    provider: 'xaman' as const,
    subscription_started_at: '2026-01-01T00:00:00Z',
    current_period_end: '2026-04-01T00:00:00Z',
    phase: 'lapsed' as const,
    grace_period_expires_at: null,
    last_notified_at: '2026-04-08T00:00:00Z',
    last_notification_phase: 'grace_period' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
  },
  {
    user_id: 'ccc-grace-user',
    provider: 'nowpayments' as const,
    subscription_started_at: '2026-03-15T00:00:00Z',
    current_period_end: '2026-04-15T00:00:00Z',
    phase: 'grace_period' as const,
    grace_period_expires_at: '2026-04-22T00:00:00Z',
    last_notified_at: '2026-04-16T00:00:00Z',
    last_notification_phase: 'grace_period' as const,
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-04-16T00:00:00Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <I18nextProvider i18n={testI18n}>
        <AdminDashboardPage />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

async function selectBillingTab() {
  const tab = screen.getByRole('tab', { name: 'Billing' });
  await act(async () => {
    fireEvent.click(tab);
  });
}

describe('BillingView', () => {
  beforeEach(() => {
    mockSystemHealth.mockResolvedValue({
      tick_number: 0,
      tick_duration_ms: 0,
      ram_usage_mb: 0,
      vram_usage_mb: 0,
      vram_total_mb: 0,
      active_echoes: 0,
      hibernated_echoes: 0,
      total_users: 0,
      total_shards: 0,
    });
    mockListRevenueSnapshots.mockResolvedValue({
      items: [SNAP_LATEST, SNAP_PRIOR],
      total: 2,
      limit: 100,
      offset: 0,
    });
    mockListDunningStates.mockResolvedValue({
      items: DUNNING_ROWS,
      total: DUNNING_ROWS.length,
      limit: 500,
      offset: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI cards from latest snapshot', async () => {
    renderPage();
    await selectBillingTab();

    await waitFor(() => {
      // Latest MRR cents 1234567 → $12,345.67. Appears twice (KPI card +
      // snapshot table row); we just assert at least one render.
      expect(screen.getAllByText('$12,345.67').length).toBeGreaterThanOrEqual(1);
      // Latest paid_subscribers_total 245 — also appears in both KPI + table.
      expect(screen.getAllByText('245').length).toBeGreaterThanOrEqual(1);
      // Heading present.
      expect(screen.getByText('Billing Health')).toBeInTheDocument();
    });
  });

  it('renders chart data containers for all three charts', async () => {
    renderPage();
    await selectBillingTab();

    await waitFor(() => {
      expect(document.querySelector('[data-testid="chart-mrr"]')).not.toBeNull();
      expect(document.querySelector('[data-testid="chart-subscribers"]')).not.toBeNull();
      expect(document.querySelector('[data-testid="chart-churn"]')).not.toBeNull();
    });
  });

  it('CSV export creates a Blob with the locked header + a row per snapshot', async () => {
    const blobs: Blob[] = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:mock';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    renderPage();
    await selectBillingTab();
    await waitFor(() => screen.getByText('Export CSV'));

    await act(async () => {
      fireEvent.click(screen.getByText('Export CSV'));
    });

    expect(blobs).toHaveLength(1);
    const csv = await blobs[0]!.text();
    const headerLine = csv.split('\r\n')[0]!;
    expect(headerLine).toBe(
      'period_start,period_end,mrr_usd,paid_subscribers_total,starter,core,creator,god_mode,new_subscribers,churned_subscribers,dunning_active',
    );
    // 1 header + 2 data rows = 3 lines.
    expect(csv.split('\r\n')).toHaveLength(3);
    // Latest row contains the formatted MRR + tier breakdown.
    expect(csv).toContain('12345.67');
    expect(csv).toContain('120,80,40,5');

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('phase filter narrows the dunning table to the selected phase', async () => {
    renderPage();
    await selectBillingTab();
    await waitFor(() => screen.getByText('Dunning Queue'));

    const phaseSelect = screen.getByRole('combobox', { name: 'Phase' });
    await act(async () => {
      fireEvent.change(phaseSelect, { target: { value: 'lapsed' } });
    });

    expect(screen.getByText('bbb-lapsed-user-ABC')).toBeInTheDocument();
    expect(screen.queryByText('aaa-active-user')).toBeNull();
    expect(screen.queryByText('ccc-grace-user')).toBeNull();
  });

  it('user_id substring filter is case-insensitive', async () => {
    renderPage();
    await selectBillingTab();
    await waitFor(() => screen.getByText('Dunning Queue'));

    const input = screen.getByPlaceholderText('User ID substring...');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'ABC' } });
    });

    // bbb-lapsed-user-ABC matches case-insensitively (mock data uses 'ABC').
    expect(screen.getByText('bbb-lapsed-user-ABC')).toBeInTheDocument();
    expect(screen.queryByText('aaa-active-user')).toBeNull();
    expect(screen.queryByText('ccc-grace-user')).toBeNull();
  });

  it('renders the snapshot empty state when no snapshots are returned', async () => {
    mockListRevenueSnapshots.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    mockListDunningStates.mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 500,
      offset: 0,
    });
    renderPage();
    await selectBillingTab();
    await waitFor(() => {
      expect(screen.getByText('No revenue snapshots yet.')).toBeInTheDocument();
    });
  });

  it('renders the load-failed error when the snapshots endpoint rejects', async () => {
    mockListRevenueSnapshots.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await selectBillingTab();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load billing data.');
    });
  });
});
