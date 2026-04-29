import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { CommunityPage } from '../src/pages/CommunityPage.tsx';

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
