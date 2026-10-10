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

// R422.2 and R422.3 on the community page: an action's answer is followed
// by a full read of the channel, whose answer replaces the list, and what
// the page shows for a channel (the draft, a send in flight, the poll form,
// the inline editor and a message's menu) belongs to that channel.
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

function mine(id: string, channelId: string, content: string): ChannelMessage {
  return {
    ...message(id, channelId, content),
    can_edit: true,
    can_delete: true,
  };
}

/** Answers each read of a channel's messages, in order, with the next of
 *  `reads`; `count()` says how many were made. */
function readsInOrder(...reads: Promise<Page>[]) {
  let made = 0;
  messagesBy(() => {
    made += 1;
    return reads[made - 1] ?? new Promise(() => undefined);
  });
  return { count: () => made };
}

function composer() {
  return screen.getByRole('textbox', {
    name: t('community.messagePlaceholder'),
  }) as HTMLInputElement;
}

async function type(text: string) {
  await act(async () => {
    fireEvent.change(composer(), { target: { value: text } });
  });
}

async function send() {
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: t('community.sendMessage') }),
    );
  });
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

/** Opens the first message's menu and chooses `action`. */
async function openMenuAnd(action: string) {
  await act(async () => {
    fireEvent.click(
      screen.getAllByRole('button', { name: t('common.messageActions') })[0]!,
    );
  });
  await click(action);
}

