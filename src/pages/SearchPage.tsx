import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search as SearchIcon,
  User,
  BookOpen,
  Zap,
  Globe,
  MessageSquare,
  Calendar,
  Clock,
} from 'lucide-react';
import { search } from '../lib/api/endpoints.ts';
import { trackEvent } from '../lib/analytics.ts';
import { useLatestLoad, whenCurrent } from '../hooks/useCurrentKey.ts';
import { formatDate } from '../lib/formatDate.ts';
import type { SearchItemType, SearchResult } from '../types/api.ts';

type ContentType =
  | 'all'
  | 'Echo'
  | 'DiaryEntry'
  | 'LifeEvent'
  | 'Shard'
  | 'Message';

/** The filter tab each kind of result the server answers belongs under. */
const RESULT_TAB: Record<SearchItemType, Exclude<ContentType, 'all'>> = {
  echo: 'Echo',
  diary: 'DiaryEntry',
  event: 'LifeEvent',
  shard: 'Shard',
  message: 'Message',
};

const CONTENT_TYPES: ContentType[] = [
  'all',
  'Echo',
  'DiaryEntry',
  'LifeEvent',
  'Shard',
  'Message',
];

const RECENT_SEARCHES_KEY = 'me_recent_searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  );
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

const typeIcons: Record<string, React.ReactNode> = {
  Echo: <User size={16} className="text-accent" />,
  DiaryEntry: <BookOpen size={16} className="text-info" />,
  LifeEvent: <Zap size={16} className="text-warning" />,
  Shard: <Globe size={16} className="text-success" />,
  Message: <MessageSquare size={16} className="text-text-secondary" />,
};

const typeLabels: Record<string, string> = {
  Echo: 'search.typeEcho',
  DiaryEntry: 'search.typeDiary',
  LifeEvent: 'search.typeEvent',
  Shard: 'search.typeShard',
  Message: 'search.typeMessage',
};

