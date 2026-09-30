import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { CommunityPage } from '../src/pages/CommunityPage.tsx';
import { CommunitySidebar } from '../src/components/CommunitySidebar.tsx';
import { account, channels } from '../src/lib/api/endpoints.ts';
import { useEchoWebSocket } from '../src/hooks/useEchoWebSocket.ts';
import type { Channel, ChannelMessage, WsEchoEvent } from '../src/types/api.ts';

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: () => ({
    user: { user_id: 'u1', display_name: 'Test', subscription_tier: 'Free' },
  }),
}));

// CommunityPage.tsx:24 imports useEchoWebSocket, which internally calls
// useAuthStore.subscribe (useEchoWebSocket.ts:63). The useAuthStore mock
// above is a bare function with no subscribe property — mocking out the
// hook avoids the chain entirely. Same approach used in dashboard-feed.test.tsx.
vi.mock('../src/hooks/useEchoWebSocket.ts', () => ({
  useEchoWebSocket: vi.fn(),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  channels: {
    list: vi.fn().mockResolvedValue([]),
    messages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
  },
  // CommunityPage.tsx:23 imports `account as accountApi` and line 79 calls
  // accountApi.discordStatus() in the initial-render useEffect. Return
  // shape matches endpoints.ts:408-410:
  //   { linked: boolean; discord_user_id?: string; discord_username?: string }
  // Line 80 destructures `s.linked` and `s.discord_username`.
  account: {
    discordStatus: vi.fn().mockResolvedValue({
      linked: false,
      discord_username: undefined,
    }),
  },
  reports: { create: vi.fn() },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'community.channels': 'Channels',
        // Source renamed the empty-state key to 'noChannelsDesc'
        // (CommunityPage.tsx:327). Asserting the empty-state contract
        // under the new key.
        'community.noChannelsDesc': 'No channels yet',
        'community.selectChannel': 'Select a channel',
        'community.noMessagesYet': 'No messages yet',
        'community.messagePlaceholder': 'Type a message...',
        'community.charCount': '{{count}}/{{max}}',
        'community.readOnly': 'Read only',
        'community.messageEdited': 'Edited',
        'community.messageDeleted': 'Deleted',
        'community.reportSent': 'Report sent',
        'community.reportReason': 'Report reason',
        'community.reportPlaceholder': 'Describe the issue',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.error': 'Error',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
        'common.report': 'Report',
        'community.formerMember': 'A former community member',
        'community.unknownUser': 'Unknown User',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/community']}>
        <CommunityPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

const NIL = '00000000-0000-0000-0000-000000000000';

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

function message(
  id: string,
  author_id: string,
  author_display_name: string,
  author_removed: boolean,
  content = `content ${id}`,
): ChannelMessage {
  return {
    message_id: id,
    channel_id: 'c1',
    author_id,
    author_display_name,
    author_removed,
    content,
    message_type: 'UserMessage',
    created_at: '2026-09-30T00:00:00Z',
    edited_at: null,
    is_edited: false,
    can_edit: false,
    can_delete: false,
    image_url: null,
    poll_data: null,
  };
}

/** A removed author, then an unlinked Discord relay (both the nil author),
 *  then a named user, all within the grouping window. The relay has the shape
 *  the API sends it in: the nil author named "Unknown", not removed, with the
 *  Discord name inside its content. */
const removedThenRelay = [
  message('m1', NIL, 'Unknown', true),
  message('m2', NIL, 'Unknown', false, 'Discord | visitor: hello'),
  message('m3', 'u2', 'Alice', false),
];

function withMessages(msgs: ChannelMessage[]) {
  vi.mocked(channels.list).mockResolvedValue([channel]);
  vi.mocked(channels.messages).mockResolvedValue({
    data: msgs,
  } as unknown as Awaited<ReturnType<typeof channels.messages>>);
}

/** The removed author is shown as a former member, and the relay under its
 *  own header rather than grouped under the former member's. */
function expectAuthorsShown() {
  expect(screen.getByText('A former community member')).toBeInTheDocument();
  expect(screen.getByText('Unknown')).toBeInTheDocument();
  expect(screen.getByText('Discord | visitor: hello')).toBeInTheDocument();
  expect(screen.getByText('Alice')).toBeInTheDocument();
}

function mountSidebar() {
  // The sidebar lists messages only once Discord is linked.
  vi.mocked(account.discordStatus).mockResolvedValueOnce({
    linked: true,
    discord_username: 'tester',
  });
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <CommunitySidebar />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

/** The handler the view last gave its channel's stream. */
function channelStreamHandler(): (event: WsEchoEvent) => void {
  const call = vi
    .mocked(useEchoWebSocket)
    .mock.calls.filter(([path]) => path === '/ws/channels/c1/stream')
    .at(-1);
  if (!call) throw new Error('the view opened no stream for its channel');
  return call[1];
}

describe('removed authors (R211, R212.2)', () => {
  afterEach(() => {
    vi.mocked(channels.list).mockResolvedValue([]);
    vi.mocked(channels.messages).mockResolvedValue(
      [] as unknown as Awaited<ReturnType<typeof channels.messages>>,
    );
  });

  it('CommunityPage shows a removed author as a former community member', async () => {
    withMessages(removedThenRelay);
    await act(async () => {
      renderPage();
    });
    expectAuthorsShown();
  });

  it('CommunitySidebar shows a removed author as a former community member', async () => {
    withMessages(removedThenRelay);
    await act(async () => {
      mountSidebar();
    });
    expectAuthorsShown();
  });
});

describe('anonymised messages (R217.2)', () => {
  afterEach(() => {
    vi.mocked(channels.list).mockResolvedValue([]);
    vi.mocked(channels.messages).mockResolvedValue(
      [] as unknown as Awaited<ReturnType<typeof channels.messages>>,
    );
  });

  it.each([
    ['CommunityPage', renderPage],
    ['CommunitySidebar', mountSidebar],
  ])(
    '%s reloads its messages when its channel is named, and only then',
    async (_name, mount) => {
      withMessages(removedThenRelay);
      await act(async () => {
        mount();
      });
      const loads = () => vi.mocked(channels.messages).mock.calls.length;
      const before = loads();

      await act(async () => {
        channelStreamHandler()({
          type: 'ChannelMessagesAnonymised',
          channel_ids: ['c2'],
        });
      });
      expect(loads()).toBe(before);

      await act(async () => {
        channelStreamHandler()({
          type: 'ChannelMessagesAnonymised',
          channel_ids: ['c2', 'c1'],
        });
      });
      expect(loads()).toBe(before + 1);
    },
  );
});

describe('CommunityPage', () => {
  it('renders channels heading', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Channels')).toBeInTheDocument();
  });

  it('shows empty channel state', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('No channels yet')).toBeInTheDocument();
  });
});
