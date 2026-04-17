import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EchoDetailPage } from '../src/pages/EchoDetailPage.tsx';

// Mutable test state — allows the existing smoke tests to keep exercising
// the null-activeEcho short-circuit path while new loaded-state tests set a
// populated echo via beforeEach. The useEchoStore() closure re-reads the
// current value, so reassignment takes effect on the next render.
//
// vi.fn() identities are stabilised at module scope so returning a fresh
// object on every hook invocation doesn't create new function identities,
// which would retrigger `useEffect(..., [fetchEcho])` in EchoDetailPage and
// produce an infinite render loop (OOM).
let mockActiveEcho: unknown = null;
const stableFetchEcho = vi.fn();
const stableHibernateEcho = vi.fn();
const stableWakeEcho = vi.fn();

// EchoDetailPage.tsx:533 renders <MobileEchoSwitcher />, which destructures
// echoList + fetchEchoes from useEchoStore (EchoSidebar.tsx:352). Missing
// from the mock would produce TypeErrors once the loaded-state render
// actually reaches the sections we're testing.
const stableEchoList: unknown[] = [];
const stableFetchEchoes = vi.fn().mockResolvedValue(undefined);
const stableReorderEchoes = vi.fn();
vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    activeEcho: mockActiveEcho,
    echoList: stableEchoList,
    fetchEcho: stableFetchEcho,
    fetchEchoes: stableFetchEchoes,
    reorderEchoes: stableReorderEchoes,
    hibernateEcho: stableHibernateEcho,
    wakeEcho: stableWakeEcho,
  }),
}));

const stableFetchPersonalFeed = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/stores/useFeedStore.ts', () => ({
  useFeedStore: () => ({
    personalFeed: [],
    fetchPersonalFeed: stableFetchPersonalFeed,
  }),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('../src/stores/useSystemStore.ts', () => ({
  useSystemStore: () => ({ tickInterval: 300 }),
}));

vi.mock('../src/lib/sounds.ts', () => ({
  useSoundStore: () => ({ play: vi.fn() }),
}));

vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { subscription_tier: 'Free', user_id: 'u1' } }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  echoes: {
    relationships: vi.fn().mockResolvedValue([]),
    memories: vi.fn().mockResolvedValue([]),
    diary: vi.fn().mockResolvedValue({ data: [], next_cursor: null }),
    influence: vi.fn().mockResolvedValue({ remaining: 5, daily_limit: 10 }),
  },
  // EchoDetailPage.tsx:182 calls conversations.list(echoId) in the initial-load
  // useEffect once activeEcho is populated. Mocked here so the loaded-state
  // tests don't crash on `undefined.list`.
  conversations: {
    list: vi.fn().mockResolvedValue([]),
  },
  account: {
    getPrivacy: vi.fn().mockResolvedValue({ solo_mode: false }),
  },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../src/hooks/useEchoWebSocket.ts', () => ({
  useEchoWebSocket: () => ({ connected: false }),
}));

