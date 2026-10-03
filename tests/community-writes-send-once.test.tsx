import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { CommunityPage } from '../src/pages/CommunityPage.tsx';
import { CommunitySidebar } from '../src/components/CommunitySidebar.tsx';
import { account, channels } from '../src/lib/api/endpoints.ts';
import type { Channel, ChannelMessage } from '../src/types/api.ts';
import {
  heldKey,
  useInFlightStore,
} from '../src/stores/useInFlightStore.ts';
import { markers } from '../src/lib/inFlightMarkers.ts';

/**
 * R265: the community page's and the sidebar's writes send once. A double
 * trigger in one tick sends one request, and the control is disabled until
 * the request settles. Each write is stood in for by a request that never
 * settles.
 */

// The mock applies the selector and answers `getState` and `subscribe`, as
// the store does, and its user is on a tier that has the image composer
// unless a test says otherwise (R285.5, R296.1).
const auth = vi.hoisted(() => ({ tier: 'Starter' }));
vi.mock('../src/stores/useAuthStore.ts', () => {
  const state = () => ({
    user: {
      user_id: 'u1',
      display_name: 'Test',
      subscription_tier: auth.tier,
    },
  });
  return {
    useAuthStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(state()),
      { getState: state, subscribe: () => () => {} },
    ),
  };
});

vi.mock('../src/hooks/useEchoWebSocket.ts', () => ({
  useEchoWebSocket: vi.fn(),
}));

vi.mock('../src/lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  channels: {
    list: vi.fn(),
    messages: vi.fn(),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    pollVote: vi.fn(),
    uploadImage: vi.fn(),
    createPoll: vi.fn(),
  },
  account: { discordStatus: vi.fn() },
  reports: { create: vi.fn() },
}));

const t = (key: string) => i18n.t(key);
const never = () => new Promise<never>(() => {});

const channel: Channel = {
  channel_id: 'c1',
  name: 'general',
  channel_type: 'Global',
  scope_id: null,
  status: 'Active',
  description: '',
  is_read_only: false,
  slow_mode_seconds: 0,
  created_at: '2026-09-30T00:00:00Z',
};

function message(id: string, extra: Partial<ChannelMessage>): ChannelMessage {
  return {
    message_id: id,
    channel_id: 'c1',
    author_id: 'u1',
    author_display_name: 'Test',
    author_removed: false,
    external_author_name: null,
    content: `content ${id}`,
    message_type: 'UserMessage',
    created_at: '2026-09-30T00:00:00Z',
    edited_at: null,
    is_edited: false,
    can_edit: false,
    can_delete: false,
    image_url: null,
    poll_data: null,
    owner_is_founding_echo: false,
    ...extra,
  };
}

const POLL = JSON.stringify({
  question: 'Which shard?',
  options: [
    { id: 1, text: 'Tokyo', votes: 0 },
    { id: 2, text: 'Florence', votes: 0 },
  ],
  discord_message_id: 'd1',
  discord_channel_id: 'dc1',
});

beforeEach(() => {
  auth.tier = 'Starter';
  for (const fn of Object.values(channels)) vi.mocked(fn).mockReset();
  vi.mocked(channels.list).mockResolvedValue([channel]);
  vi.mocked(channels.messages).mockResolvedValue({
    data: [
      message('m1', { can_edit: true, can_delete: true }),
      message('m2', { poll_data: POLL, created_at: '2026-09-30T01:00:00Z' }),
    ],
  } as unknown as Awaited<ReturnType<typeof channels.messages>>);
  vi.mocked(account.discordStatus).mockResolvedValue({
    linked: true,
    discord_user_id: '1001',
    discord_username: 'tester',
    sync_display_name: false,
  });
  for (const name of [
    'editMessage',
    'deleteMessage',
    'pollVote',
    'uploadImage',
  ] as const) {
    vi.mocked(channels[name]).mockReturnValue(never());
  }
});

async function mount(view: React.ReactElement) {
  let container!: HTMLElement;
  await act(async () => {
    ({ container } = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/community']}>{view}</MemoryRouter>
      </I18nextProvider>,
    ));
  });
  return container;
}

async function doubleClick(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
    fireEvent.click(el);
  });
}

function openMenu(index: number) {
  fireEvent.click(
    screen.getAllByRole('button', { name: t('common.messageActions') })[index],
  );
}

const image = () => new File(['x'], 'x.png', { type: 'image/png' });

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
  return input;
}

async function doubleUpload(container: HTMLElement) {
  const input = fileInput(container);
  await act(async () => {
    fireEvent.change(input, { target: { files: [image()] } });
    fireEvent.change(input, { target: { files: [image()] } });
  });
}

async function upload(container: HTMLElement) {
  await act(async () => {
    fireEvent.change(fileInput(container), { target: { files: [image()] } });
  });
}

/** The page and the sidebar mounted together, as at 1920px and wider. */
async function mountBoth() {
  await mount(
    <>
      <div data-testid="page">
        <CommunityPage />
      </div>
      <div data-testid="sidebar">
        <CommunitySidebar />
      </div>
    </>,
  );
  return {
    page: screen.getByTestId('page'),
    sidebar: screen.getByTestId('sidebar'),
  };
}

/** Whether the session now holds `marker` (R296.1). */
const held = (marker: ReturnType<typeof markers.upload>) => {
  const { held: keys, session } = useInFlightStore.getState();
  return keys.has(heldKey(session, marker));
};