describe('CommunityPage: a full read after every answer (R422.2)', () => {
  it('a message sent before the channel’s first read lands is not shown without the channel’s history, and the read after the answer shows the history with the message once', async () => {
    const first = held<Page>();
    const after = held<Page>();
    const reads = readsInOrder(first.promise, after.promise);
    const answer = held<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
    await mount();
    await type('hello there');
    await send();
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'hello there'));
    });
    // No read has filled the list: the answer is not merged into it.
    expect(screen.queryByText('hello there')).toBeNull();
    expect(reads.count()).toBe(2);
    await act(async () => {
      first.resolve(page());
    });
    expect(screen.queryByText('hello there')).toBeNull();
    await act(async () => {
      after.resolve(
        page(
          message('m1', 'c1', 'content one'),
          message('m3', 'c1', 'hello there'),
        ),
      );
    });
    expect(screen.getByText('content one')).toBeInTheDocument();
    expect(screen.getAllByText('hello there')).toHaveLength(1);
  });

  it.each(['answered', 'refused'] as const)(
    'a send that superseded the channel’s first read writes nothing from that read, and when it is %s the read it starts shows the history and ends the loading (R463.2)',
    async (outcome) => {
      const first = held<Page>();
      const after = held<Page>();
      const reads = readsInOrder(first.promise, after.promise);
      const answer = held<ChannelMessage>();
      vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
      await mount();
      await type('hello there');
      await send();
      // The first read lands while the send is pending: the send
      // superseded it, so it writes nothing and the channel still loads.
      await act(async () => {
        first.resolve(page(message('m0', 'c1', 'superseded read')));
      });
      expect(screen.queryByText('superseded read')).toBeNull();
      expect(screen.queryByText(t('community.noMessagesYet'))).toBeNull();
      expect(reads.count()).toBe(1);
      await act(async () => {
        if (outcome === 'answered') {
          answer.resolve(message('m3', 'c1', 'hello there'));
        } else {
          answer.reject(new Error('refused'));
        }
      });
      expect(reads.count()).toBe(2);
      await act(async () => {
        after.resolve(page(message('m1', 'c1', 'content one')));
      });
      expect(screen.getByText('content one')).toBeInTheDocument();
      expect(screen.queryByText('superseded read')).toBeNull();
    },
  );

  it('a message sent before the channel’s first read lands is not shown alone when the read after the answer fails', async () => {
    const first = held<Page>();
    const after = held<Page>();
    readsInOrder(first.promise, after.promise);
    vi.mocked(channels.sendMessage).mockResolvedValue(
      message('m3', 'c1', 'hello there'),
    );
    await mount();
    await type('hello there');
    await send();
    await act(async () => {
      after.reject(new Error('read failed'));
    });
    expect(screen.getByText(t('community.noMessagesYet'))).toBeInTheDocument();
    expect(screen.queryByText('hello there')).toBeNull();
  });

  it('an image uploaded before the channel’s first read lands is not shown without the channel’s history, and the read after the answer shows the history with the image once', async () => {
    const first = held<Page>();
    const after = held<Page>();
    const reads = readsInOrder(first.promise, after.promise);
    const answer = held<ChannelMessage>();
    vi.mocked(channels.uploadImage).mockReturnValue(answer.promise);
    const view = await mount();
    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [new File(['x'], 'a.png', { type: 'image/png' })],
        },
      });
    });
    expect(channels.uploadImage).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'an image'));
    });
    expect(screen.queryByText('an image')).toBeNull();
    expect(reads.count()).toBe(2);
    await act(async () => {
      first.resolve(page());
    });
    expect(screen.queryByText('an image')).toBeNull();
    await act(async () => {
      after.resolve(
        page(
          message('m1', 'c1', 'content one'),
          message('m3', 'c1', 'an image'),
        ),
      );
    });
    expect(screen.getByText('content one')).toBeInTheDocument();
    expect(screen.getAllByText('an image')).toHaveLength(1);
  });

  it('an edit whose answer lands while a live reload is pending shows the edit, and the read after it shows the reload’s new message', async () => {
    const reload = held<Page>();
    const after = held<Page>();
    const reads = readsInOrder(
      Promise.resolve(page(mine('m1', 'c1', 'content one'))),
      reload.promise,
      after.promise,
    );
    const answer = held<ChannelMessage>();
    vi.mocked(channels.editMessage).mockReturnValue(answer.promise);
    await mount();
    await openMenuAnd(t('common.edit'));
    await act(async () => {
      fireEvent.change(
        screen.getByRole('textbox', { name: t('community.editMessageLabel') }),
        { target: { value: 'content edited' } },
      );
    });
    await click(t('common.save'));
    await liveEvent('/ws/channels/c1/stream');
    expect(reads.count()).toBe(2);
    await act(async () => {
      answer.resolve(mine('m1', 'c1', 'content edited'));
    });
    expect(screen.getByText('content edited')).toBeInTheDocument();
    expect(reads.count()).toBe(3);
    await act(async () => {
      reload.resolve(
        page(mine('m1', 'c1', 'content one'), message('m2', 'c1', 'news')),
      );
    });
    // The reload was started before the answer: it writes nothing.
    expect(screen.getByText('content edited')).toBeInTheDocument();
    await act(async () => {
      after.resolve(
        page(mine('m1', 'c1', 'content edited'), message('m2', 'c1', 'news')),
      );
    });
    expect(screen.getByText('content edited')).toBeInTheDocument();
    expect(screen.getByText('news')).toBeInTheDocument();
  });

  it('a delete whose answer lands while a live reload is pending removes the message, and the read after it shows the reload’s new message', async () => {
    const reload = held<Page>();
    const after = held<Page>();
    const reads = readsInOrder(
      Promise.resolve(
        page(mine('m1', 'c1', 'content one'), message('m0', 'c1', 'kept')),
      ),
      reload.promise,
      after.promise,
    );
    const answer = held<{ deleted: boolean }>();
    vi.mocked(channels.deleteMessage).mockReturnValue(answer.promise);
    await mount();
    await openMenuAnd(t('common.delete'));
    await liveEvent('/ws/channels/c1/stream');
    expect(reads.count()).toBe(2);
    await act(async () => {
      answer.resolve({ deleted: true });
    });
    expect(screen.queryByText('content one')).toBeNull();
    expect(reads.count()).toBe(3);
    await act(async () => {
      after.resolve(
        page(message('m0', 'c1', 'kept'), message('m2', 'c1', 'news')),
      );
    });
    expect(screen.queryByText('content one')).toBeNull();
    expect(screen.getByText('news')).toBeInTheDocument();
  });

  it('a sent message a live reload already shows is shown once when the send’s answer lands', async () => {
    const reload = held<Page>();
    const after = held<Page>();
    readsInOrder(
      Promise.resolve(page(message('m1', 'c1', 'content one'))),
      reload.promise,
      after.promise,
    );
    const answer = held<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
    await mount();
    await type('hello there');
    await send();
    // The server announces the user's own message while the send is pending.
    await liveEvent('/ws/channels/c1/stream');
    await act(async () => {
      reload.resolve(
        page(
          message('m1', 'c1', 'content one'),
          message('m3', 'c1', 'hello there'),
        ),
      );
    });
    expect(screen.getAllByText('hello there')).toHaveLength(1);
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'hello there'));
    });
    expect(screen.getAllByText('hello there')).toHaveLength(1);
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

