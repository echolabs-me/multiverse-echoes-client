import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SocialFeedPage } from '../src/pages/SocialFeedPage.tsx';

vi.mock('../src/stores/useFeedStore.ts', () => ({
  useFeedStore: () => ({
    socialFeed: [],
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
        'feeds.significance': 'Significance',
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
});
