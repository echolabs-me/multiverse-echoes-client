import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ShardBrowserPage } from '../src/pages/ShardBrowserPage.tsx';

vi.mock('../src/stores/useShardStore.ts', () => ({
  useShardStore: () => ({
    shardList: [],
    isLoading: false,
    fetchShards: vi.fn(),
  }),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'shardBrowser.title': 'Explore Shards',
        'shardBrowser.searchPlaceholder': 'Search shards...',
        'shardBrowser.empty': 'No shards found',
        'shardBrowser.emptyDesc': 'Check back later for new worlds',
        'common.back': 'Back',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/shards']}>
        <ShardBrowserPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ShardBrowserPage', () => {
  it('renders page title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Explore Shards')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    await act(async () => {
      renderPage();
    });
    expect(
      screen.getByPlaceholderText('Search shards...'),
    ).toBeInTheDocument();
  });

  it('shows empty state when no shards', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('No shards found')).toBeInTheDocument();
  });
});
