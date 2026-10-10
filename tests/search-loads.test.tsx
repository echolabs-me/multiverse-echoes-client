import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Profiler } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SearchPage } from '../src/pages/SearchPage.tsx';
import { search } from '../src/lib/api/endpoints.ts';
import type { SearchResult } from '../src/types/api.ts';

// R361, R371.1, R381.5: the page shows and writes only the results of the
// last search it started, in the scope its query names.
vi.mock('../src/lib/api/endpoints.ts', () => {
  const emptyPage = () =>
    vi.fn().mockResolvedValue({ data: [], next_cursor: null });
  return {
    search: {
      echoes: vi.fn(),
      diary: emptyPage(),
      events: emptyPage(),
      shards: emptyPage(),
      messages: emptyPage(),
    },
  };
});

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.back': 'Back',
        'common.noResults': 'No results found',
        'search.placeholder': 'Search',
        'search.resultCount': '{{count}} results',
        'search.groupCount': '[{{number}}]',
        'search.typeEcho': 'Echoes',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

type Page = Awaited<ReturnType<typeof search.echoes>>;

function found(snippet: string): Page {
  return {
    data: [
      {
        item_type: 'echo',
        feed_item_type: null,
        item_id: `id-${snippet}`,
        echo_id: `id-${snippet}`,
        snippet,
        created_at: '2026-01-01T00:00:00Z',
        owner_is_founding_echo: false,
      } satisfies SearchResult,
    ],
    next_cursor: null,
  } as Page;
}

function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function GoToE2() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/search?q=zz&echo_id=e2')}>
      go to e2
    </button>
  );
}

const commits: string[] = [];
/** Records the page's text at every commit of what it wraps. */
function CommitProbe({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="page"
      onRender={() => {
        commits.push(document.body.textContent ?? '');
      }}
    >
      {children}
    </Profiler>
  );
}

function GoBack() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>go back</button>;
}

/** The router's search string, in an attribute so it adds no text. */
function LocationProbe() {
  const { search: params } = useLocation();
  return <output data-testid="location" data-search={params} />;
}

function renderPage(route: string, earlier: string[] = []) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[...earlier, route]}>
        <GoToE2 />
        <GoBack />
        <LocationProbe />
        <CommitProbe>
          <Routes>
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </CommitProbe>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

async function submit() {
  await act(async () => {
    // Submitted on its form, as a browser does (a submit dispatched on the
    // input makes React read a form from the input).
    fireEvent.submit(
      screen.getByRole('searchbox').closest('form') as HTMLFormElement,
    );
  });
}

beforeEach(() => {
  commits.length = 0;
  localStorage.clear();
  vi.mocked(search.echoes).mockReset();
});

describe('SearchPage loads (R361)', () => {
  it('a search in an earlier scope that settles after a search in the later scope leaves the later one’s results (R361.3)', async () => {
    const inE1 = held<Page>();
    vi.mocked(search.echoes).mockImplementation((params) =>
      params.echo_id === 'e1'
        ? inE1.promise
        : Promise.resolve(found('Lighthouse')),
    );
    await act(async () => {
      renderPage('/search?q=zz&echo_id=e1');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go to e2' }));
    });
    await submit();
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
    await act(async () => {
      inE1.resolve(found('Harbour'));
    });
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
    expect(screen.queryByText('Harbour')).toBeNull();
  });

  it('from one scope’s results to the route of another, no render for it shows the earlier scope’s results (R371.1)', async () => {
    vi.mocked(search.echoes).mockImplementation((params) =>
      params.echo_id === 'e1'
        ? Promise.resolve(found('Harbour'))
        : new Promise(() => undefined),
    );
    await act(async () => {
      renderPage('/search?q=zz&echo_id=e1');
    });
    expect(screen.getByText('Harbour')).toBeInTheDocument();
    commits.length = 0;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go to e2' }));
    });
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('Harbour');
    }
  });

  it('of two searches for the same query, an earlier one that settles later writes nothing (R381.5)', async () => {
    const older = held<Page>();
    const newer = held<Page>();
    vi.mocked(search.echoes)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await act(async () => {
      renderPage('/search?q=zz');
    });
    await submit();
    expect(search.echoes).toHaveBeenCalledTimes(2);
    await act(async () => {
      newer.resolve(found('Newer'));
    });
    await act(async () => {
      older.resolve(found('Older'));
    });
    expect(screen.getByText('Newer')).toBeInTheDocument();
    expect(screen.queryByText('Older')).toBeNull();
  });
});