// EchoPortrait3D (imported by EchoDetailPage.tsx:37) is a heavy Three.js
// component. Loaded-state tests render it via activeEcho population; the
// bare component initialises WebGL under happy-dom which either crashes
// or hangs. Stub with a placeholder so tests focus on the sections under test.
vi.mock('../src/components/EchoPortrait3D.tsx', () => ({
  EchoPortrait3D: () => <div data-testid="portrait" />,
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'echoDetail.echoNotFound': 'Echo not found',
        'echoDetail.whatIf': 'What if...',
        'echoDetail.persona': 'Persona',
        'echoDetail.hibernate': 'Hibernate',
        'echoDetail.wake': 'Wake',
        'echoDetail.useInfluence': 'Use Influence',
        'echoDetail.rename': 'Rename',
        'echoDetail.editPersona': 'Edit Persona',
        'echoDetail.exportStory': 'Export Story',
        'echoDetail.diary': 'Diary',
        'echoDetail.diaryEmpty': 'No diary entries yet',
        'echoDetail.diaryEmptyDesc': 'Your Echo will write soon',
        'echoDetail.events': 'Life Events',
        'echoDetail.eventsEmpty': 'No events yet',
        'echoDetail.eventsEmptyDesc': 'Events will appear here',
        'echoDetail.relationships': 'Relationships',
        'echoDetail.relationshipsEmpty': 'No relationships yet',
        'echoDetail.relationshipsEmptyDesc': 'Relationships will form',
        'echoDetail.memories': 'Memories',
        'echoDetail.memoriesEmpty': 'No memories yet',
        'echoDetail.memoriesEmptyDesc': 'Memories will accumulate',
        'echoDetail.settings': 'Settings',
        'echoDetail.soloMode': 'Solo Mode',
        'echoDetail.influenceRemaining': '{{remaining}} remaining',
        'echoDetail.nextTick': 'Next tick',
        'echoDetail.hibernated': 'Hibernated',
        'echoDetail.woken': 'Woken',
        'echoDetail.hibernateHint': 'Pauses your Echo',
        'echoDetail.sentiment': 'Sentiment',
        'echoDetail.strength': 'Strength',
        'echoDetail.influenceType': 'Influence type',
        'echoDetail.influenceNudge': 'Nudge',
        'echoDetail.influenceSuggest': 'Suggest',
        'echoDetail.influenceInspire': 'Inspire',
        'echoDetail.influenceDetailsLabel': 'Details',
        'echoDetail.influenceDetailsPlaceholder': 'Describe your influence',
        'common.back': 'Back',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.confirm': 'Confirm',
        'common.error': 'Error',
        'common.loadMore': 'Load more',
        // moodLabel.ts:37 aliases 'neutral' → 'neutral', then resolves
        // i18n.t('moods.neutral'). Loaded-state tests use current_mood: 'neutral'.
        'moods.neutral': 'Neutral',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/echoes/e1']}>
        <Routes>
          {/* EchoDetailPage.tsx:77 destructures `echoId` from useParams.
              Route path must use `:echoId` to match; `:id` would leave
              echoId undefined and short-circuit loadData at line 155. */}
          <Route path="/echoes/:echoId" element={<EchoDetailPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EchoDetailPage', () => {
  it('renders the echo-not-found empty state when activeEcho is null', async () => {
    // EchoDetailPage.tsx:511-520 renders an EmptyState with
    // t('echoDetail.echoNotFound') when loadData completes and activeEcho
    // is still null. The previous version of this test asserted the
    // loading Spinner — that assertion only passed because the test
    // used Route path="/echoes/:id" while the page reads useParams<{
    // echoId: string }>(), so echoId was undefined and loadData
    // short-circuited at line 155. The route fix (`:echoId`) was
    // required for the loaded-state tests below; the assertion is
    // updated to match the actual null-activeEcho render path.
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Echo not found')).toBeInTheDocument();
  });

  it('does not crash with null activeEcho', async () => {
    await act(async () => {
      renderPage();
    });
    // No uncaught errors means the component handles null echo gracefully
    expect(document.body).toBeInTheDocument();
  });
});

// Loaded-state tests: populate activeEcho so the page renders past its
// null-short-circuit and into the Life Events + Relationships sections.
// These recover section-rendering coverage that was orphaned when
// dashboard-feed.test.tsx was deleted (content migrated from /dashboard
// to /echoes/:id — see EchoDetailPage.tsx:881 and :915).
describe('EchoDetailPage — feed sections (loaded state)', () => {
  beforeEach(() => {
    mockActiveEcho = {
      echo_id: 'e1',
      name: 'Test Echo',
      persona_text: 'A short persona.',
      what_if_prompt: 'What if...',
      persona_version: 1,
      status: 'Active',
      current_mood: 'neutral',
      current_tick: 42,
      current_shard_id: 'shard-1',
      birth_hash: 'abcdef',
      created_at: '2026-04-17T00:00:00Z',
      name_locked: false,
      avatar_url: null,
      physical_description: null,
    };
  });

  afterEach(() => {
    // Reset so the module-level default remains null for any file-scoped
    // test ordering the runner might chose.
    mockActiveEcho = null;
  });

  it('renders Life Events heading once the echo is loaded', async () => {
    // EchoDetailPage.tsx:884 — <h2>{t('echoDetail.events')}</h2>
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Life Events' }),
    ).toBeInTheDocument();
  });

  it('shows Life Events empty state when personalFeed is empty', async () => {
    // useFeedStore mock returns personalFeed: [] at top of this file.
    // EchoDetailPage.tsx:382 filters to life_event type → empty.
    // EchoDetailPage.tsx:887-892 renders EmptyState with
    // t('echoDetail.eventsEmpty') as the title.
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('No events yet')).toBeInTheDocument();
    expect(screen.getByText('Events will appear here')).toBeInTheDocument();
  });

  it('renders Relationships heading once the echo is loaded', async () => {
    // EchoDetailPage.tsx:919 — <h2>{t('echoDetail.relationships')}</h2>
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Relationships' }),
    ).toBeInTheDocument();
  });

  it('shows Relationships empty state when the fetch returns no rows', async () => {
    // endpoints.ts mock returns echoes.relationships: []
    // EchoDetailPage.tsx:922-927 renders EmptyState with
    // t('echoDetail.relationshipsEmpty') as the title.
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('No relationships yet')).toBeInTheDocument();
    expect(screen.getByText('Relationships will form')).toBeInTheDocument();
  });
});
