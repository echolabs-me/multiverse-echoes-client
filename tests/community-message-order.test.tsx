import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { CommunityPage } from '../src/pages/CommunityPage.tsx';
import { CommunitySidebar } from '../src/components/CommunitySidebar.tsx';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { account, channels } from '../src/lib/api/endpoints.ts';
import type { Channel, ChannelMessage, WsEchoEvent } from '../src/types/api.ts';

// R594: the server answers a channel's messages newest first; both views
// hold and draw them oldest first, mark the newest as last seen, and show a
// sent or live message after the newest.
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

function message(id: string, content: string, minute: number): ChannelMessage {
  return {
    message_id: id,
    channel_id: 'c1',
    author_id: `author-${id}`,
    author_display_name: `Author ${id}`,
    author_removed: false,
    external_author_name: null,
    content,
    message_type: 'UserMessage',
    created_at: `2026-09-30T00:${String(minute).padStart(2, '0')}:00Z`,
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

// As the server answers: newest first.
let newestFirst: ChannelMessage[] = [];

const views: Array<[string, () => ReactElement]> = [
  ['CommunityPage', () => <CommunityPage />],
  ['CommunitySidebar', () => <CommunitySidebar />],
];

async function mount(view: ReactElement) {
  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/community']}>{view}</MemoryRouter>
      </I18nextProvider>,
    );
  });
}