export function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The query submitted, which the URL holds. `String` makes it a value the
  // lint rule `react-hooks/preserve-manual-memoization` can see is a string:
  // without it, the rule reports that the page's memoized search (its
  // `useCallback` and the effect that runs it) cannot be preserved.
  const submittedQuery = String(searchParams.get('q') ?? '');
  const urlType = searchParams.get('scope') as ContentType | null;

  const [recentSearches, setRecentSearches] =
    useState<string[]>(getRecentSearches);

  const inputRef = useRef<HTMLInputElement>(null);

  // Scope from URL params (echo_id or shard_id)
  const scopeEchoId = searchParams.get('echo_id') ?? undefined;
  const scopeShardId = searchParams.get('shard_id') ?? undefined;
  // Both are UUIDs or absent, so the key names the scope unambiguously.
  const scopeKey = `echo:${scopeEchoId ?? ''} shard:${scopeShardId ?? ''}`;

  // The query typed, the type tab and the dates belong to the scope they
  // were chosen in: a scope change resets them to the new scope's URL in the
  // render that names it, so a return to a scope does not restore them
  // (R422.3). The query typed also follows the URL's query: when that
  // changes (a submit, back or forward), the input shows the query now
  // submitted.
  const fresh = {
    query: submittedQuery,
    type: urlType ?? 'all',
    dateFrom: '',
    dateTo: '',
  };
  const [filters, setFilters] = useState<{
    query: string;
    type: ContentType;
    dateFrom: string;
    dateTo: string;
  }>(fresh);
  const [shownScope, setShownScope] = useState(scopeKey);
  const [shownSubmitted, setShownSubmitted] = useState(submittedQuery);
  if (shownScope !== scopeKey) {
    setShownScope(scopeKey);
    setShownSubmitted(submittedQuery);
    setFilters(fresh);
  } else if (shownSubmitted !== submittedQuery) {
    setShownSubmitted(submittedQuery);
    setFilters((prev) => ({ ...prev, query: submittedQuery }));
  }
  const { query, type: activeType, dateFrom, dateTo } = filters;
  const setFilter = (change: Partial<typeof filters>) =>
    setFilters((prev) => ({ ...prev, ...change }));

  // A search's key is everything it is read for: the scope, the submitted
  // query, the type and the dates (R361.1, R422.3).
  const searchKey = `${scopeKey} q:${submittedQuery} type:${activeType} from:${dateFrom} to:${dateTo}`;

  // The last search's state, and the key it was started for. It is shown
  // only while the page names that key (R371.1). Of the searches the page
  // starts, only the last one started writes, so an earlier search that
  // settles later never replaces a newer one's results, for the same query
  // or another (R361, R381.5).
  const [held, setHeld] = useState<{
    key: string;
    results: SearchResult[];
    isLoading: boolean;
    hasSearched: boolean;
  }>({ key: searchKey, results: [], isLoading: false, hasSearched: false });
  const shown =
    held.key === searchKey
      ? held
      : { key: searchKey, results: [], isLoading: false, hasSearched: false };
  const { results, isLoading, hasSearched } = shown;
  const startSearch = useLatestLoad(searchKey);

  // Ctrl/Cmd+K shortcut to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const performSearch = useCallback(async () => {
    const q = submittedQuery;
    if (!q.trim()) return;
    const key = searchKey;
    const isCurrent = startSearch(key);
    if (!isCurrent()) return;
    setHeld((prev) => ({
      key,
      results: prev.key === key ? prev.results : [],
      isLoading: true,
      hasSearched: true,
    }));
    saveRecentSearch(q.trim());
    setRecentSearches(getRecentSearches());

    const params = {
      q: q.trim(),
      echo_id: scopeEchoId,
      shard_id: scopeShardId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    };

    try {
      const allResults: SearchResult[] = [];
      const types =
        activeType === 'all'
          ? (['echoes', 'diary', 'events', 'shards', 'messages'] as const)
          : activeType === 'Echo'
            ? (['echoes'] as const)
            : activeType === 'DiaryEntry'
              ? (['diary'] as const)
              : activeType === 'LifeEvent'
                ? (['events'] as const)
                : activeType === 'Shard'
                  ? (['shards'] as const)
                  : (['messages'] as const);

      const promises = types.map((type) => search[type](params));
      const responses = await whenCurrent(
        isCurrent,
        Promise.allSettled(promises),
      );
      for (const r of responses) {
        if (r.status === 'fulfilled') {
          allResults.push(...r.value.data);
        }
      }

      // Sort by created_at descending
      allResults.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setHeld({
        key,
        results: allResults,
        isLoading: false,
        hasSearched: true,
      });
    } catch {
      setHeld({ key, results: [], isLoading: false, hasSearched: true });
    }
  }, [
    submittedQuery,
    activeType,
    dateFrom,
    dateTo,
    scopeEchoId,
    scopeShardId,
    searchKey,
    startSearch,
  ]);

  // The URL's query is searched when the page opens, and again whenever
  // the search's key changes: a new scope, query, type or dates (R422.3).
  useEffect(() => {
    void (async () => {
      await performSearch();
    })();
  }, [performSearch]);

  // The query goes in the URL with the scope it is searched in and the type
  // the URL names, so the search started for that scope stays current
  // (R361) and no part of the URL is lost.
  const setQueryParam = (q: string) => {
    const next: Record<string, string> = { q };
    if (scopeEchoId) next.echo_id = scopeEchoId;
    if (scopeShardId) next.shard_id = scopeShardId;
    if (urlType) next.scope = urlType;
    setSearchParams(next);
  };

  /** Searches `q`: a new query goes in the URL, whose change starts its
   *  search; the query already submitted is searched again. */
  const submit = (q: string) => {
    if (q === submittedQuery) void performSearch();
    else setQueryParam(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    trackEvent('search.performed', {
      query_length: query.trim().length,
      scope: activeType,
    });
    submit(query.trim());
  };

  const handleRecentClick = (q: string) => {
    setFilter({ query: q });
    submit(q);
  };

  const handleResultClick = (result: SearchResult) => {
    trackEvent('search.result_clicked', {
      result_type: result.item_type,
      result_id: result.item_id,
    });
    switch (result.item_type) {
      case 'echo':
        navigate(`/echoes/${result.item_id}`);
        break;
      case 'diary':
      case 'event':
        if (result.echo_id) navigate(`/echoes/${result.echo_id}`);
        break;
      case 'shard':
        navigate(`/shards/${result.item_id}`);
        break;
      case 'message':
        navigate('/community');
        break;
    }
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = RESULT_TAB[r.item_type];
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  function highlightSnippet(
    text: string | undefined | null,
    q: string,
  ): React.ReactNode {
    if (!text) return '';
    if (!q.trim()) return text;
    const regex = new RegExp(
      `(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi',
    );
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="rounded-sm bg-accent/30 px-0.5 text-text-primary"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="relative mbe-6">
          <SearchIcon
            size={20}
            className="absolute inset-s-3 inset-bs-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setFilter({ query: e.target.value })}
            placeholder={t('search.placeholder')}
            className="w-full rounded-lg border border-border bg-surface py-3 ps-10 pe-20 text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            aria-label={t('search.placeholder')}
          />
          <kbd className="absolute inset-e-3 inset-bs-1/2 -translate-y-1/2 rounded-sm border border-border bg-canvas px-2 py-0.5 text-xs text-text-secondary">
            {t('search.shortcut')}
          </kbd>
        </form>

        {/* Filters row */}
        <div className="mbe-4 flex flex-wrap items-center gap-2">
          {/* Content type tabs */}
          <div
            className="flex gap-1"
            role="tablist"
            aria-label={t('search.filterByType')}
          >
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                role="tab"
                aria-selected={activeType === type}
                onClick={() => setFilter({ type })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeType === type
                    ? 'bg-accent text-canvas'
                    : 'bg-surface text-text-secondary hover:bg-surface-raised'
                }`}
              >
                {type === 'all' ? t('search.allTypes') : t(typeLabels[type])}
              </button>
            ))}
          </div>

          {/* Date filters */}
          <div className="ms-auto flex items-center gap-2">
            <Calendar
              size={14}
              className="text-text-muted"
              aria-hidden="true"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setFilter({ dateFrom: e.target.value })}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text-primary"
              aria-label={t('search.dateFrom')}
            />
            <span className="text-xs text-text-muted">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setFilter({ dateTo: e.target.value })}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text-primary"
              aria-label={t('search.dateTo')}
            />
          </div>
        </div>

        {/* Scope indicator */}
        {(scopeEchoId || scopeShardId) && (
          <div className="mbe-4 flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm text-text-secondary">
            {scopeEchoId && <span>{t('search.scopeEcho')}</span>}
            {scopeShardId && <span>{t('search.scopeShard')}</span>}
          </div>
        )}

        {/* Recent searches (when no query) */}
        {!hasSearched && recentSearches.length > 0 && (
          <div className="mbe-6">
            <div className="mbe-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-secondary">
                {t('search.recentSearches')}
              </h3>
              <button
                onClick={() => {
                  clearRecentSearches();
                  setRecentSearches([]);
                }}
                className="text-xs text-text-muted hover:text-text-secondary"
                aria-label={t('search.clearRecent')}
              >
                {t('search.clearRecent')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => handleRecentClick(s)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised"
                >
                  <Clock size={12} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span
              className="inline-block size-6 animate-spin rounded-full border-2 border-accent border-bs-transparent"
              role="status"
            >
              <span className="sr-only">{t('common.loading')}</span>
            </span>
          </div>
        )}

        {/* Results */}
        {!isLoading && hasSearched && (
          <>
            <p className="mbe-4 text-sm text-text-secondary">
              {t('search.resultCount', { count: results.length })}
            </p>

            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <SearchIcon size={40} className="text-text-muted opacity-50" />
                <p className="text-text-muted">{t('common.noResults')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([type, items]) => (
                  <section key={type}>
                    <h3 className="mbe-2 flex items-center gap-2 text-sm font-semibold text-text-secondary">
                      {typeIcons[type]}
                      {t(typeLabels[type])}
                      <span className="text-text-muted">
                        {t('search.groupCount', { number: items.length })}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {items.map((result) => (
                        <button
                          key={`${result.item_type}-${result.item_id}`}
                          onClick={() => handleResultClick(result)}
                          className="w-full rounded-lg border border-border bg-surface p-3 text-start transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm text-text-primary">
                                {highlightSnippet(
                                  result.snippet,
                                  submittedQuery,
                                )}
                              </p>
                            </div>
                            <time className="shrink-0 text-xs text-text-muted">
                              {formatDate(result.created_at)}
                            </time>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
