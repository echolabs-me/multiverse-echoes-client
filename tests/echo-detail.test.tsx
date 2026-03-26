import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EchoDetailPage } from '../src/pages/EchoDetailPage.tsx';

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    activeEcho: null,
    fetchEcho: vi.fn(),
    hibernateEcho: vi.fn(),
    wakeEcho: vi.fn(),
  }),
}));

vi.mock('../src/stores/useFeedStore.ts', () => ({
  useFeedStore: () => ({
    personalFeed: [],
    fetchPersonalFeed: vi.fn(),
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
    diary: vi.fn().mockResolvedValue([]),
    influence: vi.fn().mockResolvedValue({ remaining: 5, daily_limit: 10 }),
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
          <Route path="/echoes/:id" element={<EchoDetailPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EchoDetailPage', () => {
  it('renders without crash and shows loading', async () => {
    await act(async () => {
      renderPage();
    });
    // Page shows loading state initially while fetching echo
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not crash with null activeEcho', async () => {
    await act(async () => {
      renderPage();
    });
    // No uncaught errors means the component handles null echo gracefully
    expect(document.body).toBeInTheDocument();
  });
});