/** The given contents in the order the view draws them. */
function drawnOrder(...contents: string[]): string[] {
  const nodes = contents.map((c) => screen.getByText(c));
  return [...nodes]
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .map((n) => n.textContent ?? '');
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  ws.handlers.clear();
  localStorage.clear();
  for (const fn of Object.values(channels)) vi.mocked(fn).mockReset();
  vi.mocked(channels.list).mockResolvedValue([channel]);
  vi.mocked(account.discordStatus).mockResolvedValue({
    linked: true,
    discord_user_id: '1001',
    discord_username: 'tester',
    sync_display_name: false,
  });
  newestFirst = [
    message('m3', 'third and newest', 3),
    message('m2', 'second', 2),
    message('m1', 'first and oldest', 1),
  ];
  vi.mocked(channels.messages).mockImplementation(
    (_id: string, opts?: { limit?: number }) =>
      Promise.resolve({
        data: newestFirst.slice(0, opts?.limit ?? newestFirst.length),
        next_cursor: null,
      } as unknown as Page),
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe.each(views)('%s shows a channel oldest first (R594)', (_, view) => {
  it('draws the oldest message first and the newest last, and marks the newest as last seen', async () => {
    await mount(view());
    expect(
      drawnOrder('second', 'third and newest', 'first and oldest'),
    ).toEqual(['first and oldest', 'second', 'third and newest']);
    expect(localStorage.getItem('community_lastSeen_c1')).toBe('m3');
  });

  it('shows a live message after the newest, and marks it as last seen', async () => {
    await mount(view());
    newestFirst = [message('m4', 'live and newer', 4), ...newestFirst];
    await act(async () => {
      ws.handlers.get('/ws/channels/c1/stream')?.({
        type: 'CommunityMessagePosted',
        channel_id: 'c1',
      } as unknown as WsEchoEvent);
    });
    expect(
      drawnOrder('live and newer', 'first and oldest', 'third and newest'),
    ).toEqual(['first and oldest', 'third and newest', 'live and newer']);
    expect(localStorage.getItem('community_lastSeen_c1')).toBe('m4');
  });

  it('shows a sent message after the newest', async () => {
    await mount(view());
    vi.mocked(channels.sendMessage).mockResolvedValue(
      message('m5', 'just sent', 5),
    );
    // Any read after the send is held, so what shows is the view's own
    // write of the answer.
    vi.mocked(channels.messages).mockImplementation(
      () => new Promise<never>(() => {}),
    );
    const input = screen.getByPlaceholderText(
      t('community.messagePlaceholder'),
    );
    await act(async () => {
      fireEvent.change(input, { target: { value: 'just sent' } });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(
      drawnOrder('just sent', 'first and oldest', 'third and newest'),
    ).toEqual(['first and oldest', 'third and newest', 'just sent']);
  });
});

describe.each(views)(
  '%s places a delayed answer oldest first (R594)',
  (_, view) => {
    it('a send answered after a live read landed a newer message is drawn before it, when the read after the answer fails', async () => {
      await mount(view());
      const answer = deferred<ChannelMessage>();
      vi.mocked(channels.sendMessage).mockImplementation(() => answer.promise);
      const input = screen.getByPlaceholderText(
        t('community.messagePlaceholder'),
      );
      await act(async () => {
        fireEvent.change(input, { target: { value: 'just sent' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
      // A live message lands while the send is pending.
      newestFirst = [message('m6', 'live and newer', 6), ...newestFirst];
      await act(async () => {
        ws.handlers.get('/ws/channels/c1/stream')?.({
          type: 'CommunityMessagePosted',
          channel_id: 'c1',
        } as unknown as WsEchoEvent);
      });
      expect(screen.getByText('live and newer')).toBeTruthy();
      // The send's answer, older than the live message, then the read after
      // it fails, so what shows is the view's own write of the answer.
      vi.mocked(channels.messages).mockRejectedValue(new Error('read failed'));
      await act(async () => {
        answer.resolve(message('m5', 'just sent', 5));
      });
      expect(
        drawnOrder('live and newer', 'just sent', 'third and newest'),
      ).toEqual(['third and newest', 'just sent', 'live and newer']);
    });
  },
);

describe('CommunitySidebar writes only its latest read (R594)', () => {
  it('an earlier read that lands last changes neither the list nor last seen', async () => {
    const older = [message('m1', 'first and oldest', 1)];
    let landFirstRead: (page: Page) => void = () => {};
    vi.mocked(channels.messages).mockImplementationOnce(
      () =>
        new Promise<Page>((resolve) => {
          landFirstRead = resolve;
        }),
    );
    await mount(<CommunitySidebar />);
    // A live message starts a second read, which lands first.
    await act(async () => {
      ws.handlers.get('/ws/channels/c1/stream')?.({
        type: 'CommunityMessagePosted',
        channel_id: 'c1',
      } as unknown as WsEchoEvent);
    });
    expect(screen.getByText('third and newest')).toBeTruthy();
    expect(localStorage.getItem('community_lastSeen_c1')).toBe('m3');
    // The first read lands last, with an older answer.
    await act(async () => {
      landFirstRead({ data: older, next_cursor: null } as unknown as Page);
    });
    expect(screen.getByText('third and newest')).toBeTruthy();
    expect(localStorage.getItem('community_lastSeen_c1')).toBe('m3');
  });
});

/** A promise and the function that settles it. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const other: Channel = { ...channel, channel_id: 'c2', name: 'random' };

async function sendFromSidebar(text: string) {
  const input = screen.getByPlaceholderText(t('community.messagePlaceholder'));
  await act(async () => {
    fireEvent.change(input, { target: { value: text } });
  });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

async function openChannel(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByText('general'));
  });
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

describe('CommunitySidebar shows a sent message once, in its own channel (R594)', () => {
  it('a read started before a send that lands after its answer keeps the sent message', async () => {
    await mount(<CommunitySidebar />);
    const before = deferred<Page>();
    vi.mocked(channels.messages)
      .mockImplementationOnce(() => before.promise)
      .mockImplementation(() => new Promise<never>(() => {}));
    await act(async () => {
      ws.handlers.get('/ws/channels/c1/stream')?.({
        type: 'CommunityMessagePosted',
        channel_id: 'c1',
      } as unknown as WsEchoEvent);
    });
    vi.mocked(channels.sendMessage).mockResolvedValue(
      message('m5', 'just sent', 5),
    );
    await sendFromSidebar('just sent');
    expect(screen.getByText('just sent')).toBeTruthy();
    await act(async () => {
      before.resolve({
        data: newestFirst,
        next_cursor: null,
      } as unknown as Page);
    });
    expect(screen.getByText('just sent')).toBeTruthy();
  });

  it('a read that lands holding the sent message before its answer draws it once', async () => {
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockImplementation(() => answer.promise);
    await sendFromSidebar('just sent');
    newestFirst = [message('m5', 'just sent', 5), ...newestFirst];
    await act(async () => {
      ws.handlers.get('/ws/channels/c1/stream')?.({
        type: 'CommunityMessagePosted',
        channel_id: 'c1',
      } as unknown as WsEchoEvent);
    });
    vi.mocked(channels.messages).mockImplementation(
      () => new Promise<never>(() => {}),
    );
    await act(async () => {
      answer.resolve(message('m5', 'just sent', 5));
    });
    expect(screen.getAllByText('just sent')).toHaveLength(1);
  });

  it('an answer that arrives after a switch to another channel is not shown there', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockImplementation(() => answer.promise);
    await sendFromSidebar('just sent');
    vi.mocked(channels.messages).mockResolvedValue({
      data: [{ ...message('o1', 'in random', 1), channel_id: 'c2' }],
      next_cursor: null,
    } as unknown as Page);
    await openChannel('random');
    expect(screen.getByText('in random')).toBeTruthy();
    await act(async () => {
      answer.resolve(message('m5', 'just sent', 5));
    });
    expect(screen.queryByText('just sent')).toBeNull();
  });

  it('a failed read of another channel says so and shows none of the earlier channel', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    expect(screen.getByText('third and newest')).toBeTruthy();
    vi.mocked(channels.messages).mockRejectedValue(new Error('read failed'));
    await openChannel('random');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(screen.queryByText('third and newest')).toBeNull();
  });
});

describe('CommunitySidebar composer and a send before the first read (R594)', () => {
  it('a send answered after a switch to another channel clears the sent text', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockImplementation(() => answer.promise);
    await sendFromSidebar('just sent');
    vi.mocked(channels.messages).mockResolvedValue({
      data: [],
      next_cursor: null,
    } as unknown as Page);
    await openChannel('random');
    await act(async () => {
      answer.resolve(message('m5', 'just sent', 5));
    });
    expect(
      (
        screen.getByPlaceholderText(
          t('community.messagePlaceholder'),
        ) as HTMLInputElement
      ).value,
    ).toBe('');
  });

  it('a sent message is not drawn alone before a read of its channel has landed', async () => {
    // The first read is held; the read the answer starts fails, which ends
    // the loading with no messages, so only the answer's own write could
    // draw the message.
    vi.mocked(channels.messages)
      .mockImplementationOnce(() => new Promise<never>(() => {}))
      .mockRejectedValueOnce(new Error('read failed'));
    await mount(<CommunitySidebar />);
    vi.mocked(channels.sendMessage).mockResolvedValue(
      message('m5', 'just sent', 5),
    );
    await sendFromSidebar('just sent');
    expect(channels.messages).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('just sent')).toBeNull();
  });
});

describe('CommunitySidebar keeps a send to its own visit (R594, R483.1)', () => {
  it('an answer from an earlier visit to the channel shown again is not shown', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockImplementation(() => answer.promise);
    await sendFromSidebar('just sent');
    vi.mocked(channels.messages).mockImplementation((id: string) =>
      Promise.resolve({
        data:
          id === 'c2'
            ? [{ ...message('o1', 'in random', 1), channel_id: 'c2' }]
            : newestFirst,
        next_cursor: null,
      } as unknown as Page),
    );
    await openChannel('random');
    expect(screen.getByText('in random')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('random'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('general'));
    });
    expect(screen.queryByText('in random')).toBeNull();
    expect(screen.getByText('third and newest')).toBeTruthy();
    vi.mocked(channels.messages).mockImplementation(
      () => new Promise<never>(() => {}),
    );
    await act(async () => {
      answer.resolve(message('m5', 'just sent', 5));
    });
    expect(screen.queryByText('just sent')).toBeNull();
  });
});

describe('CommunitySidebar after a failed send and a created poll (R594)', () => {
  it('a send that fails after a switch to another channel keeps its text and says nothing', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockImplementation(() => answer.promise);
    await sendFromSidebar('just sent');
    await openChannel('random');
    await act(async () => {
      answer.reject(new Error('send failed'));
    });
    expect(
      (
        screen.getByPlaceholderText(
          t('community.messagePlaceholder'),
        ) as HTMLInputElement
      ).value,
    ).toBe('just sent');
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('a poll whose read is superseded by its live event still says so and frees the composer', async () => {
    await mount(<CommunitySidebar />);
    vi.mocked(channels.createPoll).mockResolvedValue(
      {} as Awaited<ReturnType<typeof channels.createPoll>>,
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle(t('community.createPoll')));
    });
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(t('community.pollQuestion')),
        {
          target: { value: 'Which?' },
        },
      );
      fireEvent.change(
        screen.getByPlaceholderText(i18n.t('community.pollOption', { n: 1 })),
        { target: { value: 'One' } },
      );
      fireEvent.change(
        screen.getByPlaceholderText(i18n.t('community.pollOption', { n: 2 })),
        { target: { value: 'Two' } },
      );
    });
    // The read the poll starts is held, and its live event's read lands.
    vi.mocked(channels.messages).mockImplementationOnce(
      () => new Promise<never>(() => {}),
    );
    await act(async () => {
      fireEvent.click(screen.getByText(t('community.createPoll')));
    });
    await act(async () => {
      ws.handlers.get('/ws/channels/c1/stream')?.({
        type: 'CommunityMessagePosted',
        channel_id: 'c1',
      } as unknown as WsEchoEvent);
    });
    expect(
      useToastStore.getState().toasts.map((toast) => toast.message),
    ).toContain(t('community.pollCreated'));
    expect(
      (screen.getByTitle(t('community.createPoll')) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it('an upload that fails after a switch to another channel says nothing', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.uploadImage).mockImplementation(() => answer.promise);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
      });
    });
    expect(channels.uploadImage).toHaveBeenCalledTimes(1);
    await openChannel('random');
    await act(async () => {
      answer.reject(new Error('upload failed'));
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

// R633: the sidebar shares the page's message hook. Each action that
// writes captures its visit when it starts and, answered or failed in a
// later visit, shows nothing; the poll form belongs to its channel.
describe('CommunitySidebar keeps each action to its visit (R633)', () => {
  const poll: ChannelMessage = {
    ...message('p1', 'a poll', 4),
    poll_data: JSON.stringify({
      question: 'Which one?',
      options: [
        { id: 1, text: 'This one', votes: 0 },
        { id: 2, text: 'That one', votes: 0 },
      ],
      discord_message_id: 'dm1',
      discord_channel_id: 'dc1',
    }),
  };

  async function fillPollForm() {
    await act(async () => {
      fireEvent.click(screen.getByTitle(t('community.createPoll')));
    });
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(t('community.pollQuestion')),
        { target: { value: 'Which?' } },
      );
      fireEvent.change(
        screen.getByPlaceholderText(i18n.t('community.pollOption', { n: 1 })),
        { target: { value: 'One' } },
      );
      fireEvent.change(
        screen.getByPlaceholderText(i18n.t('community.pollOption', { n: 2 })),
        { target: { value: 'Two' } },
      );
    });
  }

  it.each([
    ['answered', true],
    ['failed', false],
  ])(
    'a vote %s after a switch to another channel says nothing',
    async (_, succeeds) => {
      vi.mocked(channels.list).mockResolvedValue([channel, other]);
      newestFirst = [poll, ...newestFirst];
      await mount(<CommunitySidebar />);
      const answer = deferred<Awaited<ReturnType<typeof channels.pollVote>>>();
      vi.mocked(channels.pollVote).mockImplementation(() => answer.promise);
      await act(async () => {
        fireEvent.click(screen.getByText('This one'));
      });
      expect(channels.pollVote).toHaveBeenCalledTimes(1);
      await openChannel('random');
      await act(async () => {
        if (succeeds) answer.resolve(undefined as never);
        else answer.reject(new Error('vote failed'));
      });
      expect(useToastStore.getState().toasts).toHaveLength(0);
    },
  );

  it.each([
    ['answered', true],
    ['failed', false],
  ])(
    'a poll created and %s after a switch to another channel says nothing',
    async (_, succeeds) => {
      vi.mocked(channels.list).mockResolvedValue([channel, other]);
      await mount(<CommunitySidebar />);
      await fillPollForm();
      const answer =
        deferred<Awaited<ReturnType<typeof channels.createPoll>>>();
      vi.mocked(channels.createPoll).mockImplementation(() => answer.promise);
      await act(async () => {
        fireEvent.click(screen.getByText(t('community.createPoll')));
      });
      expect(channels.createPoll).toHaveBeenCalledTimes(1);
      await openChannel('random');
      await act(async () => {
        if (succeeds) answer.resolve({} as never);
        else answer.reject(new Error('poll failed'));
      });
      expect(useToastStore.getState().toasts).toHaveLength(0);
    },
  );

  it('an upload answered in an earlier visit to the channel shown again is not shown', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const answer = deferred<ChannelMessage>();
    vi.mocked(channels.uploadImage).mockImplementation(() => answer.promise);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
      });
    });
    expect(channels.uploadImage).toHaveBeenCalledTimes(1);
    await openChannel('random');
    await act(async () => {
      fireEvent.click(screen.getByText('random'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('general'));
    });
    expect(screen.getByText('third and newest')).toBeTruthy();
    // Any read after the answer is held, so what shows is the view's own
    // write of the answer.
    vi.mocked(channels.messages).mockImplementation(
      () => new Promise<never>(() => {}),
    );
    await act(async () => {
      answer.resolve(message('m6', 'just uploaded', 6));
    });
    expect(screen.queryByText('just uploaded')).toBeNull();
  });

  it('a channel switched to shows it loading, not empty, until its read lands', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    const read = deferred<Page>();
    vi.mocked(channels.messages).mockImplementation(() => read.promise);
    await openChannel('random');
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText(t('community.noMessagesYet'))).toBeNull();
    await act(async () => {
      read.resolve({ data: [], next_cursor: null } as unknown as Page);
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(t('community.noMessagesYet'))).toBeTruthy();
  });

  it('the poll form closes on a switch to another channel', async () => {
    vi.mocked(channels.list).mockResolvedValue([channel, other]);
    await mount(<CommunitySidebar />);
    await fillPollForm();
    await openChannel('random');
    expect(
      screen.queryByPlaceholderText(t('community.pollQuestion')),
    ).toBeNull();
    // Opened again in the new channel, the form starts empty.
    await act(async () => {
      fireEvent.click(screen.getByTitle(t('community.createPoll')));
    });
    expect(
      (
        screen.getByPlaceholderText(
          t('community.pollQuestion'),
        ) as HTMLInputElement
      ).value,
    ).toBe('');
  });
});
