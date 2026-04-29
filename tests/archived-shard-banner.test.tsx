import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ShardViewPage } from '../src/pages/ShardViewPage.tsx';
import { ShardBrowserPage } from '../src/pages/ShardBrowserPage.tsx';

// ME-MIS-001 §5.2 Surface B — archived Shard banner. Covers the two
// render sites: ShardViewPage header banner and the ShardBrowserPage
// grid chip. Uses server-provided `archive_expires_at` for the date
// (ShardSummary::archive_expires_at in crates/api/src/routes/shards.rs).

const archivedShard = {
  shard_id: 's-archived',
  name: 'Lost Atlantis',
  shard_type: 'Private',
  status: 'Archived',
  description: 'A sunken story.',
  era: 'Modern',
  region: 'Mediterranean',
  tags: [],
  current_active_count: 0,
  current_hibernated_count: 0,
  max_active_echoes: 5,
  max_hibernated_echoes: 5,
  allows_travel: false,
  tick_rate_modifier: 1,
  banner_image: null,
  created_at: '2026-01-01T00:00:00Z',
  content_locale: 'en',
  provisioning_type: 'Archived',
  archived_at: '2026-02-01T00:00:00Z',
  archive_expires_at: '2026-05-02T00:00:00Z',
};

const activeShard = {
  ...archivedShard,
  shard_id: 's-active',
  name: 'Living Rome',
  status: 'Active',
  provisioning_type: 'Included',
  archived_at: null,
  archive_expires_at: null,
};

// ── Test wiring ───────────────────────────────────────────────────

// Every function/collection identity must remain stable across
// renders — the pages' initial-load useEffects depend on
// `fetchShard`, `fetchEchoes`, `fetchShards` identity (they appear in
// the effect deps arrays). A fresh `vi.fn()` on every hook invocation
// flips those identities every render, causing the effect to re-run,
// setState, re-render, forever — manifests as a 5 s test timeout.
// Pattern matches the `stableFetchX` conventions in
// `echo-detail.test.tsx`.
//
// `vi.mock` is hoisted above imports, so the factories must reference
// functions created via `vi.hoisted` (which is hoisted together with
// the mocks) rather than module-scope `const` bindings. Without
// `vi.hoisted` the factory executes before the consts are
// initialised, raising
// `ReferenceError: Cannot access 'stableShardEchoes' before init`.
const mocks = vi.hoisted(() => {
  return {
    activeShard: null as unknown,
    shardList: [] as unknown[],
    fetchShard: async () => undefined,
    fetchShards: async () => undefined,
    fetchEchoes: async () => undefined,
    addToast: () => undefined,
    shardEchoes: async () => [] as unknown[],
    echoTravel: () => undefined,
    feedsShard: async () => ({ data: [] as unknown[], next_cursor: null }),
    channelsList: async () => [] as unknown[],
    channelsMessages: async () => [] as unknown[],
  };
});

vi.mock('../src/stores/useShardStore.ts', () => ({
  useShardStore: () => ({
    activeShard: mocks.activeShard,
    fetchShard: mocks.fetchShard,
    shardList: mocks.shardList,
    isLoading: false,
    fetchShards: mocks.fetchShards,
  }),
}));

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    echoList: [],
    fetchEchoes: mocks.fetchEchoes,
  }),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  shards: { echoes: mocks.shardEchoes },
  echoes: { travel: mocks.echoTravel },
  feeds: { shard: mocks.feedsShard },
  channels: {
    list: mocks.channelsList,
    messages: mocks.channelsMessages,
  },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

// ShardEnvironment3D renders Three.js under happy-dom and crashes.
vi.mock('../src/components/ShardEnvironment3D.tsx', () => ({
  ShardEnvironment3D: () => <div data-testid="shard-env" />,
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        // Surface B keys under test.
        'tiers.deletion.shardArchivedBanner':
          'This Shard is archived. It stops ticking and will be deleted on {{date}} unless you restore it by re-upgrading or buying the add-on.',
        'tiers.deletion.shardDeletesOn': 'Deletes {{date}}',
        // Supporting keys required by the pages under test.
        'shardView.shardNotFound': 'Shard not found',
        'shardView.travelHere': 'Travel here',
        'shardView.travelInitiated': 'Travel initiated',
        'shardView.capacity': 'Capacity',
        'shardView.echoes': 'Echoes',
        'shardView.echoesEmpty': 'No echoes here yet',
        'shardView.channel': 'Channel',
        'shardView.noMessagesYet': 'No messages yet',
        'shardView.recentActivity': 'Recent Activity',
        'shardBrowser.title': 'Explore Shards',
        'shardBrowser.searchPlaceholder': 'Search shards...',
        'shardBrowser.empty': 'No shards found',
        'shardBrowser.emptyDesc': 'Check back later for new worlds',
        'shardBrowser.echoCount': '{{current}}/{{max}}',
        'common.back': 'Back',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderView() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/shards/s-archived']}>
        <Routes>
          {/* ShardViewPage reads useParams<{ shardId: string }>() at
              line 24; the route param name must match exactly. */}
          <Route path="/shards/:shardId" element={<ShardViewPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function renderBrowser() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/shards']}>
        <ShardBrowserPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ShardViewPage — archived Shard banner (ME-MIS-001 §5.2 Surface B)', () => {
  afterEach(() => {
    mocks.activeShard = null;
  });

  it('renders the banner with the server-provided deletion date when archived', async () => {
    mocks.activeShard = archivedShard;
    const result = await act(async () => renderView());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const banner = result.queryByRole('status');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('May 2, 2026');
    expect(banner?.textContent).toContain('archived');
  });

  it('does NOT render the banner on an active Shard', async () => {
    mocks.activeShard = activeShard;
    const result = await act(async () => renderView());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.queryByRole('status')).toBeNull();
  });
});

describe('ShardBrowserPage — archived Shard card chip (ME-MIS-001 §5.2 Surface B)', () => {
  beforeEach(() => {
    // ShardBrowserPage renders through the `shardList` path (not
    // `activeShard`), so populate the list fixture directly.
    mocks.shardList = [archivedShard];
  });
  afterEach(() => {
    mocks.shardList = [];
  });

  it('shows the "Deletes {date}" chip on archived cards', async () => {
    await act(async () => {
      renderBrowser();
    });
    const chip = await screen.findByRole('status');
    expect(chip.textContent).toContain('Deletes May 2, 2026');
  });
});
