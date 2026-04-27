// Lane H Commit 7 — vitest cases for the ShareTokensView (the 9th
// admin-dashboard tab). Mirrors the admin-moderators.test.tsx pattern:
// mock the AdminContext consumer's endpoint module, render the
// AdminDashboardPage in a router + i18n provider, click the Share
// Tokens tab, and assert against the rendered table + filter inputs +
// revoke modal + WS-event re-fetch listener.
//
// Each `it` block has a Rule #30 invert-break-verify-revert cycle
// noted in the audit body — the assertion is tied to a real surface
// contract, not a tautology.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

// Admin user so AdminDashboardPage actually renders the tab content
// (the access-denied gate triggers for non-admin).
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

const mockListTokens = vi.fn();
const mockGetToken = vi.fn();
const mockRevokeToken = vi.fn();

vi.mock('../src/lib/api/endpoints.ts', () => ({
  // Other tabs are stubbed minimally so tab-switching doesn't crash.
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
  },
  adminShare: {
    listTokens: (...args: unknown[]) => mockListTokens(...args),
    getToken: (...args: unknown[]) => mockGetToken(...args),
    revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
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
        'admin.tabShareTokens': 'Share Tokens',
        'admin.actions': 'Actions',
        'common.back': 'Back',
        'common.confirm': 'Confirm',
        'common.cancel': 'Cancel',
        'common.next': 'Next',
        'common.previous': 'Previous',
        'adminShare.tokens.heading': 'Share Tokens',
        'adminShare.tokens.creatorFilterLabel': 'Creator user ID',
        'adminShare.tokens.creatorFilterPlaceholder': 'e.g. 0193…',
        'adminShare.tokens.statusFilterLabel': 'Status',
        'adminShare.tokens.statusAny': 'Any',
        'adminShare.tokens.statusActive': 'Active',
        'adminShare.tokens.statusRevoked': 'Revoked',
        'adminShare.tokens.statusExpired': 'Expired',
        'adminShare.tokens.applyFilters': 'Apply filters',
        'adminShare.tokens.colToken': 'Token',
        'adminShare.tokens.colCreatedBy': 'Created by',
        'adminShare.tokens.colCreatedAt': 'Created',
        'adminShare.tokens.colExpiresAt': 'Expires',
        'adminShare.tokens.colStatus': 'Status',
        'adminShare.tokens.neverExpires': 'Never',
        'adminShare.tokens.alreadyRevoked': 'Already revoked',
        'adminShare.tokens.revoke': 'Revoke',
        'adminShare.tokens.revokeModalTitle': 'Revoke share token',
        'adminShare.tokens.revokeModalBody': 'Body copy.',
        'adminShare.tokens.revokeReasonLabel': 'Revocation reason',
        'adminShare.tokens.revokeReasonPlaceholder': 'Reason…',
        'adminShare.tokens.revokeConfirm': 'Confirm revoke',
        'adminShare.tokens.revokeSuccess': 'Share token revoked.',
        'adminShare.tokens.revokeError': 'Failed to revoke.',
        'adminShare.tokens.loadError': 'Failed to load.',
        'adminShare.tokens.empty': 'No share tokens.',
        'adminShare.tokens.paginationLabel': 'Showing {{from}}–{{to}} of {{total}}',
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

async function selectShareTokensTab() {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name: 'Share Tokens' }));
  });
}

const SHARE_ROW_ACTIVE = {
  // Distinct first-8-char prefixes for token vs creator so the
  // truncated-display assertions can disambiguate via getByText.
  token: 'aaaaaaaa-1111-4111-8111-000000000001',
  item_kind: 'feed_item' as const,
  item_id: 'cccccccc-1111-4111-8111-000000000099',
  created_by_user_id: 'bbbbbbbb-1111-4111-8111-000000000050',
  include_display_name: false,
  created_at: '2026-04-26T00:00:00Z',
  expires_at: '2026-05-26T00:00:00Z',
  revoked_at: null,
  revoked_by_user_id: null,
  revocation_reason: null,
};

const SHARE_ROW_REVOKED = {
  token: 'dddddddd-2222-4222-8222-000000000002',
  item_kind: 'feed_item' as const,
  item_id: 'ffffffff-2222-4222-8222-000000000099',
  created_by_user_id: 'eeeeeeee-2222-4222-8222-000000000050',
  include_display_name: true,
  created_at: '2026-04-25T00:00:00Z',
  expires_at: '2026-05-25T00:00:00Z',
  revoked_at: '2026-04-26T01:00:00Z',
  revoked_by_user_id: 'ffffffff-2222-4222-8222-000000000999',
  revocation_reason: 'spam',
};

