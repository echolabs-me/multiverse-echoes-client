import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DowngradeChoicePage } from '../src/pages/DowngradeChoicePage.tsx';

// ── ApiRequestError mock ────────────────────────────────────────
// Re-exported from the mocked client module so the page's
// `err instanceof ApiRequestError` check fires on the mocked rejections.
// Defined via `vi.hoisted` because `vi.mock` factories are hoisted above
// the module's top-level statements; a plain `class ...` declaration
// would not exist yet when the factory runs.

const { MockApiRequestError } = vi.hoisted(() => {
  class MockApiRequestError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { MockApiRequestError };
});

// Partial mock — preserve every real export (configureApi, setTokens,
// request, etc.) so transitive imports like useAuthStore keep working.
// The only symbol we swap is ApiRequestError, and we swap it for a class
// whose `instanceof` check will succeed against the error objects the
// mocked endpoints throw below.
vi.mock('../src/lib/api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api/client.ts')>();
  return {
    ...actual,
    ApiRequestError: MockApiRequestError,
  };
});

// ── Endpoint mocks ──────────────────────────────────────────────

const mockDowngradePending = vi.fn();
const mockPickIncludedShard = vi.fn();
const mockShardDecision = vi.fn();
const mockCommit = vi.fn();
const mockCancel = vi.fn();
const mockShardsGet = vi.fn();

