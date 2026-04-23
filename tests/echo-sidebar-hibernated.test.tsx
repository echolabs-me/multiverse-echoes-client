import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EchoSidebar, MobileEchoSwitcher } from '../src/components/EchoSidebar.tsx';

// ME-MIS-001 §5.2 Surface A — hibernated Echo card banner. Covers the
// two EchoSidebar.tsx render sites (EchoCard in the desktop sidebar and
// the dropdown list inside MobileEchoSwitcher). The EchoDetailPage
// render site is covered in echo-detail.test.tsx.

const activeEchoFixture = {
  echo_id: 'e-active',
  name: 'Awake One',
  persona_text: 'p',
  what_if_prompt: 'w',
  status: 'Active',
  current_mood: 'neutral',
  current_tick: 10,
  current_shard_id: 's1',
  birth_hash: 'h',
  created_at: '2026-01-01T00:00:00Z',
  avatar_url: null,
  physical_description: null,
  hibernated_at: null,
};

const hibernatedEchoFixture = {
  echo_id: 'e-hibernated',
  name: 'Sleepy One',
  persona_text: 'p',
  what_if_prompt: 'w',
  status: 'Hibernated',
  current_mood: 'neutral',
  current_tick: 10,
  current_shard_id: 's1',
  birth_hash: 'h',
  created_at: '2026-01-01T00:00:00Z',
  avatar_url: null,
  physical_description: null,
  hibernated_at: '2026-01-15T12:00:00Z',
};

const shardListFixture = [
  {
    shard_id: 's1',
    name: 'Shard One',
    description: '',
    shard_type: 'Public',
    status: 'Active',
    current_active_count: 1,
    current_hibernated_count: 0,
    max_active_echoes: 10,
    banner_image: null,
    created_at: '2026-01-01T00:00:00Z',
    content_locale: 'en',
    provisioning_type: 'Included',
    archived_at: null,
    archive_expires_at: null,
  },
];

// Mutable store state so we can toggle which echoes are in the list per
// test without re-importing the module.
let mockEchoList: unknown[] = [];
const stableFetchEchoes = vi.fn().mockResolvedValue(undefined);
const stableFetchShards = vi.fn().mockResolvedValue(undefined);
const stableReorderEchoes = vi.fn();

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    echoList: mockEchoList,
    fetchEchoes: stableFetchEchoes,
    reorderEchoes: stableReorderEchoes,
  }),
}));

vi.mock('../src/stores/useShardStore.ts', () => ({
  useShardStore: () => ({
    shardList: shardListFixture,
    fetchShards: stableFetchShards,
  }),
}));

// EchoSidebar.tsx:228 calls echoApi.diary(...) for each echo. Stubbing
// to an empty page short-circuits the diary-preview row so the
// hibernation banner row is the only candidate for row 3.
vi.mock('../src/lib/api/endpoints.ts', () => ({
  echoes: {
    diary: vi.fn().mockResolvedValue({ data: [], next_cursor: null }),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'tiers.deletion.echoDeletesOn': 'Deletes {{date}}',
        'echoSidebar.title': 'Echoes',
        'echoSidebar.moodLegend': 'Mood Legend',
        'echoSidebar.createEcho': 'Create Echo',
        'echoSidebar.unknownShard': 'Unknown Shard',
        'echoSidebar.arrivingAt': 'Arriving at {{shard}}',
        'echoSidebar.tick': 'Tick {{tick}}',
        'echoSidebar.switchEcho': 'Switch Echo',
        'echoSidebar.closeAriaLabel': 'Close switcher',
        'echoSidebar.selectEcho': 'Select Echo',
        'moods.neutral': 'Neutral',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderSidebar() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <EchoSidebar forceVisible />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function renderSwitcher() {
  // MobileEchoSwitcher.tsx destructures `echoId` from `useParams()`, so
  // we must mount it inside a real Route to resolve the param. Using a
  // bare MemoryRouter without Routes leaves echoId undefined and the
  // switcher renders the "Select Echo" placeholder.
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/echoes/e-hibernated']}>
        <Routes>
          <Route path="/echoes/:echoId" element={<MobileEchoSwitcher />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EchoSidebar EchoCard — hibernated Echo deletion row', () => {
  beforeEach(() => {
    mockEchoList = [activeEchoFixture, hibernatedEchoFixture];
  });

  it('shows the deletion date on the hibernated Echo card (role="status")', async () => {
    await act(async () => {
      renderSidebar();
    });
    // Flush the diary-preview useEffect + its empty-page setState so
    // the card reaches its final row 3.
    await act(async () => {
      await Promise.resolve();
    });
    const statusRows = screen.getAllByRole('status');
    const match = statusRows.find((el) =>
      el.textContent?.includes('April 15, 2026'),
    );
    expect(match).toBeDefined();
    expect(match?.textContent).toMatch(/Deletes/);
  });

  it('does NOT render a deletion row for the active Echo', async () => {
    // Only the hibernated Echo renders the "Deletes {date}" row. The
    // active Echo's card takes the travelling/diary branch of the
    // row-3 switch in EchoSidebar.tsx, so exactly one card contains
    // the deletion text.
    await act(async () => {
      renderSidebar();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const deletionMatches = screen.getAllByText(/Deletes April 15, 2026/);
    expect(deletionMatches.length).toBe(1);
  });
});

describe('MobileEchoSwitcher — hibernated Echo deletion row', () => {
  beforeEach(() => {
    // MobileEchoSwitcher short-circuits at echoList.length <= 1
    // (EchoSidebar.tsx:367). Populate two echoes so the switcher
    // renders the dropdown trigger.
    mockEchoList = [activeEchoFixture, hibernatedEchoFixture];
  });

  it('renders the deletion date beneath the hibernated Echo in the dropdown list', async () => {
    await act(async () => {
      renderSwitcher();
    });
    // Open the dropdown so the list renders. Trigger is the Sleepy
    // name button (active echo from the route :echoId=e-hibernated).
    const trigger = screen.getByRole('button', { name: /Sleepy One/ });
    await act(async () => {
      fireEvent.click(trigger);
    });
    const deletionLine = await screen.findByText(/Deletes April 15, 2026/);
    expect(deletionLine).toBeInTheDocument();
    // role=status + aria-live=polite so screen readers announce it
    // without interrupting — matches the design in the Session 109
    // preserved enumeration ("informational, not alert").
    expect(deletionLine.getAttribute('role')).toBe('status');
    expect(deletionLine.getAttribute('aria-live')).toBe('polite');
  });
});