describe('AdminDashboardPage — Share Tokens tab', () => {
  beforeEach(() => {
    mockListTokens.mockReset();
    mockGetToken.mockReset();
    mockRevokeToken.mockReset();
  });

  it('renders the Share Tokens tab in the tab strip', () => {
    mockListTokens.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    renderPage();
    expect(screen.getByRole('tab', { name: 'Share Tokens' })).toBeInTheDocument();
  });

  it('calls listTokens with the default filter on tab activation', async () => {
    mockListTokens.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    renderPage();
    await selectShareTokensTab();
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalled();
    });
    const firstCall = mockListTokens.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall).toMatchObject({
      status: 'any',
      limit: 25,
      offset: 0,
    });
    expect(firstCall.creator_user_id).toBeUndefined();
  });

  it('renders rows with status pills and the revoke action only on active rows', async () => {
    mockListTokens.mockResolvedValue({
      items: [SHARE_ROW_ACTIVE, SHARE_ROW_REVOKED],
      total: 2,
      limit: 25,
      offset: 0,
    });
    renderPage();
    await selectShareTokensTab();
    await screen.findByText('aaaaaaaa…');
    // Both rows render. The Status filter dropdown also contains the
    // strings "Active" and "Revoked" as <option> children, so the
    // total count = 1 badge per row + 1 option per status. Two rows
    // (1 active, 1 revoked) → "Active" appears twice (badge + option),
    // "Revoked" appears twice (badge + option). Assert >= 2 to pin
    // "the badge AND option both render", below the strict-equality
    // form which would break if a future Status enum variant is added.
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Revoked').length).toBeGreaterThanOrEqual(2);
    // Active row carries a Revoke button; revoked row shows the
    // already-revoked label and no Revoke button for it.
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
    expect(screen.getByText('Already revoked')).toBeInTheDocument();
  });

  it('Apply filters re-fetches with the chosen creator + status', async () => {
    mockListTokens.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    renderPage();
    await selectShareTokensTab();
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalledTimes(1);
    });
    const creatorInput = screen.getByLabelText('Creator user ID') as HTMLInputElement;
    fireEvent.change(creatorInput, {
      target: { value: 'bbbbbbbb-3333-4333-8333-000000000050' },
    });
    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'revoked' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    });
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalledTimes(2);
    });
    const lastCall = mockListTokens.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(lastCall).toMatchObject({
      creator_user_id: 'bbbbbbbb-3333-4333-8333-000000000050',
      status: 'revoked',
      offset: 0,
    });
  });

  it('Next button advances offset by the page size', async () => {
    mockListTokens.mockResolvedValue({
      items: [SHARE_ROW_ACTIVE],
      total: 100,
      limit: 25,
      offset: 0,
    });
    renderPage();
    await selectShareTokensTab();
    await screen.findByText('Showing 1–1 of 100');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    });
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalledTimes(2);
    });
    const secondCall = mockListTokens.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(secondCall.offset).toBe(25);
  });

  it('revoke flow: open modal → enter reason → submit → success toast → list refreshes', async () => {
    // First load returns the active row; second load (after revoke)
    // returns a revoked snapshot of the same token.
    mockListTokens
      .mockResolvedValueOnce({
        items: [SHARE_ROW_ACTIVE],
        total: 1,
        limit: 25,
        offset: 0,
      })
      .mockResolvedValueOnce({
        items: [{ ...SHARE_ROW_ACTIVE, revoked_at: '2026-04-27T00:00:00Z' }],
        total: 1,
        limit: 25,
        offset: 0,
      });
    mockRevokeToken.mockResolvedValue({
      token: SHARE_ROW_ACTIVE.token,
      revoked_at: '2026-04-27T00:00:00Z',
      revoked_by_user_id: '01928f4f-1111-4111-8111-000000000001',
      revocation_reason: 'policy violation',
    });

    renderPage();
    await selectShareTokensTab();
    await screen.findByText('aaaaaaaa…');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    });
    // Modal is open.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Revoke share token')).toBeInTheDocument();
    const reasonInput = screen.getByLabelText('Revocation reason') as HTMLTextAreaElement;
    fireEvent.change(reasonInput, { target: { value: 'policy violation' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    });
    expect(mockRevokeToken).toHaveBeenCalledWith(
      SHARE_ROW_ACTIVE.token,
      'policy violation',
    );
    // Success toast surfaces.
    await screen.findByText('Share token revoked.');
    // List refreshes after the revoke (= 2 listTokens calls total).
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalledTimes(2);
    });
  });

  it('revoke confirm is disabled when reason is empty', async () => {
    mockListTokens.mockResolvedValue({
      items: [SHARE_ROW_ACTIVE],
      total: 1,
      limit: 25,
      offset: 0,
    });
    renderPage();
    await selectShareTokensTab();
    await screen.findByText('aaaaaaaa…');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    });
    const confirmBtn = screen.getByRole('button', {
      name: 'Confirm revoke',
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    // The endpoint must NOT have been called.
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it('empty state renders the empty-list message', async () => {
    mockListTokens.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    renderPage();
    await selectShareTokensTab();
    expect(await screen.findByText('No share tokens.')).toBeInTheDocument();
  });

  it('error state renders the load-error message when listTokens rejects', async () => {
    mockListTokens.mockRejectedValue(new Error('network down'));
    renderPage();
    await selectShareTokensTab();
    expect(await screen.findByText('Failed to load.')).toBeInTheDocument();
  });

  it('window me:share-token-revoked event re-triggers the list fetch', async () => {
    mockListTokens.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    renderPage();
    await selectShareTokensTab();
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('me:share-token-revoked', {
          detail: { token: SHARE_ROW_ACTIVE.token },
        }),
      );
    });
    await waitFor(() => {
      expect(mockListTokens).toHaveBeenCalledTimes(2);
    });
  });
});