vi.mock('../src/lib/api/endpoints.ts', () => ({
  subscription: {
    downgradePending: (...args: unknown[]) => mockDowngradePending(...args),
    pickIncludedShard: (...args: unknown[]) => mockPickIncludedShard(...args),
    shardDecision: (...args: unknown[]) => mockShardDecision(...args),
    commit: (...args: unknown[]) => mockCommit(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
  },
  shards: {
    get: (...args: unknown[]) => mockShardsGet(...args),
  },
}));

// ── Toast store mock ────────────────────────────────────────────

const mockAddToast = vi.fn();
vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (selector: (s: unknown) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

// ── Navigate mock ───────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── i18n ────────────────────────────────────────────────────────
//
// Keys copied verbatim from client/src/locales/en.json `tiers.downgrade.*`.
// Tests pin the English surface contract — a rename on the page side
// without updating the en.json key would break these assertions.

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.back': 'Back',
        'tiers.downgrade.title': 'Private Shard decisions',
        'tiers.downgrade.loadingPending': 'Checking for pending downgrade…',
        'tiers.downgrade.sessionExpired': 'No pending downgrade decisions.',
        'tiers.downgrade.errorGeneric':
          'Something went wrong loading your downgrade session.',
        'tiers.downgrade.pickIncludedTitle':
          "You're moving from {{oldTier}} to {{newTier}}.",
        'tiers.downgrade.pickIncludedSubtitle':
          'Choose one Private Shard to keep as Included. The others need a decision on the next screen.',
        'tiers.downgrade.shardDecisionTitle':
          "You're moving from {{oldTier}} to {{newTier}}. Decide what happens to each Private Shard that lost its Included slot.",
        'tiers.downgrade.timeoutWarning':
          'You have about {{hours}} hours to decide. Undecided shards are archived automatically when this window closes.',
        'tiers.downgrade.keepingIncluded': '{{shard}} stays Included.',
        'tiers.downgrade.keepIncluded': 'Keep as Included',
        'tiers.downgrade.buyAddon': 'Buy add-on ($4.99/mo)',
        'tiers.downgrade.upgradeBack': 'Upgrade back',
        'tiers.downgrade.archive': 'Archive (30-day retention)',
        'tiers.downgrade.archiveWarning':
          'The shard stops ticking immediately and is deleted after 30 days unless you restore it by re-upgrading or buying the add-on.',
        'tiers.downgrade.commit': 'Commit decisions',
        'tiers.downgrade.cancel': 'Cancel — decide later',
        'tiers.downgrade.successMessage':
          'Your downgrade decisions have been applied.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

// ── Helpers ─────────────────────────────────────────────────────

const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const SHARD_A = '11111111-1111-1111-1111-111111111111';
const SHARD_B = '22222222-2222-2222-2222-222222222222';
const SHARD_C = '33333333-3333-3333-3333-333333333333';

function sessionView(overrides: Record<string, unknown> = {}) {
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  return {
    session_id: SESSION_ID,
    created_at: new Date(Date.now() - 60 * 1000).toISOString(),
    expires_at: expires,
    old_tier: 'GodMode',
    new_tier: 'Creator',
    state: 'AwaitingShardDecisions',
    picked_included_shard_id: null,
    pending_decisions: [
      { shard_id: SHARD_A, decision: 'Undecided' },
      { shard_id: SHARD_B, decision: 'Undecided' },
    ],
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/subscription/downgrade-choice']}>
          <DowngradeChoicePage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  });
  // Flush the microtask queue so the async fetch + shard-name resolution
  // complete before assertions run. Two act()s because there are two
  // sequential awaits inside the component's mount effect.
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function shardWithName(id: string, name: string) {
  return { shard_id: id, name };
}

// ── Reset ───────────────────────────────────────────────────────

beforeEach(() => {
  mockDowngradePending.mockReset();
  mockPickIncludedShard.mockReset();
  mockShardDecision.mockReset();
  mockCommit.mockReset();
  mockCancel.mockReset();
  mockShardsGet.mockReset();
  mockAddToast.mockReset();
  mockNavigate.mockReset();
});

// ── Tests ───────────────────────────────────────────────────────

describe('DowngradeChoicePage', () => {
  it('renders the "no session" empty state when /pending returns 404', async () => {
    mockDowngradePending.mockRejectedValue(
      new MockApiRequestError(404, 'NOT_FOUND', 'No active session'),
    );

    await renderPage();

    expect(
      screen.getByText('No pending downgrade decisions.'),
    ).toBeInTheDocument();
  });

  it('renders an error surface when /pending rejects with non-404', async () => {
    mockDowngradePending.mockRejectedValue(
      new MockApiRequestError(500, 'DB_ERROR', 'Database unreachable'),
    );

    await renderPage();

    expect(screen.getByText('Database unreachable')).toBeInTheDocument();
    expect(screen.getByText('DB_ERROR')).toBeInTheDocument();
  });

  it('renders the PickingIncluded pick-1-of-3 screen with Keep-as-Included buttons', async () => {
    mockDowngradePending.mockResolvedValue(
      sessionView({
        state: 'PickingIncluded',
        pending_decisions: [
          { shard_id: SHARD_A, decision: 'Undecided' },
          { shard_id: SHARD_B, decision: 'Undecided' },
          { shard_id: SHARD_C, decision: 'Undecided' },
        ],
      }),
    );
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );

    await renderPage();

    expect(screen.getByText('Shard-1111')).toBeInTheDocument();
    expect(screen.getByText('Shard-2222')).toBeInTheDocument();
    expect(screen.getByText('Shard-3333')).toBeInTheDocument();
    expect(screen.getAllByText('Keep as Included')).toHaveLength(3);
  });

  it('POSTs pick-included-shard when the user clicks Keep-as-Included', async () => {
    mockDowngradePending.mockResolvedValue(
      sessionView({
        state: 'PickingIncluded',
        pending_decisions: [
          { shard_id: SHARD_A, decision: 'Undecided' },
          { shard_id: SHARD_B, decision: 'Undecided' },
          { shard_id: SHARD_C, decision: 'Undecided' },
        ],
      }),
    );
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );
    mockPickIncludedShard.mockResolvedValue(
      sessionView({
        state: 'AwaitingShardDecisions',
        picked_included_shard_id: SHARD_A,
        pending_decisions: [
          { shard_id: SHARD_B, decision: 'Undecided' },
          { shard_id: SHARD_C, decision: 'Undecided' },
        ],
      }),
    );

    await renderPage();

    const keepButtons = screen.getAllByText('Keep as Included');
    await act(async () => {
      fireEvent.click(keepButtons[0]);
    });

    expect(mockPickIncludedShard).toHaveBeenCalledWith(SESSION_ID, SHARD_A);
  });

  it('renders per-shard 3-button rows (Buy / Upgrade back / Archive) in AwaitingShardDecisions state', async () => {
    mockDowngradePending.mockResolvedValue(sessionView());
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );

    await renderPage();

    // 2 shards × 3 decision buttons = 6 occurrences per label.
    expect(screen.getAllByText('Buy add-on ($4.99/mo)')).toHaveLength(2);
    expect(screen.getAllByText('Upgrade back')).toHaveLength(2);
    expect(screen.getAllByText('Archive (30-day retention)')).toHaveLength(2);
  });

  it('disables Commit decisions while any shard decision is Undecided', async () => {
    mockDowngradePending.mockResolvedValue(sessionView());
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );

    await renderPage();

    const commit = screen.getByText('Commit decisions').closest('button');
    expect(commit).not.toBeNull();
    expect(commit).toBeDisabled();
  });

  it('enables Commit decisions once every shard has a non-Undecided decision', async () => {
    mockDowngradePending.mockResolvedValue(
      sessionView({
        pending_decisions: [
          { shard_id: SHARD_A, decision: 'BuyAddon' },
          { shard_id: SHARD_B, decision: 'Archive' },
        ],
      }),
    );
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );

    await renderPage();

    const commit = screen.getByText('Commit decisions').closest('button');
    expect(commit).not.toBeNull();
    expect(commit).not.toBeDisabled();
  });

  it('POSTs shard-decision and re-renders on per-shard button click', async () => {
    mockDowngradePending.mockResolvedValue(sessionView());
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );
    mockShardDecision.mockResolvedValue(
      sessionView({
        pending_decisions: [
          { shard_id: SHARD_A, decision: 'Archive' },
          { shard_id: SHARD_B, decision: 'Undecided' },
        ],
      }),
    );

    await renderPage();

    const archiveButtons = screen.getAllByText('Archive (30-day retention)');
    await act(async () => {
      fireEvent.click(archiveButtons[0]);
    });

    expect(mockShardDecision).toHaveBeenCalledWith(
      SESSION_ID,
      SHARD_A,
      'Archive',
    );
  });

  it('POSTs commit and navigates to /dashboard on success', async () => {
    mockDowngradePending.mockResolvedValue(
      sessionView({
        pending_decisions: [
          { shard_id: SHARD_A, decision: 'BuyAddon' },
          { shard_id: SHARD_B, decision: 'Archive' },
        ],
      }),
    );
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );
    mockCommit.mockResolvedValue(
      sessionView({
        state: 'Committed',
        pending_decisions: [
          { shard_id: SHARD_A, decision: 'BuyAddon' },
          { shard_id: SHARD_B, decision: 'Archive' },
        ],
      }),
    );

    await renderPage();

    const commitBtn = screen.getByText('Commit decisions');
    await act(async () => {
      fireEvent.click(commitBtn);
    });

    expect(mockCommit).toHaveBeenCalledWith(SESSION_ID);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(mockAddToast).toHaveBeenCalledWith(
      'Your downgrade decisions have been applied.',
      'success',
    );
  });

  it('POSTs cancel and navigates back on Cancel button click', async () => {
    mockDowngradePending.mockResolvedValue(sessionView());
    mockShardsGet.mockImplementation((id: string) =>
      Promise.resolve(shardWithName(id, `Shard-${id.slice(0, 4)}`)),
    );
    mockCancel.mockResolvedValue(
      sessionView({
        state: 'Cancelled',
      }),
    );

    await renderPage();

    const cancel = screen.getByText('Cancel — decide later');
    await act(async () => {
      fireEvent.click(cancel);
    });

    expect(mockCancel).toHaveBeenCalledWith(SESSION_ID);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('uses shard_id as fallback label when shards.get fails', async () => {
    mockDowngradePending.mockResolvedValue(sessionView());
    mockShardsGet.mockRejectedValue(
      new MockApiRequestError(500, 'DB_ERROR', 'upstream'),
    );

    await renderPage();

    // Both UUIDs render as-is since the name fetch failed.
    expect(screen.getByText(SHARD_A)).toBeInTheDocument();
    expect(screen.getByText(SHARD_B)).toBeInTheDocument();
  });
});
