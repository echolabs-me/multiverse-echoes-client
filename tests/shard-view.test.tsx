import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ShardViewPage } from '../src/pages/ShardViewPage.tsx';
import { account, echoes } from '../src/lib/api/endpoints.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { SHARED_SHARD_NOTICE_REQUIRED } from '../src/hooks/useSharedShardNotice.tsx';
import type { PrivacySettings } from '../src/types/api.ts';

// Function identities stay stable across renders: the page's load effect
// depends on `fetchShard` and `fetchEchoes`. `vi.mock` is hoisted, so the
// factories read `vi.hoisted` state (see archived-shard-banner.test.tsx).
const mocks = vi.hoisted(() => ({
  activeShard: null as unknown,
  echoList: [] as unknown[],
  fetchShard: async () => undefined,
  fetchEchoes: async () => undefined,
  addToast: vi.fn(),
}));

vi.mock('../src/stores/useShardStore.ts', () => ({
  useShardStore: () => ({
    activeShard: mocks.activeShard,
    fetchShard: mocks.fetchShard,
  }),
}));

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    echoList: mocks.echoList,
    fetchEchoes: mocks.fetchEchoes,
  }),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  // ShardViewPage selects `addToast` from the store.
  useToastStore: (
    select: (s: { addToast: typeof mocks.addToast }) => unknown,
  ) => select({ addToast: mocks.addToast }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  shards: { echoes: vi.fn().mockResolvedValue([]) },
  echoes: { travel: vi.fn() },
  feeds: { shard: vi.fn().mockResolvedValue({ data: [], next_cursor: null }) },
  account: {
    getPrivacy: vi.fn(),
    acknowledgeSharedShardNotice: vi.fn(),
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
        'shardView.shardNotFound': 'Shard not found',
        'shardView.travelHere': 'Travel here',
        'shardView.travelInitiated': 'Travel initiated',
        'shardView.capacity': 'Capacity',
        'shardView.echoes': 'Echoes',
        'shardView.echoesEmpty': 'No echoes here yet',
        'shardView.channel': 'Channel',
        'shardView.noMessagesYet': 'No messages yet',
        'shardView.recentActivity': 'Recent Activity',
        'shardView.travelSelectEcho': 'Select Echo to travel',
        'shardView.travelChooseEcho': 'Choose an Echo',
        'sharedShardNotice.title': 'Entering a shared world',
        'sharedShardNotice.body': 'In shared worlds, your Echo meets others.',
        'sharedShardNotice.privacyLink': 'Read the privacy policy',
        'sharedShardNotice.accept': 'I understand',
        'sharedShardNotice.cancel': 'Cancel',
        'common.back': 'Back',
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.error': 'Error',
        'common.confirm': 'Confirm',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function shard(shard_type: 'Public' | 'Private' | 'Personal') {
  return {
    shard_id: 's1',
    name: 'Harbour',
    shard_type,
    status: 'Active',
    description: 'A harbour town.',
    era: 'Modern',
    region: 'Global',
    tags: [],
    current_active_count: 0,
    current_hibernated_count: 0,
    max_active_echoes: 50,
    max_hibernated_echoes: 50,
    allows_travel: true,
    tick_rate_modifier: 1,
    banner_image: null,
    created_at: '2026-01-01T00:00:00Z',
    content_locale: 'en',
    provisioning_type: 'Included',
    archived_at: null,
    archive_expires_at: null,
  };
}

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/shards/s1']}>
        <Routes>
          {/* ShardViewPage reads useParams<{ shardId: string }>(). */}
          <Route path="/shards/:shardId" element={<ShardViewPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

/** Opens the travel dialog and picks the Echo, returning the dialog's
 *  "Travel here" button. */
async function chooseEcho() {
  await click(screen.getByRole('button', { name: 'Travel here' }));
  const dialog = screen.getByRole('dialog', { name: 'Travel here' });
  await act(async () => {
    fireEvent.change(
      within(dialog).getByRole('combobox', { name: 'Select Echo to travel' }),
      { target: { value: 'e1' } },
    );
  });
  return within(dialog).getByRole('button', { name: 'Travel here' });
}

/** Opens the travel dialog, picks the Echo and asks it to travel here. */
async function travelHere() {
  await click(await chooseEcho());
}

/** What a browser does on a repeated Escape: a `cancel` the page cannot
 *  prevent, and then, in a later task, the dialog closes. */
async function browserCloses(dialog: HTMLElement) {
  await act(async () => {
    fireEvent(dialog, new Event('cancel', { cancelable: false }));
  });
  await act(async () => {
    (dialog as HTMLDialogElement).close();
    fireEvent(dialog, new Event('close'));
  });
}

function notice() {
  return screen.queryByRole('dialog', { name: 'Entering a shared world' });
}

function privacy(acknowledgedAt: string | null): PrivacySettings {
  return {
    solo_mode: false,
    do_not_sell: false,
    analytics_opt_out: false,
    community_opt_out: false,
    community_opt_out_cleanup_pending: false,
    shared_shard_notice_acknowledged_at: acknowledgedAt,
    profile_visibility: 'Public',
  };
}

/** A promise and the function that settles it, for a request the test
 *  holds open. */
function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const APPROVED = {
  status: 'approved',
  request_id: null,
  arrival_tick: 1,
  expires_at: null,
} as const;

beforeEach(() => {
  // happy-dom has no showModal: open and close the dialog by its attribute,
  // which is what makes it reachable by role.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  mocks.activeShard = null;
  mocks.echoList = [{ echo_id: 'e1', name: 'Wanderer', status: 'Active' }];
  mocks.addToast.mockReset();
  vi.mocked(echoes.travel).mockReset();
  vi.mocked(echoes.travel).mockResolvedValue(APPROVED);
  vi.mocked(account.getPrivacy).mockReset();
  vi.mocked(account.getPrivacy).mockResolvedValue(privacy(null));
  vi.mocked(account.acknowledgeSharedShardNotice).mockReset();
  vi.mocked(account.acknowledgeSharedShardNotice).mockResolvedValue(undefined);
});

describe('ShardViewPage', () => {
  it('shows shard not found when no shard is loaded', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Shard not found')).toBeInTheDocument();
  });

  it.each(['Public', 'Private'] as const)(
    'shows the shared-shard notice at once before travel into a %s shard, and cancelling leaves the Echo where it is (R216.4, R253)',
    async (shardType) => {
      mocks.activeShard = shard(shardType);
      await act(async () => {
        renderPage();
      });
      await travelHere();

      const shown = notice();
      expect(shown).not.toBeNull();
      expect(echoes.travel).not.toHaveBeenCalled();
      expect(account.getPrivacy).toHaveBeenCalledTimes(1);
      await click(
        within(shown as HTMLElement).getByRole('button', { name: 'Cancel' }),
      );
      expect(echoes.travel).not.toHaveBeenCalled();
      expect(account.acknowledgeSharedShardNotice).not.toHaveBeenCalled();
      expect(notice()).toBeNull();
    },
  );

  it('accepting the notice acknowledges it and then travels (R216.4)', async () => {
    mocks.activeShard = shard('Public');
    await act(async () => {
      renderPage();
    });
    await travelHere();

    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );
    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
    expect(echoes.travel).toHaveBeenCalledWith('e1', 's1');
  });

  it('a failed acknowledgment closes the notice, travels nothing and shows the page’s error (R254.3)', async () => {
    // A server error whose code has no locale text: the translator passes
    // the server's message through (R264).
    vi.mocked(account.acknowledgeSharedShardNotice).mockRejectedValueOnce(
      new ApiRequestError(
        500,
        'NO_TEXT_FOR_THIS_CODE',
        'acknowledgment failed',
      ),
    );
    mocks.activeShard = shard('Public');
    await act(async () => {
      renderPage();
    });
    await travelHere();

    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );
    expect(echoes.travel).not.toHaveBeenCalled();
    expect(notice()).toBeNull();
    expect(mocks.addToast).toHaveBeenCalledWith(
      'acknowledgment failed',
      'danger',
      { platformLink: true },
    );
  });

  it('travels into a Personal shard without the notice', async () => {
    mocks.activeShard = shard('Personal');
    await act(async () => {
      renderPage();
    });
    await travelHere();

    expect(notice()).toBeNull();
    expect(echoes.travel).toHaveBeenCalledWith('e1', 's1');
  });

  it('an acknowledged user’s click travels at once, and closing the travel dialog leaves no read pending that could travel later (R253)', async () => {
    mocks.activeShard = shard('Public');
    // Any read after the page opened is held open, so a click that waited
    // on one would let the dialog close with the travel still to come.
    const later = held<PrivacySettings>();
    vi.mocked(account.getPrivacy)
      .mockResolvedValueOnce(privacy('2026-10-02T00:00:00Z'))
      .mockReturnValue(later.promise);
    vi.mocked(echoes.travel).mockReturnValue(new Promise(() => undefined));
    await act(async () => {
      renderPage();
    });
    const travel = await chooseEcho();
    const dialog = screen.getByRole('dialog', { name: 'Travel here' });
    await click(travel);
    expect(echoes.travel).toHaveBeenCalledTimes(1);
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);

    await click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      later.resolve(privacy('2026-10-02T00:00:00Z'));
    });
    expect(echoes.travel).toHaveBeenCalledTimes(1);
  });

  it('closing the travel dialog behind an unacknowledged user’s notice travels nothing (R253)', async () => {
    mocks.activeShard = shard('Public');
    const later = held<PrivacySettings>();
    vi.mocked(account.getPrivacy)
      .mockResolvedValueOnce(privacy(null))
      .mockReturnValue(later.promise);
    await act(async () => {
      renderPage();
    });
    const travel = await chooseEcho();
    const dialog = screen.getByRole('dialog', { name: 'Travel here' });
    await click(travel);
    expect(notice()).not.toBeNull();

    await click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      later.resolve(privacy('2026-10-02T00:00:00Z'));
    });
    expect(echoes.travel).not.toHaveBeenCalled();
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);
  });

  it('travels when the acknowledgment is not yet known, and a 409 shows the notice (R253)', async () => {
    mocks.activeShard = shard('Public');
    vi.mocked(account.getPrivacy).mockReturnValue(
      held<PrivacySettings>().promise,
    );
    vi.mocked(echoes.travel)
      .mockRejectedValueOnce(
        new ApiRequestError(409, SHARED_SHARD_NOTICE_REQUIRED, 'acknowledge'),
      )
      .mockResolvedValueOnce(APPROVED);
    await act(async () => {
      renderPage();
    });
    await travelHere();
    expect(echoes.travel).toHaveBeenCalledTimes(1);
    expect(notice()).not.toBeNull();

    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );
    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
    expect(echoes.travel).toHaveBeenCalledTimes(2);
  });

  it('after Accept, the notice cannot be dismissed until the acknowledgment settles (R257.1)', async () => {
    mocks.activeShard = shard('Public');
    const acknowledgment = held<undefined>();
    vi.mocked(account.acknowledgeSharedShardNotice).mockReturnValue(
      acknowledgment.promise,
    );
    await act(async () => {
      renderPage();
    });
    await travelHere();
    const shown = notice() as HTMLElement;
    await click(within(shown).getByRole('button', { name: 'I understand' }));

    await click(within(shown).getByRole('button', { name: 'Close' }));
    await act(async () => {
      fireEvent(shown, new Event('cancel', { cancelable: true }));
    });
    await click(shown);
    await browserCloses(shown);
    expect(notice()).not.toBeNull();
    expect(
      within(shown).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(
      within(shown).getByRole('button', { name: 'I understand' }),
    ).toBeDisabled();
    expect(echoes.travel).not.toHaveBeenCalled();

    await act(async () => {
      acknowledgment.resolve(undefined);
    });
    expect(notice()).toBeNull();
    expect(echoes.travel).toHaveBeenCalledTimes(1);
  });

  it('once the acknowledgment lands, the notice is gone and Travel is disabled until the travel settles (R257.3)', async () => {
    mocks.activeShard = shard('Public');
    const travelAnswer = held<Awaited<ReturnType<typeof echoes.travel>>>();
    vi.mocked(echoes.travel).mockReturnValue(travelAnswer.promise);
    await act(async () => {
      renderPage();
    });
    const travel = await chooseEcho();
    await click(travel);
    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );

    expect(notice()).toBeNull();
    expect(echoes.travel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Travel here' })).toBe(
      travel.closest('dialog'),
    );
    expect(travel).toBeDisabled();

    await act(async () => {
      travelAnswer.resolve(APPROVED);
    });
    expect(screen.queryByRole('dialog', { name: 'Travel here' })).toBeNull();
  });

  it('a double click on Travel here sends one travel, and the button is disabled while it runs (R249)', async () => {
    mocks.activeShard = shard('Public');
    vi.mocked(account.getPrivacy).mockResolvedValue(
      privacy('2026-10-02T00:00:00Z'),
    );
    // Hold the travel request open until both clicks are in.
    const travelAnswer = held<Awaited<ReturnType<typeof echoes.travel>>>();
    vi.mocked(echoes.travel).mockReturnValue(travelAnswer.promise);
    await act(async () => {
      renderPage();
    });
    const travel = await chooseEcho();

    await click(travel);
    expect(echoes.travel).toHaveBeenCalledTimes(1);
    expect(travel).toBeDisabled();
    await click(travel);
    await act(async () => {
      travelAnswer.resolve(APPROVED);
    });

    expect(echoes.travel).toHaveBeenCalledTimes(1);
  });
});