describe('CommunityPage writes send once (R265)', () => {
  it('editing a message', async () => {
    await mount(<CommunityPage />);
    openMenu(0);
    fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
    const save = screen.getByRole('button', { name: t('common.save') });
    await doubleClick(save);
    expect(channels.editMessage).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
  });

  it('deleting a message', async () => {
    await mount(<CommunityPage />);
    openMenu(0);
    await doubleClick(screen.getByRole('button', { name: t('common.delete') }));
    expect(channels.deleteMessage).toHaveBeenCalledTimes(1);
    openMenu(0);
    expect(
      screen.getByRole('button', { name: t('common.delete') }),
    ).toBeDisabled();
  });

  it('voting in a poll', async () => {
    await mount(<CommunityPage />);
    const option = screen.getByRole('button', { name: /Tokyo/ });
    await doubleClick(option);
    expect(channels.pollVote).toHaveBeenCalledTimes(1);
    expect(option).toBeDisabled();
    expect(screen.getByRole('button', { name: /Florence/ })).toBeDisabled();
  });

  it('uploading an image', async () => {
    const container = await mount(<CommunityPage />);
    await doubleUpload(container);
    expect(channels.uploadImage).toHaveBeenCalledTimes(1);
  });

  it("holds the page's upload marker while its request is in flight (R288.6)", async () => {
    const container = await mount(<CommunityPage />);
    await upload(container);
    expect(held(markers.upload('page', 'c1'))).toBe(true);
  });
});

describe('CommunitySidebar writes send once (R265)', () => {
  it('voting in a poll', async () => {
    await mount(<CommunitySidebar />);
    const option = screen.getByRole('button', { name: /Tokyo/ });
    await doubleClick(option);
    expect(channels.pollVote).toHaveBeenCalledTimes(1);
    expect(option).toBeDisabled();
  });

  it('uploading an image', async () => {
    const container = await mount(<CommunitySidebar />);
    await doubleUpload(container);
    expect(channels.uploadImage).toHaveBeenCalledTimes(1);
  });

  it("holds the sidebar's upload marker while its request is in flight (R288.6)", async () => {
    const container = await mount(<CommunitySidebar />);
    await upload(container);
    expect(held(markers.upload('sidebar', 'c1'))).toBe(true);
  });
});

describe('the page and the sidebar mounted together hold one store (R288)', () => {
  it("a vote in flight from the page disables the sidebar's option, and one request is sent", async () => {
    const { page, sidebar } = await mountBoth();
    await act(async () => {
      fireEvent.click(within(page).getByRole('button', { name: /Tokyo/ }));
    });
    const option = within(sidebar).getByRole('button', { name: /Tokyo/ });
    expect(option).toBeDisabled();
    await act(async () => {
      fireEvent.click(option);
    });
    expect(channels.pollVote).toHaveBeenCalledTimes(1);
  });

  it("the page's upload in flight leaves the sidebar's upload to that channel free", async () => {
    const { page, sidebar } = await mountBoth();
    await upload(page);
    await upload(sidebar);
    expect(channels.uploadImage).toHaveBeenCalledTimes(2);
  });

  it('a vote held when its view unmounts holds the option in a view mounted after it, until the request settles', async () => {
    let settle!: () => void;
    vi.mocked(channels.pollVote).mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      }) as never,
    );
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/community']}>
            <CommunityPage />
          </MemoryRouter>
        </I18nextProvider>,
      ));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Tokyo/ }));
    });
    unmount();
    await mount(<CommunitySidebar />);
    const option = screen.getByRole('button', { name: /Tokyo/ });
    expect(option).toBeDisabled();
    await act(async () => {
      settle();
    });
    expect(option).toBeEnabled();
  });
});

/** Renders `view` and answers how to unmount it. */
async function mountToLeave(view: React.ReactElement) {
  let unmount!: () => void;
  let container!: HTMLElement;
  await act(async () => {
    ({ unmount, container } = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/community']}>{view}</MemoryRouter>
      </I18nextProvider>,
    ));
  });
  return { unmount, container };
}

describe('a control is disabled by its own marker (R294.2)', () => {
  it('a page mounted while its upload is held shows the upload button disabled', async () => {
    const first = await mountToLeave(<CommunityPage />);
    await upload(first.container);
    first.unmount();
    await mount(<CommunityPage />);
    expect(
      screen.getByRole('button', { name: t('community.uploadImage') }),
    ).toBeDisabled();
  });

  it('a sidebar mounted while its upload is held shows the upload button disabled', async () => {
    const first = await mountToLeave(<CommunitySidebar />);
    await upload(first.container);
    first.unmount();
    await mount(<CommunitySidebar />);
    expect(screen.getByTitle(t('community.uploadImage'))).toBeDisabled();
  });

  it("an edit in flight disables the message's edit field as well as Save", async () => {
    await mount(<CommunityPage />);
    openMenu(0);
    fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    });
    expect(
      screen.getByRole('textbox', { name: t('community.editMessageLabel') }),
    ).toBeDisabled();
  });
});

describe("the auth mock is the store's contract (R285.5)", () => {
  it('a Free user on the community page has no image composer', async () => {
    auth.tier = 'Free';
    const container = await mount(<CommunityPage />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(t('community.readOnly'))).toBeInTheDocument();
  });

  it('a Free user in the sidebar has no image composer', async () => {
    auth.tier = 'Free';
    const container = await mount(<CommunitySidebar />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