describe('CommunityPage: what it shows for a channel belongs to the channel (R422.3)', () => {
  it('a send pending in one channel leaves another channel’s composer free and its draft untouched when it lands, and the draft typed in each channel stays in it', async () => {
    messagesBy((id) =>
      Promise.resolve(page(message(`m-${id}`, id, `content ${id}`))),
    );
    const answer = held<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
    await mount();
    await type('from general');
    await send();
    await openChannel('random');
    expect(composer().value).toBe('');
    await type('from random');
    expect(
      screen.getByRole('button', { name: t('community.sendMessage') }),
    ).toBeEnabled();
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'from general'));
    });
    expect(composer().value).toBe('from random');
    // Answered while the page shows another channel, the send writes
    // nothing in the channel it was sent in, not even its draft (R483.1).
    await openChannel('general');
    expect(composer().value).toBe('from general');
    await openChannel('random');
    expect(composer().value).toBe('from random');
  });

  it('a draft that differs from what was sent only by spaces at its ends is cleared when the send is answered (R463.3)', async () => {
    readsInOrder(Promise.resolve(page()), Promise.resolve(page()));
    vi.mocked(channels.sendMessage).mockResolvedValue(
      message('m3', 'c1', 'hello there'),
    );
    await mount();
    await type('  hello there  ');
    await send();
    expect(channels.sendMessage).toHaveBeenCalledWith('c1', {
      content: 'hello there',
    });
    expect(composer().value).toBe('');
  });

  it('a draft of only spaces counts as empty: Send is disabled and nothing is sent (R463.3)', async () => {
    readsInOrder(Promise.resolve(page()));
    await mount();
    await type('   ');
    const button = screen.getByRole('button', {
      name: t('community.sendMessage'),
    });
    expect(button).toBeDisabled();
    await act(async () => {
      fireEvent.keyDown(composer(), { key: 'Enter' });
    });
    expect(channels.sendMessage).not.toHaveBeenCalled();
  });

  it('text typed while a send is pending stays in the draft when the send is answered (review of round 4)', async () => {
    readsInOrder(Promise.resolve(page()));
    const answer = held<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
    await mount();
    await type('hello there');
    await send();
    await type('and another thing');
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'hello there'));
    });
    expect(composer().value).toBe('and another thing');
  });

  it('a message sent on the first visit to a channel and answered after the page left it and came back is not written by its answer, which starts no read (R434.1)', async () => {
    messagesBy((id) =>
      Promise.resolve(page(message(`m-${id}`, id, `content ${id}`))),
    );
    const answer = held<ChannelMessage>();
    vi.mocked(channels.sendMessage).mockReturnValue(answer.promise);
    await mount();
    await type('from general');
    await send();
    await openChannel('random');
    await openChannel('general');
    expect(screen.getByText('content c1')).toBeInTheDocument();
    const readsOfGeneral = () =>
      vi
        .mocked(channels.messages)
        .mock.calls.filter(([id, opts]) => id === 'c1' && opts?.limit !== 1)
        .length;
    const before = readsOfGeneral();
    await act(async () => {
      answer.resolve(message('m3', 'c1', 'from general'));
    });
    expect(screen.queryByText('from general')).toBeNull();
    expect(screen.getByText('content c1')).toBeInTheDocument();
    expect(readsOfGeneral()).toBe(before);
  });

  it('the poll form open in one channel is closed in another, and a poll created in one channel leaves the form open in another', async () => {
    messagesBy((id) =>
      Promise.resolve(page(message(`m-${id}`, id, `content ${id}`))),
    );
    const created = held<{ created: boolean }>();
    vi.mocked(channels.createPoll).mockReturnValue(created.promise);
    await mount();
    await click(t('community.createPoll'));
    expect(
      screen.getByPlaceholderText(t('community.pollQuestion')),
    ).toBeInTheDocument();
    await openChannel('random');
    expect(
      screen.queryByPlaceholderText(t('community.pollQuestion')),
    ).toBeNull();
    await openChannel('general');
    expect(
      screen.queryByPlaceholderText(t('community.pollQuestion')),
    ).toBeNull();
    // Create a poll in general, then open the form in random before it lands.
    await click(t('community.createPoll'));
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(t('community.pollQuestion')),
        {
          target: { value: 'general question' },
        },
      );
      fireEvent.change(screen.getByPlaceholderText('Option 1'), {
        target: { value: 'a' },
      });
      fireEvent.change(screen.getByPlaceholderText('Option 2'), {
        target: { value: 'b' },
      });
    });
    await click('Create');
    expect(channels.createPoll).toHaveBeenCalledWith('c1', {
      question: 'general question',
      options: ['a', 'b'],
    });
    await openChannel('random');
    await click(t('community.createPoll'));
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(t('community.pollQuestion')),
        {
          target: { value: 'random question' },
        },
      );
    });
    await act(async () => {
      created.resolve({ created: true });
    });
    expect(
      screen.getByPlaceholderText(t('community.pollQuestion')),
    ).toHaveValue('random question');
  });

  it('the inline editor and a message’s menu open in one channel are closed when the page comes back to it from another', async () => {
    messagesBy((id) =>
      Promise.resolve(page(mine(`m-${id}`, id, `content ${id}`))),
    );
    await mount();
    await openMenuAnd(t('common.edit'));
    expect(
      screen.getByRole('textbox', { name: t('community.editMessageLabel') }),
    ).toBeInTheDocument();
    await openChannel('random');
    await openChannel('general');
    expect(
      screen.queryByRole('textbox', { name: t('community.editMessageLabel') }),
    ).toBeNull();
    await click(t('common.messageActions'));
    expect(
      screen.getByRole('button', { name: t('common.edit') }),
    ).toBeInTheDocument();
    await openChannel('random');
    await openChannel('general');
    expect(screen.queryByRole('button', { name: t('common.edit') })).toBeNull();
  });

  it('an edit that lands after the page moved to another channel leaves the editor open there', async () => {
    messagesBy((id) =>
      Promise.resolve(page(mine(`m-${id}`, id, `content ${id}`))),
    );
    const answer = held<ChannelMessage>();
    vi.mocked(channels.editMessage).mockReturnValue(answer.promise);
    await mount();
    await openMenuAnd(t('common.edit'));
    await click(t('common.save'));
    await openChannel('random');
    await openMenuAnd(t('common.edit'));
    await act(async () => {
      answer.resolve(mine('m-c1', 'c1', 'content c1'));
    });
    expect(
      screen.getByRole('textbox', { name: t('community.editMessageLabel') }),
    ).toHaveValue('content c2');
  });
});

