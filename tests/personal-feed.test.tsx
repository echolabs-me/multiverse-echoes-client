import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PersonalFeedPage } from '../src/pages/PersonalFeedPage.tsx';

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    echoList: [],
    fetchEchoes: vi.fn(),
  }),
}));

vi.mock('../src/stores/useFeedStore.ts', () => ({
  useFeedStore: () => ({
    personalFeed: [],
    isLoading: false,
    fetchPersonalFeed: vi.fn(),
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
        'feeds.personalTitle': 'Personal Feed',
        'feeds.filterByEcho': 'Filter by Echo',
        'feeds.allEchoes': 'All Echoes',
        'feeds.personalEmpty': 'No feed items yet',
        'feeds.personalEmptyDesc': 'Your Echo activities will appear here',
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
      <MemoryRouter initialEntries={['/feeds/personal']}>
        <PersonalFeedPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PersonalFeedPage', () => {
  it('renders feed title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Personal Feed')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('No feed items yet')).toBeInTheDocument();
  });
});
