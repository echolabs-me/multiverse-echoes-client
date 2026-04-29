import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DowngradeConfirmPage } from '../src/pages/DowngradeConfirmPage.tsx';
import { DowngradeChoicePage } from '../src/pages/DowngradeChoicePage.tsx';

// ME-MIS-001 §5.2 Surface C — pre-confirm informed-consent screen.
// Verifies:
//   (a) the consent page renders with server-sourced echo-count delta
//       math (not hardcoded tier tables) and a gated Proceed button;
//   (b) the /subscription/downgrade-choice route redirects back to
//       /subscription/downgrade-confirm when the `?consented=1` query
//       param is missing;
//   (c) all three inputs (session, tierLimits, echoList) are
//       sequenced before the math computes — a stale or empty echo
//       list cannot surface an incorrect "0 will be hibernated" on a
//       consent screen whose whole purpose is correct enumeration.

// `session` is kept `unknown` so the tests can override individual
// fields (old_tier, new_tier, pending_decisions) without retyping
// the whole DTO.
const mocks = vi.hoisted(() => {
  return {
    session: {
      session_id: 's1',
      created_at: '2026-04-20T00:00:00Z',
      expires_at: '2026-04-21T00:00:00Z',
      old_tier: 'Core',
      new_tier: 'Starter',
      state: 'PickingIncluded',
      picked_included_shard_id: null,
      pending_decisions: [
        { shard_id: 'sh-1', decision: 'Undecided' },
        { shard_id: 'sh-2', decision: 'Undecided' },
      ],
    } as unknown,
    tierLimits: [
      { tier: 'Free', echo_count_limit: 1, conversation_daily_limit: 1, influence_daily_limit: 2, nudge_daily_limit: 1, private_shards_included: 0, follow_cap: 5, api_requests_per_minute: 10, api_key_limit: 0 },
      { tier: 'Starter', echo_count_limit: 3, conversation_daily_limit: 5, influence_daily_limit: 4, nudge_daily_limit: 3, private_shards_included: 0, follow_cap: 20, api_requests_per_minute: 30, api_key_limit: 1 },
      { tier: 'Core', echo_count_limit: 5, conversation_daily_limit: 10, influence_daily_limit: 6, nudge_daily_limit: 10, private_shards_included: 0, follow_cap: 50, api_requests_per_minute: 60, api_key_limit: 3 },
    ] as unknown[],
    echoList: [] as unknown[],
    // Controls the `echoes.list()` mock. `'success'` returns
    // `mocks.echoList`. `'reject'` throws — the trigger for the
    // retryable error surface the Copilot amend mandates.
    echoListMode: 'success' as 'success' | 'reject',
    shardsGet: async (id: string) => ({ shard_id: id, name: `Shard ${id}`, shard_type: 'Private', status: 'Active', description: '', current_active_count: 0, current_hibernated_count: 0, max_active_echoes: 5, banner_image: null, created_at: '2026-01-01T00:00:00Z', content_locale: 'en', provisioning_type: 'Included', archived_at: null, archive_expires_at: null }),
    addToast: () => undefined,
  };
});