describe('CommunityPage: a load kept from an earlier channel is no load (R390.3a)', () => {
  it('a poll created in one channel that lands after another channel opens leaves that channel’s messages shown and reads nothing of the earlier one', async () => {
    messagesBy((id) =>
      Promise.resolve(page(message(`m-${id}`, id, `content ${id}`))),
    );
    const created = held<{ created: boolean }>();
    vi.mocked(channels.createPoll).mockReturnValue(created.promise);
    await mount();
    await click(t('community.createPoll'));
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(t('community.pollQuestion')),
        { target: { value: 'general question' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Option 1'), {
        target: { value: 'a' },
      });
      fireEvent.change(screen.getByPlaceholderText('Option 2'), {
        target: { value: 'b' },
      });
    });
    await click('Create');
    await openChannel('random');
    expect(screen.getByText('content c2')).toBeInTheDocument();
    const readsOfGeneral = () =>
      vi
        .mocked(channels.messages)
        .mock.calls.filter(([id, opts]) => id === 'c1' && opts?.limit !== 1)
        .length;
    const before = readsOfGeneral();
    // The poll's answer reloads with the load it captured in general.
    await act(async () => {
      created.resolve({ created: true });
    });
    expect(screen.getByText('content c2')).toBeInTheDocument();
    expect(screen.queryByText('content c1')).toBeNull();
    expect(readsOfGeneral()).toBe(before);
  });
});

const POLL_DATA = JSON.stringify({
  question: 'Which shard?',
  options: [
    { id: 1, text: 'Tokyo', votes: 0 },
    { id: 2, text: 'Florence', votes: 0 },
  ],
  discord_message_id: 'd1',
  discord_channel_id: 'dc1',
});

type Action = 'send' | 'edit' | 'delete' | 'upload' | 'vote' | 'poll';

