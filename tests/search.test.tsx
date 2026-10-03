import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { SearchPage } from '../src/pages/SearchPage.tsx';
import { search } from '../src/lib/api/endpoints.ts';

// Mock stores
vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: { display_name: 'Test User', subscription_tier: 'Free' },
    }),
  useNotificationStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ unreadCount: 0 }),
}));

// Mock API: each search route answers an empty page.
vi.mock('../src/lib/api/endpoints.ts', () => {
  const emptyPage = () =>
    vi.fn().mockResolvedValue({ data: [], next_cursor: null });
  return {
    search: {
      echoes: emptyPage(),
      diary: emptyPage(),
      events: emptyPage(),
      shards: emptyPage(),
      messages: emptyPage(),
    },
  };
});

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'app.title': 'Multiverse Echoes',
        'common.search': 'Search',
        'common.loading': 'Loading...',
        'common.noResults': 'No results found',
        'search.placeholder': 'Search Echoes, diary entries, events, shards...',
        'search.shortcut': 'Ctrl+K',
        'search.allTypes': 'All',
        'search.typeEcho': 'Echoes',
        'search.typeDiary': 'Diary Entries',
        'search.typeEvent': 'Life Events',
        'search.typeShard': 'Shards',
        'search.typeMessage': 'Messages',
        'search.filterByType': 'Filter by content type',
        // R284.5: the count's brackets are the key's, not the code's.
        'search.groupCount': '[{{number}}]',
        'search.dateFrom': 'From date',
        'search.dateTo': 'To date',
        'search.resultCount': '{{count}} results',
        'search.recentSearches': 'Recent searches',
        'search.clearRecent': 'Clear recent',
        'search.scopeEcho': 'Searching within this Echo',
        'search.scopeShard': 'Searching within this Shard',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderSearch(route = '/search') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nextProvider i18n={testI18n}>
        <SearchPage />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

/** Stands in for the shard page, and names the shard the route opened. */
function OpenedShard() {
  const { id } = useParams();
  return <p>opened shard {id}</p>;
}

describe('SearchPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the search input', () => {
    renderSearch();
    expect(
      screen.getByRole('searchbox', {
        name: 'Search Echoes, diary entries, events, shards...',
      }),
    ).toBeInTheDocument();
  });

  it('renders content type filter tabs', () => {
    renderSearch();
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Echoes' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Diary Entries' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Life Events' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Shards' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Messages' })).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    renderSearch();
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
  });

  it('renders date filter inputs', () => {
    renderSearch();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
  });

  it('shows "no results" after empty search', async () => {
    renderSearch();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.submit(input);

    // Wait for async results
    const noResults = await screen.findByText('No results found');
    expect(noResults).toBeInTheDocument();
  });

  it('lists a result under its type with its snippet, and opens it by its id', async () => {
    // The wire shape of `/search/shards` (`SearchResult`).
    vi.mocked(search.shards).mockResolvedValueOnce({
      data: [
        {
          item_type: 'shard',
          feed_item_type: null,
          item_id: 'shard-9',
          echo_id: null,
          snippet: 'A harbour town under a copper sky',
          created_at: '2026-09-30T00:00:00Z',
          owner_is_founding_echo: false,
        },
      ],
      next_cursor: null,
    });
    render(
      <MemoryRouter initialEntries={['/search']}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/search" element={<SearchPage />} />
            <Route path="/shards/:id" element={<OpenedShard />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'harbour' } });
    fireEvent.submit(input);

    const result = await screen.findByRole('button', {
      name: /under a copper sky/,
    });
    expect(screen.getByRole('heading', { name: /Shards/ })).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    fireEvent.click(result);
    expect(await screen.findByText(/^opened shard /)).toHaveTextContent(
      'opened shard shard-9',
    );
  });

  it('saves and displays recent searches', async () => {
    // Pre-populate recent searches
    localStorage.setItem(
      'me_recent_searches',
      JSON.stringify(['hello', 'world']),
    );
    renderSearch();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('clears recent searches', () => {
    localStorage.setItem('me_recent_searches', JSON.stringify(['test']));
    renderSearch();
    const clearBtn = screen.getByRole('button', { name: 'Clear recent' });
    fireEvent.click(clearBtn);
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });
});