describe('SearchPage: a search belongs to everything it was read for (R422.3)', () => {
  it('results read under one type tab are not shown under another, and that tab’s own search writes', async () => {
    const underEcho = held<Page>();
    vi.mocked(search.echoes)
      .mockResolvedValueOnce(found('Harbour'))
      .mockReturnValueOnce(underEcho.promise);
    await act(async () => {
      renderPage('/search?q=zz');
    });
    expect(screen.getByText('Harbour')).toBeInTheDocument();
    commits.length = 0;
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Echoes' }));
    });
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('Harbour');
    }
    await act(async () => {
      underEcho.resolve(found('Lighthouse'));
    });
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
    expect(search.echoes).toHaveBeenCalledTimes(2);
  });

  it('results read for one date range are not shown for another, and that range’s own search writes', async () => {
    const fromDate = held<Page>();
    vi.mocked(search.echoes)
      .mockResolvedValueOnce(found('Harbour'))
      .mockReturnValueOnce(fromDate.promise);
    await act(async () => {
      renderPage('/search?q=zz');
    });
    expect(screen.getByText('Harbour')).toBeInTheDocument();
    commits.length = 0;
    await act(async () => {
      fireEvent.change(screen.getByLabelText('search.dateFrom'), {
        target: { value: '2026-01-01' },
      });
    });
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('Harbour');
    }
    expect(search.echoes).toHaveBeenLastCalledWith(
      expect.objectContaining({ date_from: '2026-01-01' }),
    );
    await act(async () => {
      fromDate.resolve(found('Lighthouse'));
    });
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
  });

  it('back from one query’s results to an earlier query shows no render with the later query’s results', async () => {
    vi.mocked(search.echoes).mockImplementation((params) =>
      params.q === 'bb'
        ? Promise.resolve(found('Bee'))
        : new Promise(() => undefined),
    );
    await act(async () => {
      renderPage('/search?q=bb', ['/search?q=aa']);
    });
    expect(screen.getByText('Bee')).toBeInTheDocument();
    commits.length = 0;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go back' }));
    });
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) {
      expect(text).not.toContain('Bee');
    }
    expect(search.echoes).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'aa' }),
    );
  });

  it('the type tab, the dates and the typed query chosen in one scope are reset in another', async () => {
    vi.mocked(search.echoes).mockResolvedValue(found('Harbour'));
    await act(async () => {
      renderPage('/search?q=zz&echo_id=e1');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Echoes' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('search.dateFrom'), {
        target: { value: '2026-01-01' },
      });
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'typed in e1' },
      });
    });
    expect(screen.getByRole('tab', { name: 'Echoes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go to e2' }));
    });
    expect(screen.getByRole('tab', { name: 'Echoes' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(
      screen.getByRole('tab', { name: 'search.allTypes' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('search.dateFrom')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveValue('zz');
    expect(search.echoes).toHaveBeenLastCalledWith(
      expect.objectContaining({ echo_id: 'e2', date_from: undefined }),
    );
  });

  it('a result highlights the query it was read for, not the text typed since', async () => {
    vi.mocked(search.echoes).mockResolvedValue(found('zz marks the spot'));
    await act(async () => {
      renderPage('/search?q=zz');
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'spot' },
      });
    });
    expect(
      Array.from(document.querySelectorAll('mark')).map((m) => m.textContent),
    ).toEqual(['zz']);
  });
});

describe('SearchPage: the query typed follows the URL, and a submit keeps the URL (R422.3)', () => {
  it('back from one submitted query to an earlier one shows the earlier query in the input', async () => {
    vi.mocked(search.echoes).mockImplementation((params) =>
      Promise.resolve(found(params.q === 'aa' ? 'Ay' : 'Bee')),
    );
    await act(async () => {
      renderPage('/search?q=aa');
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'bb' },
      });
    });
    await submit();
    expect(screen.getByText('Bee')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('bb');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go back' }));
    });
    expect(screen.getByText('Ay')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('aa');
  });

  it('the type tab, the dates and the typed query chosen in one scope are not restored on a return to it', async () => {
    vi.mocked(search.echoes).mockResolvedValue(found('Harbour'));
    await act(async () => {
      renderPage('/search?q=zz&echo_id=e1');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Echoes' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('search.dateFrom'), {
        target: { value: '2026-01-01' },
      });
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'typed in e1' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go to e2' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'go back' }));
    });
    expect(
      screen.getByRole('tab', { name: 'search.allTypes' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('search.dateFrom')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveValue('zz');
    expect(search.echoes).toHaveBeenLastCalledWith(
      expect.objectContaining({ echo_id: 'e1', date_from: undefined }),
    );
  });

  it('a new query submitted keeps the URL’s type and scope', async () => {
    vi.mocked(search.echoes).mockResolvedValue(found('Harbour'));
    await act(async () => {
      renderPage('/search?q=aa&echo_id=e1&scope=Echo');
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'bb' },
      });
    });
    await submit();
    const params = new URLSearchParams(
      screen.getByTestId('location').getAttribute('data-search') ?? '',
    );
    expect(Object.fromEntries(params)).toEqual({
      q: 'bb',
      echo_id: 'e1',
      scope: 'Echo',
    });
  });
});
