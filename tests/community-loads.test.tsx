import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profiler } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { CommunityPage } from '../src/pages/CommunityPage.tsx';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { account, channels } from '../src/lib/api/endpoints.ts';
import type { Channel, ChannelMessage, WsEchoEvent } from '../src/types/api.ts';

// R361.4, R371.1, R381.1, R390.3: the page shows and writes only the
// messages of the channel it shows.
vi.mock('../src/stores/useAuthStore.ts', () => {
  const state = () => ({
    user: { user_id: 'u1', display_name: 'Test', subscription_tier: 'Starter' },
  });
  return {
    useAuthStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(state()),
      { getState: state, subscribe: () => () => {} },
    ),
  };
});

const ws = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => void>(),
}));
vi.mock('../src/hooks/useEchoWebSocket.ts', () => ({
  useEchoWebSocket: (path: string | null, onEvent: (e: unknown) => void) => {
    if (path) ws.handlers.set(path, onEvent);
  },
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

function channel(id: string, name: string): Channel {
  return {
    channel_id: id,
    name,
    channel_type: 'Global',
    scope_id: null,
    status: 'Active',
    description: '',
    is_read_only: false,
    slow_mode_seconds: 0,
    created_at: '2026-09-30T00:00:00Z',
  };
}

function message(
  id: string,
  channelId: string,
  content: string,
): ChannelMessage {
  return {
    message_id: id,
    channel_id: channelId,
    author_id: 'u1',
    author_display_name: 'Test',
    author_removed: false,
    external_author_name: null,
    content,
    message_type: 'UserMessage',
    created_at: '2026-09-30T00:00:00Z',
    edited_at: null,
    is_edited: false,
    can_edit: false,
    can_delete: false,
    image_url: null,
    poll_data: null,
    owner_is_founding_echo: false,
  };
}

type Page = Awaited<ReturnType<typeof channels.messages>>;

function page(...msgs: ChannelMessage[]): Page {
  return { data: msgs } as unknown as Page;
}

function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Answers the unread check (`limit: 1`) with nothing, and every other read
 *  of a channel's messages with what `byChannel` gives. */
function messagesBy(byChannel: (id: string) => Promise<Page>) {
  vi.mocked(channels.messages).mockImplementation(
    (id: string, opts?: { limit?: number }) =>
      opts?.limit === 1 ? Promise.resolve(page()) : byChannel(id),
  );
}

const commits: string[] = [];
/** Records the page's text at every commit of what it wraps. */
function CommitProbe({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="page"
      onRender={() => {
        commits.push(document.body.textContent ?? '');
      }}
    >
      {children}
    </Profiler>
  );
}

async function mount() {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/community']}>
          <CommitProbe>
            <CommunityPage />
          </CommitProbe>
        </MemoryRouter>
      </I18nextProvider>,
    );
  });
  return view;
}

async function openChannel(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
  });
}

async function liveEvent(path: string) {
  await act(async () => {
    ws.handlers.get(path)?.({
      type: 'CommunityMessagePosted',
      channel_id: 'x',
    } as unknown as WsEchoEvent);
  });
}

beforeEach(() => {
  commits.length = 0;
  useToastStore.setState({ toasts: [] });
  ws.handlers.clear();
  localStorage.clear();
  for (const fn of Object.values(channels)) vi.mocked(fn).mockReset();
  vi.mocked(channels.list).mockResolvedValue([
    channel('c1', 'general'),
    channel('c2', 'random'),
  ]);
  vi.mocked(account.discordStatus).mockResolvedValue({
    linked: true,
    discord_user_id: '1001',
    discord_username: 'tester',
    sync_display_name: false,
  });
});

