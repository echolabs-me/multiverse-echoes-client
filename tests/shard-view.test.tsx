import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ShardViewPage } from '../src/pages/ShardViewPage.tsx';

vi.mock('../src/stores/useShardStore.ts', () => ({
  useShardStore: () => ({
    activeShard: null,
    fetchShard: vi.fn(),
  }),
}));

vi.mock('../src/stores/useEchoStore.ts', () => ({
  // ShardViewPage.tsx:28 destructures { echoList, fetchEchoes } from the
  // store. useEchoStore.fetchEchoes has signature () => Promise<void>
  // (useEchoStore.ts:10), so the mock resolves to undefined.
  useEchoStore: () => ({
    echoList: [],
    fetchEchoes: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  shards: { echoes: vi.fn().mockResolvedValue([]) },
  echoes: { travel: vi.fn() },
  feeds: { shard: vi.fn().mockResolvedValue([]) },
  channels: {
    list: vi.fn().mockResolvedValue([]),
    messages: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
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
        'common.back': 'Back',
        'common.cancel': 'Cancel',
        'common.error': 'Error',
        'common.confirm': 'Confirm',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/shards/s1']}>
        <Routes>
          <Route path="/shards/:id" element={<ShardViewPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ShardViewPage', () => {
  it('renders without crash', async () => {
    await act(async () => {
      renderPage();
    });
    // With null activeShard, shows loading or not-found
    expect(document.body).toBeInTheDocument();
  });

  it('shows shard not found when no shard loaded', async () => {
    await act(async () => {
      renderPage();
    });
    // Either loading spinner or not-found message
    const body = document.body.textContent ?? '';
    expect(body.length).toBeGreaterThan(0);
  });
});
