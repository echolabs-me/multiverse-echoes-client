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

vi.mock('../src/lib/api/endpoints.ts', () => ({
  channels: {
    list: vi.fn().mockResolvedValue([]),
    messages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
  },
  reports: { create: vi.fn() },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'community.channels': 'Channels',
        'community.noChannels': 'No channels yet',
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