describe('CommunityPage loads (R361.4)', () => {
  it('a load for an earlier channel that settles after the later channel’s leaves the later channel’s messages and marks nothing read (R361.3)', async () => {
    const forC1 = held<Page>();
    messagesBy((id) =>
      id === 'c1'
        ? forC1.promise
        : Promise.resolve(page(message('m2', 'c2', 'content two'))),
    );
    await mount();
    await openChannel('random');
    expect(screen.getByText('content two')).toBeInTheDocument();
    await act(async () => {
      forC1.resolve(page(message('m1', 'c1', 'content one')));
    });
    expect(screen.getByText('content two')).toBeInTheDocument();
    expect(screen.queryByText('content one')).toBeNull();
    expect(localStorage.getItem('community_lastSeen_c1')).toBeNull();
  });

  it('from one channel’s messages to another channel, no render for it shows the earlier channel’s messages (R371.1)', async () => {
    messagesBy((id) =>
      id === 'c1'
        ? Promise.resolve(page(message('m1', 'c1', 'content one')))
        : new Promise(() => undefined),
    );
    await mount();
    expect(screen.getByText('content one')).toBeInTheDocument();
    commits.length = 0;
    await openChannel('random');
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('content one');
    }
  });

  it('a load pending when the page unmounts settles and marks nothing read (R371.3)', async () => {
    const forC1 = held<Page>();
    messagesBy(() => forC1.promise);
    const view = await mount();
    view.unmount();
    await act(async () => {
      forC1.resolve(page(message('m1', 'c1', 'content one')));
    });
    expect(localStorage.getItem('community_lastSeen_c1')).toBeNull();
  });

  it('of two loads for one channel, an older one that fails last leaves the newer one’s messages (R381.1)', async () => {
    const older = held<Page>();
    const newer = held<Page>();
    let reads = 0;
    messagesBy(() => {
      reads += 1;
      return reads === 1 ? older.promise : newer.promise;
    });
    await mount();
    await liveEvent('/ws/channels/c1/stream');
    expect(reads).toBe(2);
    await act(async () => {
      newer.resolve(page(message('m1', 'c1', 'content one')));
    });
    await act(async () => {
      older.reject(new Error('older failed'));
    });
    expect(screen.getByText('content one')).toBeInTheDocument();
    // The older load's failure is not reported: the newer one succeeded.
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('a live event kept from an earlier channel, run after the page moved to another, starts no load, and that channel’s load still writes (R390.3a)', async () => {
    const forC2 = held<Page>();
    messagesBy((id) =>
      id === 'c1'
        ? Promise.resolve(page(message('m1', 'c1', 'content one')))
        : forC2.promise,
    );
    await mount();
    const forC1 = ws.handlers.get('/ws/channels/c1/stream');
    await openChannel('random');
    await act(async () => {
      forC1?.({
        type: 'CommunityMessagePosted',
        channel_id: 'c1',
      } as unknown as WsEchoEvent);
    });
    await act(async () => {
      forC2.resolve(page(message('m2', 'c2', 'content two')));
    });
    expect(screen.getByText('content two')).toBeInTheDocument();
  });

  it('a reload started while a message is being sent writes nothing after the send’s answer (R390.3b)', async () => {
    const reload = held<Page>();
    const after = held<Page>();
    let reads = 0;
    messagesBy(() => {
      reads += 1;
      if (reads === 1)
        return Promise.resolve(page(message('m1', 'c1', 'content one')));
      return reads === 2 ? reload.promise : after.promise;
    });
    const answer = held<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
    await mount();
    await act(async () => {
      fireEvent.change(
        screen.getByRole('textbox', {
          name: t('community.messagePlaceholder'),
        }),
        { target: { value: 'hello there' } },
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: t('community.sendMessage') }),
      );
    });
    // A live event reloads the channel while the send is pending.
    await liveEvent('/ws/channels/c1/stream');
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'hello there'));
    });
    expect(screen.getByText('hello there')).toBeInTheDocument();
    // The reload read the channel before the message landed.
    await act(async () => {
      reload.resolve(page(message('m1', 'c1', 'content one')));
    });
    expect(screen.getByText('hello there')).toBeInTheDocument();
    // The read started after the answer (R422.2) holds the message.
    expect(reads).toBe(3);
    await act(async () => {
      after.resolve(
        page(
          message('m1', 'c1', 'content one'),
          message('m3', 'c1', 'hello there'),
        ),
      );
    });
    expect(screen.getAllByText('hello there')).toHaveLength(1);
  });
});
