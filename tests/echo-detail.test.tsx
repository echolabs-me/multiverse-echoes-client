import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EchoDetailPage } from '../src/pages/EchoDetailPage.tsx';
import { echoes, account } from '../src/lib/api/endpoints.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import appI18n from '../src/i18n.ts';

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
const stableDeleteEcho = vi.fn();

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
    deleteEcho: stableDeleteEcho,
  }),
}));

const stableFetchPersonalFeed = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/stores/useFeedStore.ts', () => ({
  useFeedStore: () => ({
    personalFeed: [],
    fetchPersonalFeed: stableFetchPersonalFeed,
  }),
}));

// EchoDetailPage selects `addToast` and `play` from these stores, so the
// mocks apply the selector it passes.
const stableAddToast = vi.fn();
vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (
    select: (s: { addToast: typeof stableAddToast }) => unknown,
  ) => select({ addToast: stableAddToast }),
}));

vi.mock('../src/stores/useSystemStore.ts', () => ({
  useSystemStore: () => ({ tickInterval: 300 }),
}));

const stablePlay = vi.fn();
vi.mock('../src/lib/sounds.ts', () => ({
  useSoundStore: (select: (s: { play: typeof stablePlay }) => unknown) =>
    select({ play: stablePlay }),
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
    useInfluence: vi.fn(),
    narrateVideoStart: vi.fn(),
    narrateVideoStatus: vi.fn(),
    narrateVideoResult: vi.fn(),
  },
  // EchoDetailPage.tsx:182 calls conversations.list(echoId) in the initial-load
  // useEffect once activeEcho is populated. Mocked here so the loaded-state
  // tests don't crash on `undefined.list`.
  conversations: {
    list: vi.fn().mockResolvedValue([]),
  },
  account: {
    getPrivacy: vi.fn().mockResolvedValue({ solo_mode: false }),
    updatePrivacy: vi.fn(),
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
        'echoDetail.wakeShardFull':
          "This Echo's Shard is full, so it can't wake right now. It can wake when a place frees up.",
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
        'echoDetail.delete': 'Delete',
        'echoDetail.deleteConfirmTitle': 'Delete {{name}}?',
        'echoDetail.deleteConfirmAction': 'Delete forever',
        'echoDetail.deleteFailed': 'Could not delete',
        'common.more': 'More',
        'common.close': 'Close',
        'common.back': 'Back',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.confirm': 'Confirm',
        'common.error': 'Error',
        'common.loadMore': 'Load more',
        // moodLabel.ts:37 aliases 'neutral' → 'neutral', then resolves
        // i18n.t('moods.neutral'). Loaded-state tests use current_mood: 'neutral'.
        'moods.neutral': 'Neutral',
        // ME-MIS-001 §5.2 Surface A hibernated Echo banner. Keep the
        // interpolation shape ({{date}}) identical to en.json so the
        // assertions below resolve the same way in production.
        'tiers.deletion.echoHibernatedBanner':
          'This Echo is hibernated and will be deleted on {{date}} unless you upgrade back or free up a slot to wake it.',
        'tiers.deletion.echoDeletesOn': 'Deletes {{date}}',
        'diary.watch': 'Watch',
        // R284.5: the label and its value are one key each.
        'dashboard.moodValue': 'Mood: {{mood}}',
        'echoDetail.dayEntryCount': '[{{number}}]',
        'diary.generatingVideoProgress': 'Generating video: {{progress}}%',
        'diary.videoError': 'Video failed, tap to retry',
        // Worded apart from the old hardcoded "Error:" prefix, so the test
        // tells the locale key from it.
        'diary.videoErrorDetail': 'Video error: {{detail}}',
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
      status: 'Active',
      current_mood: 'neutral',
      current_tick: 42,
      current_shard_id: 'shard-1',
      birth_hash: 'abcdef',
      created_at: '2026-04-17T00:00:00Z',
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

// ME-MIS-001 §5.2 Surface A — hibernated Echo banner. Mirrors the
// card/switcher banner shown on EchoSidebar; on the detail page the
// banner renders as a full-width warning strip above the What-if card
// whenever `hibernated_at != null`, with the Status badge swapped to
// the warning variant.
describe('EchoDetailPage — hibernated Echo banner (ME-MIS-001 §5.2 Surface A)', () => {
  afterEach(() => {
    mockActiveEcho = null;
  });

  it('renders the banner with the 90-day deletion date when the Echo is hibernated', async () => {
    // hibernated_at fixed in UTC so the locale-sensitive long-form date
    // below resolves deterministically under en-US: 2026-01-15T12:00Z +
    // 90 days → 2026-04-15.
    mockActiveEcho = {
      echo_id: 'e1',
      name: 'Sleepy',
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
    await act(async () => {
      renderPage();
    });
    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain('April 15, 2026');
    expect(banner.textContent).toContain('hibernated');
  });

  it('does NOT render the banner when the Echo is active (hibernated_at is null)', async () => {
    mockActiveEcho = {
      echo_id: 'e1',
      name: 'Awake',
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
    await act(async () => {
      renderPage();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('EchoDetailPage — the delete dialog (R254.2)', () => {
  const DIALOG = 'Delete Test Echo?';

  beforeEach(() => {
    // happy-dom has no showModal: open and close the dialog by its
    // attribute, which is what makes it reachable by role.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    stableDeleteEcho.mockReset();
    mockActiveEcho = {
      echo_id: 'e1',
      name: 'Test Echo',
      persona_text: 'A short persona.',
      what_if_prompt: 'What if...',
      status: 'Active',
      current_mood: 'neutral',
      current_tick: 42,
      current_shard_id: 'shard-1',
      birth_hash: 'abcdef',
      created_at: '2026-04-17T00:00:00Z',
      avatar_url: null,
      physical_description: null,
    };
  });

  afterEach(() => {
    mockActiveEcho = null;
  });

  it('is busy while it deletes, and Escape and the backdrop leave it open', async () => {
    let fail: (reason: unknown) => void = () => undefined;
    stableDeleteEcho.mockReturnValue(
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
    );
    await act(async () => {
      renderPage();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    const dialog = screen.getByRole('dialog', { name: DIALOG });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(dialog).not.toHaveAttribute('aria-busy');
    expect(close).toBeEnabled();

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete forever' }),
      );
    });
    expect(stableDeleteEcho).toHaveBeenCalledWith('e1');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(close).toBeDisabled();

    await act(async () => {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      fireEvent.click(dialog);
    });
    expect(screen.queryByRole('dialog', { name: DIALOG })).not.toBeNull();

    await act(async () => {
      fail(new Error('server down'));
    });
    expect(dialog).not.toHaveAttribute('aria-busy');
    expect(close).toBeEnabled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Could not delete',
    );
  });
});

describe('EchoDetailPage — the hibernate, wake and influence dialogs (R258)', () => {
  function echo(status: 'Active' | 'Hibernated') {
    return {
      echo_id: 'e1',
      name: 'Test Echo',
      persona_text: 'A short persona.',
      what_if_prompt: 'What if...',
      status,
      current_mood: 'neutral',
      current_tick: 42,
      current_shard_id: 'shard-1',
      birth_hash: 'abcdef',
      created_at: '2026-04-17T00:00:00Z',
      avatar_url: null,
      physical_description: null,
      hibernated_at: null,
    };
  }

  /** A request the test holds open, and the functions that settle it. */
  function held() {
    let resolve: () => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const promise = new Promise<void>((res, rej) => {
      resolve = () => res();
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  async function click(element: HTMLElement) {
    await act(async () => {
      fireEvent.click(element);
    });
  }

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    stableHibernateEcho.mockReset();
    stableWakeEcho.mockReset();
    vi.mocked(echoes.useInfluence).mockReset();
  });

  afterEach(() => {
    mockActiveEcho = null;
  });

  describe.each([
    ['Hibernate', 'Active', stableHibernateEcho],
    ['Wake', 'Hibernated', stableWakeEcho],
  ] as const)('the %s dialog', (name, status, request) => {
    async function openDialog() {
      mockActiveEcho = echo(status);
      await act(async () => {
        renderPage();
      });
      await click(screen.getByRole('button', { name: 'More' }));
      await click(screen.getByRole('button', { name }));
      return screen.getByRole('dialog', { name });
    }

    it('sends one request on a double click', async () => {
      const work = held();
      request.mockReturnValue(work.promise);
      const dialog = await openDialog();
      const confirm = within(dialog).getByRole('button', { name: 'Confirm' });

      await act(async () => {
        fireEvent.click(confirm);
        fireEvent.click(confirm);
      });
      expect(request).toHaveBeenCalledTimes(1);

      await act(async () => {
        work.resolve();
      });
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('is busy, with every control disabled, until the request settles, then closes', async () => {
      const work = held();
      request.mockReturnValue(work.promise);
      const dialog = await openDialog();
      expect(dialog).not.toHaveAttribute('aria-busy');

      await click(within(dialog).getByRole('button', { name: 'Confirm' }));
      expect(dialog).toHaveAttribute('aria-busy', 'true');
      for (const control of ['Close', 'Cancel', 'Confirm']) {
        expect(
          within(dialog).getByRole('button', { name: control }),
        ).toBeDisabled();
      }

      await act(async () => {
        work.resolve();
      });
      expect(screen.queryByRole('dialog', { name })).toBeNull();
    });

    it('stays open and is no longer busy when the request fails', async () => {
      const work = held();
      request.mockReturnValue(work.promise);
      const dialog = await openDialog();
      await click(within(dialog).getByRole('button', { name: 'Confirm' }));

      await act(async () => {
        work.reject(new Error('server down'));
      });
      expect(screen.getByRole('dialog', { name })).toBe(dialog);
      expect(dialog).not.toHaveAttribute('aria-busy');
      expect(
        within(dialog).getByRole('button', { name: 'Confirm' }),
      ).toBeEnabled();
    });
  });

  it('keeps naming the action it sent while the store flips the status', async () => {
    const work = held();
    stableHibernateEcho.mockImplementation(() => {
      // The store flips the status before the request settles.
      mockActiveEcho = echo('Hibernated');
      return work.promise;
    });
    mockActiveEcho = echo('Active');
    await act(async () => {
      renderPage();
    });
    await click(screen.getByRole('button', { name: 'More' }));
    await click(screen.getByRole('button', { name: 'Hibernate' }));
    const dialog = screen.getByRole('dialog', { name: 'Hibernate' });

    await click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('dialog', { name: 'Hibernate' })).toBe(dialog);
  });

  describe("a refused wake or hibernate's toast, and the wake's sentence (R401.4)", () => {
    const wakeShardFull =
      "This Echo's Shard is full, so it can't wake right now. It can wake when a place frees up.";

    /** Opens the dialog for `name`, has its request fail with `error`, and
     *  returns every toast the page showed, whole. */
    async function refusedWith(name: 'Wake' | 'Hibernate', error: unknown) {
      stableAddToast.mockClear();
      const request = name === 'Wake' ? stableWakeEcho : stableHibernateEcho;
      request.mockRejectedValue(error);
      mockActiveEcho = echo(name === 'Wake' ? 'Hibernated' : 'Active');
      await act(async () => {
        renderPage();
      });
      await click(screen.getByRole('button', { name: 'More' }));
      await click(screen.getByRole('button', { name }));
      const dialog = screen.getByRole('dialog', { name });
      await click(within(dialog).getByRole('button', { name: 'Confirm' }));
      return stableAddToast.mock.calls;
    }

    it("is R401.4's sentence in en.json", () => {
      expect(appI18n.t('echoDetail.wakeShardFull')).toBe(wakeShardFull);
    });

    it("because its Shard is full says so in a wake's own words", async () => {
      const shown = await refusedWith(
        'Wake',
        new ApiRequestError(409, 'SHARD_AT_CAPACITY', 'shard is full'),
      );
      expect(shown).toEqual([
        [wakeShardFull, 'danger', { platformLink: false }],
      ]);
    });

    it("for any other reason keeps the error's own text", async () => {
      const shown = await refusedWith(
        'Wake',
        new ApiRequestError(400, 'NOT_HIBERNATED', 'not hibernated'),
      );
      expect(shown).toEqual([
        [appI18n.t('errors.NOT_HIBERNATED'), 'danger', { platformLink: false }],
      ]);
    });

    it('with no server code keeps the general failure and the status link', async () => {
      const shown = await refusedWith('Wake', new Error('server down'));
      expect(shown).toEqual([['Error', 'danger', { platformLink: true }]]);
    });

    it("leaves a hibernate's SHARD_AT_CAPACITY with the code's shared text", async () => {
      const shown = await refusedWith(
        'Hibernate',
        new ApiRequestError(409, 'SHARD_AT_CAPACITY', 'shard is full'),
      );
      expect(shown).toEqual([
        [
          appI18n.t('errors.SHARD_AT_CAPACITY'),
          'danger',
          { platformLink: false },
        ],
      ]);
    });
  });

  describe('the influence dialog', () => {
    async function openDialog() {
      mockActiveEcho = echo('Active');
      await act(async () => {
        renderPage();
      });
      await click(screen.getByRole('button', { name: /^Use Influence/ }));
      const dialog = screen.getByRole('dialog', { name: 'Use Influence' });
      await act(async () => {
        fireEvent.change(within(dialog).getByLabelText('Details'), {
          target: { value: 'Visit the harbour' },
        });
      });
      return dialog;
    }

    function send(dialog: HTMLElement) {
      return within(dialog).getByRole('button', { name: 'Use Influence' });
    }

    function holdInfluence() {
      const work = held();
      vi.mocked(echoes.useInfluence).mockReturnValue(
        work.promise as unknown as ReturnType<typeof echoes.useInfluence>,
      );
      return work;
    }

    it('sends one request on a double click', async () => {
      const work = holdInfluence();
      const dialog = await openDialog();

      await act(async () => {
        fireEvent.click(send(dialog));
        fireEvent.click(send(dialog));
      });
      expect(echoes.useInfluence).toHaveBeenCalledTimes(1);

      await act(async () => {
        work.resolve();
      });
      expect(echoes.useInfluence).toHaveBeenCalledTimes(1);
    });

    it('is busy, with every control disabled, until the request settles, then closes', async () => {
      const work = holdInfluence();
      const dialog = await openDialog();
      expect(dialog).not.toHaveAttribute('aria-busy');

      await click(send(dialog));
      expect(dialog).toHaveAttribute('aria-busy', 'true');
      for (const control of ['Close', 'Cancel', 'Use Influence']) {
        expect(
          within(dialog).getByRole('button', { name: control }),
        ).toBeDisabled();
      }
      expect(
        within(dialog).getByRole('combobox', { name: 'Influence type' }),
      ).toBeDisabled();
      expect(within(dialog).getByLabelText('Details')).toBeDisabled();

      await act(async () => {
        work.resolve();
      });
      expect(
        screen.queryByRole('dialog', { name: 'Use Influence' }),
      ).toBeNull();
    });

    it('stays open and is no longer busy when the request fails', async () => {
      const work = holdInfluence();
      const dialog = await openDialog();
      await click(send(dialog));

      await act(async () => {
        work.reject(new Error('server down'));
      });
      expect(screen.getByRole('dialog', { name: 'Use Influence' })).toBe(
        dialog,
      );
      expect(dialog).not.toHaveAttribute('aria-busy');
      expect(send(dialog)).toBeEnabled();
    });
  });
});

describe('EchoDetailPage — a failed narration video (R264.5)', () => {
  const entry = {
    diary_id: 'd1',
    echo_id: 'e1',
    tick_id: 1,
    simulated_date: '2026-04-17',
    content: 'A day in the life.',
    content_locale: 'en',
    mood: 'neutral',
    location_name: 'Home',
    shard_id: 'shard-1',
    nudge_source: null,
    image_url: null,
    created_at: '2026-04-17T00:00:00Z',
  };

  beforeEach(() => {
    mockActiveEcho = {
      echo_id: 'e1',
      name: 'Test Echo',
      persona_text: 'A short persona.',
      what_if_prompt: 'What if...',
      status: 'Active',
      current_mood: 'neutral',
      current_tick: 42,
      current_shard_id: 'shard-1',
      birth_hash: 'abcdef',
      created_at: '2026-04-17T00:00:00Z',
      avatar_url: null,
      physical_description: null,
    };
    vi.mocked(echoes.diary).mockResolvedValue({
      data: [entry],
      next_cursor: null,
    });
    vi.mocked(echoes.narrateVideoStart).mockReset();
  });

  afterEach(() => {
    mockActiveEcho = null;
    vi.mocked(echoes.diary).mockResolvedValue({ data: [], next_cursor: null });
  });

  async function watch() {
    await act(async () => {
      renderPage();
    });
    const button = await screen.findByRole('button', { name: /Watch/ });
    await act(async () => {
      fireEvent.click(button);
    });
  }

  it("shows the server's error through the translator, in the locale key's frame", async () => {
    vi.mocked(echoes.narrateVideoStart).mockRejectedValue(
      new ApiRequestError(
        400,
        'DAILY_VIDEO_LIMIT',
        'Daily video render limit reached (10/10). Upgrade or wait 24h.',
      ),
    );
    await watch();
    expect(
      await screen.findByText(
        `Video error: ${appI18n.t('errors.DAILY_VIDEO_LIMIT')}`,
      ),
    ).toBeInTheDocument();
  });

  it("shows the button's own failure text for a failure that is not the server's", async () => {
    vi.mocked(echoes.narrateVideoStart).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await watch();
    expect(
      await screen.findByText('Video failed, tap to retry'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it("shows DAILY_VIDEO_LIMIT's text when the endpoint answers with that code (R283.2)", async () => {
    // The real endpoint, with only `fetch` stood in for: the page must get
    // the server's code through the endpoint itself.
    const actual = await vi.importActual<
      typeof import('../src/lib/api/endpoints.ts')
    >('../src/lib/api/endpoints.ts');
    vi.mocked(echoes.narrateVideoStart).mockImplementation(
      actual.echoes.narrateVideoStart,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'DAILY_VIDEO_LIMIT',
              message: 'Daily video render limit reached (10/10).',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    await watch();
    expect(
      await screen.findByText(
        `Video error: ${appI18n.t('errors.DAILY_VIDEO_LIMIT')}`,
      ),
    ).toBeInTheDocument();
  });

  it("shows the server's error when the finished video cannot be fetched (R283.2)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(echoes.narrateVideoStart).mockResolvedValue({ jobId: 'j1' });
      vi.mocked(echoes.narrateVideoStatus).mockResolvedValue({
        status: 'complete',
      });
      vi.mocked(echoes.narrateVideoResult).mockRejectedValue(
        new ApiRequestError(429, 'DAILY_VIDEO_LIMIT', 'limit reached'),
      );
      await watch();
      // One poll, then three fetches of the result two seconds apart.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500 + 2 * 2000 + 100);
      });
      expect(echoes.narrateVideoResult).toHaveBeenCalledTimes(3);
      expect(
        screen.getByText(
          `Video error: ${appI18n.t('errors.DAILY_VIDEO_LIMIT')}`,
        ),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a day's entry count through its key (R284.5)", async () => {
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('[1]')).toBeInTheDocument();
  });

  it("shows the video's progress as one key's text with its value (R284.5)", async () => {
    vi.mocked(echoes.narrateVideoStart).mockReturnValue(new Promise(() => {}));
    await watch();
    expect(await screen.findByText('Generating video: 0%')).toBeInTheDocument();
  });
});

describe('EchoDetailPage — the mood line (R284.5)', () => {
  beforeEach(() => {
    mockActiveEcho = {
      echo_id: 'e1',
      name: 'Test Echo',
      persona_text: 'A short persona.',
      what_if_prompt: 'What if...',
      status: 'Active',
      current_mood: 'neutral',
      current_tick: 42,
      current_shard_id: 'shard-1',
      birth_hash: 'abcdef',
      created_at: '2026-04-17T00:00:00Z',
      avatar_url: null,
      physical_description: null,
    };
  });

  afterEach(() => {
    mockActiveEcho = null;
  });

  it('sends one solo-mode write on a double click, and holds the toggle (R265)', async () => {
    vi.mocked(account.updatePrivacy).mockReturnValueOnce(new Promise(() => {}));
    await act(async () => {
      renderPage();
    });
    const solo = screen.getByRole('checkbox', { name: 'Solo Mode' });
    await act(async () => {
      fireEvent.click(solo);
      fireEvent.click(solo);
    });
    expect(account.updatePrivacy).toHaveBeenCalledTimes(1);
    expect(solo).toBeDisabled();
  });

  it("shows the mood as one key's text with its value", async () => {
    await act(async () => {
      renderPage();
    });
    const moodLabel = appI18n.t('moods.neutral');
    expect(
      screen.getByText((_, el) =>
        Boolean(
          el?.tagName === 'P' &&
          el.textContent?.startsWith(`Mood: ${moodLabel} `),
        ),
      ),
    ).toBeInTheDocument();
  });
});
