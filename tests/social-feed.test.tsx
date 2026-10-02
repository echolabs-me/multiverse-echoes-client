import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SocialFeedPage } from '../src/pages/SocialFeedPage.tsx';

const feed = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock('../src/stores/useFeedStore.ts', () => ({
  useFeedStore: () => ({
    socialFeed: feed.items,
    isLoading: false,
    fetchSocialFeed: vi.fn(),
  }),
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'feeds.socialTitle': 'Social Feed',
        'feeds.socialEmpty': 'No social activity yet',
        'feeds.socialEmptyDesc': 'Follow other users to see their Echo stories',
        'feeds.significanceValue': 'Significance: {{significance}}',
        'common.back': 'Back',
        'common.loadMore': 'Load more',
        'share.title': 'Share',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/feeds/social']}>
        <SocialFeedPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('SocialFeedPage', () => {
  it('renders social feed title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Social Feed')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('No social activity yet')).toBeInTheDocument();
  });

  it("shows an item's significance as one key's text with its value (R284.5)", async () => {
    feed.items = [
      {
        item_id: 'i1',
        item_type: 'life_event',
        echo_id: 'e1',
        shard_id: 's1',
        title: 'Sakura',
        body: 'Moved to the coast.',
        significance: 7,
        tick_id: 3,
        created_at: '2026-10-01T00:00:00Z',
        is_public: true,
        content_locale: 'en',
        owner_is_founding_echo: false,
      },
    ];
    try {
      await act(async () => {
        renderPage();
      });
      expect(screen.getByText('Significance: 7')).toBeInTheDocument();
    } finally {
      feed.items = [];
    }
  });
});