vi.mock('../src/lib/api/endpoints.ts', () => ({
  subscription: {
    downgradePending: async () => mocks.session,
    tierLimits: async () => mocks.tierLimits,
    pickIncludedShard: vi.fn(),
    shardDecision: vi.fn(),
    commit: vi.fn(),
    cancel: vi.fn(),
  },
  echoes: {
    list: async () => {
      if (mocks.echoListMode === 'reject') {
        throw new Error('stub echoes.list failure');
      }
      return mocks.echoList;
    },
  },
  shards: {
    get: (id: string) => mocks.shardsGet(id),
  },
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (selector?: (s: { addToast: typeof mocks.addToast }) => unknown) => {
    const state = { addToast: mocks.addToast };
    return selector ? selector(state) : state;
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.back': 'Back',
        'tiers.deletion.consent.title': 'Confirm your downgrade',
        'tiers.deletion.consent.loading': 'Loading your downgrade details…',
        'tiers.deletion.consent.noPending': 'No pending downgrade decisions.',
        'tiers.deletion.consent.errorGeneric':
          'Something went wrong loading your downgrade details.',
        'tiers.deletion.consent.retry': 'Retry',
        'tiers.deletion.consent.summary':
          "You're moving from {{oldTier}} to {{newTier}}. Here's what will happen when you commit.",
        'tiers.deletion.consent.echoesHeader': 'Echoes',
        'tiers.deletion.consent.echoesHibernateCount':
          '{{count}} of your {{total}} Echo(es) will be hibernated.',
        'tiers.deletion.consent.echoesNoneHibernated':
          'No Echoes will be hibernated. All {{total}} fit under the {{newTier}} cap of {{cap}}.',
        'tiers.deletion.consent.echoesDeletion':
          'Hibernated Echoes are permanently deleted 90 days after commit unless you wake them by freeing a slot or upgrade back before then.',
        'tiers.deletion.consent.shardsHeader': 'Private Shards',
        'tiers.deletion.consent.shardsDecisionCount':
          '{{count}} Private Shard(s) need a decision on the next screen: Buy as add-on, upgrade back, or archive.',
        'tiers.deletion.consent.shardsNoneToDecide':
          'No Private Shard decisions required on this downgrade.',
        'tiers.deletion.consent.shardsDeletion':
          'Shards you choose to archive are permanently deleted 90 days after commit unless you restore them by buying the add-on or upgrading back.',
        'tiers.deletion.consent.checkboxLabel':
          'I understand these changes and that hibernated Echoes and archived Shards will be permanently deleted after 90 days unless I act.',
        'tiers.deletion.consent.proceed': 'Proceed to decisions',
        'tiers.deletion.consent.cancel': 'Cancel downgrade',
        // Supporting DowngradeChoicePage keys the redirect test reaches.
        'tiers.downgrade.title': 'Private Shard decisions',
        'tiers.downgrade.loadingPending': 'Loading…',
        'tiers.downgrade.errorGeneric': 'Error',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderConfirm() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/subscription/downgrade-confirm']}>
        <Routes>
          <Route
            path="/subscription/downgrade-confirm"
            element={<DowngradeConfirmPage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function renderChoiceWithoutConsent() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/subscription/downgrade-choice']}>
        <Routes>
          <Route
            path="/subscription/downgrade-confirm"
            element={<div data-testid="landed-on-confirm" />}
          />
          <Route
            path="/subscription/downgrade-choice"
            element={<DowngradeChoicePage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('DowngradeConfirmPage — ME-MIS-001 §5.2 Surface C', () => {
  beforeEach(() => {
    mocks.echoList = [];
    mocks.echoListMode = 'success';
  });

  it('renders the excess-Echo count when the user has more active Echoes than the new tier cap', async () => {
    // Core → Starter (cap drops 5 → 3). Four active echoes =>
    // 4 - 3 = 1 will be hibernated on commit.
    mocks.echoList = [
      { echo_id: 'a', hibernated_at: null },
      { echo_id: 'b', hibernated_at: null },
      { echo_id: 'c', hibernated_at: null },
      { echo_id: 'd', hibernated_at: null },
    ];
    const result = await act(async () => renderConfirm());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const echoesSection = await result.findByText(
      /1 of your 4 Echo\(es\) will be hibernated/,
    );
    expect(echoesSection).toBeInTheDocument();
    expect(
      result.getByText(/2 Private Shard\(s\) need a decision/),
    ).toBeInTheDocument();
  });

  it('renders the zero-hibernation message when current Echoes fit the new tier cap', async () => {
    mocks.echoList = [
      { echo_id: 'a', hibernated_at: null },
      { echo_id: 'b', hibernated_at: null },
    ];
    const result = await act(async () => renderConfirm());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const zero = await result.findByText(
      /No Echoes will be hibernated. All 2 fit under the Starter cap of 3/,
    );
    expect(zero).toBeInTheDocument();
  });

  it('gates the Proceed button behind the consent checkbox', async () => {
    mocks.echoList = [{ echo_id: 'a', hibernated_at: null }];
    const result = await act(async () => renderConfirm());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const proceed = result.getByRole('button', {
      name: 'Proceed to decisions',
    });
    expect(proceed).toBeDisabled();
    const checkbox = result.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(proceed).not.toBeDisabled();
  });

  // ── Stale-echoList race coverage (amend 3) ────────────────────

  it('stays on loading until echoes.list() resolves; no zero-hibernation flash', async () => {
    // Deferred `echoes.list()` — does not resolve until the test
    // explicitly releases it. Confirms the `ready` state is reached
    // ONLY when all three inputs (session, tierLimits, echoList) have
    // resolved — never on the session+tierLimits pair alone with an
    // empty echoList, which is the exact regression Copilot flagged.
    let releaseEchoList: (v: unknown[]) => void = () => {};
    const deferred = new Promise<unknown[]>((resolve) => {
      releaseEchoList = resolve;
    });
    const originalMode = mocks.echoListMode;
    // Temporarily swap the mock behaviour for this test.
    mocks.echoListMode = 'success';
    const savedEchoList = mocks.echoList;
    // Ensure the fetch returns the deferred promise by routing
    // through the mock's default success path but with echoList
    // replaced by an awaited placeholder. The cleanest route is to
    // override echoList with a thenable: we can't, because Promise
    // flattens. Instead we hijack the echoList reference during the
    // test and resolve with the real list.
    mocks.echoList = [];
    // Start the render; echoes.list() will resolve immediately with
    // `[]`, so the component races ahead to `ready` unless we
    // replace the `list` mock with the deferred variant. Do that by
    // reassigning the exported mock's .list via the module record.
    const endpointsModule = await import('../src/lib/api/endpoints.ts');
    const originalList = endpointsModule.echoes.list;
    (endpointsModule.echoes as { list: () => Promise<unknown[]> }).list =
      () => deferred;

    const result = await act(async () => renderConfirm());
    // Flush everything except the deferred echoes.list resolution.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Session + tierLimits are in; echoList is still pending. The
    // ONLY acceptable state is `loading` — no ready/zero flash.
    expect(result.getByText('Loading your downgrade details…')).toBeInTheDocument();
    expect(
      result.queryByText(/Echoes will be hibernated/i),
    ).not.toBeInTheDocument();

    // Now release the deferred list resolution with the real data.
    await act(async () => {
      releaseEchoList([
        { echo_id: 'a', hibernated_at: null },
        { echo_id: 'b', hibernated_at: null },
        { echo_id: 'c', hibernated_at: null },
        { echo_id: 'd', hibernated_at: null },
      ]);
      await new Promise((r) => setTimeout(r, 0));
    });

    // Now the real count renders — 4 active, Starter cap 3 → 1.
    expect(
      await result.findByText(/1 of your 4 Echo\(es\) will be hibernated/),
    ).toBeInTheDocument();

    // Restore.
    (endpointsModule.echoes as { list: () => Promise<unknown[]> }).list =
      originalList;
    mocks.echoList = savedEchoList;
    mocks.echoListMode = originalMode;
  });

  it('renders the retryable error surface when echoes.list() fails', async () => {
    mocks.echoListMode = 'reject';
    const result = await act(async () => renderConfirm());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const alert = await result.findByRole('alert');
    expect(alert.textContent).toContain(
      'Something went wrong loading your downgrade details.',
    );
    // The retry button is rendered (non-terminal error).
    expect(result.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // The zero-hibernation success copy must NOT render. This is the
    // exact Copilot regression: the old silent-`void fetchEchoes()`
    // path would surface "0 Echoes will be hibernated" here.
    expect(
      result.queryByText(/Echoes will be hibernated/i),
    ).not.toBeInTheDocument();
  });

  it('recovers to the correct count when Retry succeeds', async () => {
    mocks.echoListMode = 'reject';
    mocks.echoList = [
      { echo_id: 'a', hibernated_at: null },
      { echo_id: 'b', hibernated_at: null },
      { echo_id: 'c', hibernated_at: null },
      { echo_id: 'd', hibernated_at: null },
    ];
    const result = await act(async () => renderConfirm());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await result.findByRole('alert')).toBeInTheDocument();
    // Flip the mock so the retry succeeds, click, wait.
    mocks.echoListMode = 'success';
    const retry = result.getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.click(retry);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      await result.findByText(/1 of your 4 Echo\(es\) will be hibernated/),
    ).toBeInTheDocument();
  });
});

describe('DowngradeChoicePage — consent gate', () => {
  it('redirects to /downgrade-confirm when the consented query param is missing', async () => {
    const result = await act(async () => renderChoiceWithoutConsent());
    // Navigate.replace lands on the confirm route immediately; the
    // placeholder at that route confirms the redirect fired.
    expect(
      result.queryByTestId('landed-on-confirm'),
    ).toBeInTheDocument();
    expect(
      result.queryByRole('heading', { level: 1, name: 'Private Shard decisions' }),
    ).not.toBeInTheDocument();
  });
});