/** Starts `action` in general, held on `answer`. */
async function begin(
  action: Action,
  answer: Promise<unknown>,
  view: ReturnType<typeof render>,
) {
  switch (action) {
    case 'send':
      vi.mocked(channels.sendMessage).mockReturnValue(
        answer as Promise<ChannelMessage>,
      );
      await type('from general');
      await send();
      return;
    case 'edit':
      vi.mocked(channels.editMessage).mockReturnValue(
        answer as Promise<ChannelMessage>,
      );
      await openMenuAnd(t('common.edit'));
      await click(t('common.save'));
      return;
    case 'delete':
      vi.mocked(channels.deleteMessage).mockReturnValue(
        answer as Promise<{ deleted: boolean }>,
      );
      await openMenuAnd(t('common.delete'));
      return;
    case 'upload':
      vi.mocked(channels.uploadImage).mockReturnValue(
        answer as Promise<ChannelMessage>,
      );
      await act(async () => {
        fireEvent.change(view.container.querySelector('input[type="file"]')!, {
          target: {
            files: [new File(['x'], 'a.png', { type: 'image/png' })],
          },
        });
      });
      return;
    case 'vote':
      vi.mocked(channels.pollVote).mockReturnValue(
        answer as ReturnType<typeof channels.pollVote>,
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Tokyo/ }));
      });
      return;
    case 'poll':
      vi.mocked(channels.createPoll).mockReturnValue(
        answer as ReturnType<typeof channels.createPoll>,
      );
      await click(t('community.createPoll'));
      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText(t('community.pollQuestion')),
          { target: { value: 'general question' } },
        );
        fireEvent.change(screen.getByPlaceholderText('Option 1'), {
          target: { value: 'a' },
        });
        fireEvent.change(screen.getByPlaceholderText('Option 2'), {
          target: { value: 'b' },
        });
      });
      await click('Create');
      return;
  }
}

/** What an answer of `action` would write in a later visit, set up so an
 *  answer bound to that visit would change it: the same draft typed again,
 *  or the editor open again on the same message. The poll's answer has
 *  nothing to change there: switching channels closed its form, and the
 *  form's button stays disabled in the channel while the poll is pending. */
async function setUpThirdVisit(action: Action) {
  if (action === 'send') await type('from general');
  if (action === 'edit') await openMenuAnd(t('common.edit'));
}

function answerOf(action: Action, id: string): unknown {
  if (action === 'delete') return { deleted: true };
  if (action === 'vote') return undefined;
  if (action === 'poll') return { created: true };
  return mine(id, 'c1', 'the answer');
}

describe('CommunityPage: an action keeps the visit it began in (R483.1)', () => {
  const cases = (
    ['send', 'edit', 'delete', 'upload', 'vote', 'poll'] as const
  ).flatMap((action) =>
    (['succeeds', 'fails'] as const).map(
      (outcome) => [action, outcome] as const,
    ),
  );

  it.each(cases)(
    'a %s begun in the first visit to a channel that %s in a third writes nothing there and starts no read',
    async (action, outcome) => {
      messagesBy((id) =>
        Promise.resolve(
          page(mine(`m-${id}`, id, `content ${id}`), {
            ...message(`p-${id}`, id, ''),
            poll_data: POLL_DATA,
            created_at: '2026-09-30T01:00:00Z',
          }),
        ),
      );
      const answer = held<unknown>();
      const view = await mount();
      await begin(action, answer.promise, view);
      await openChannel('random');
      await openChannel('general');
      expect(screen.getByText('content c1')).toBeInTheDocument();
      await setUpThirdVisit(action);
      const readsOfGeneral = () =>
        vi
          .mocked(channels.messages)
          .mock.calls.filter(([id, opts]) => id === 'c1' && opts?.limit !== 1)
          .length;
      const before = readsOfGeneral();
      useToastStore.setState({ toasts: [] });
      await act(async () => {
        if (outcome === 'succeeds') answer.resolve(answerOf(action, 'm-new'));
        else answer.reject(new Error('boom'));
      });
      expect(readsOfGeneral()).toBe(before);
      expect(useToastStore.getState().toasts).toEqual([]);
      expect(screen.queryByText('the answer')).toBeNull();
      if (action !== 'edit') {
        expect(screen.getByText('content c1')).toBeInTheDocument();
      }
      if (action === 'send') expect(composer().value).toBe('from general');
      if (action === 'edit') {
        expect(
          screen.getByRole('textbox', {
            name: t('community.editMessageLabel'),
          }),
        ).toBeInTheDocument();
      }
    },
  );
});
