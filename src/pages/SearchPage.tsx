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
import { formatDate } from '../lib/formatDate.ts';
import type { SearchResult } from '../types/api.ts';

type ContentType = 'all' | 'Echo' | 'DiaryEntry' | 'LifeEvent' | 'Shard' | 'Message';

const CONTENT_TYPES: ContentType[] = ['all', 'Echo', 'DiaryEntry', 'LifeEvent', 'Shard', 'Message'];

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
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
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
  const initialQuery = searchParams.get('q') ?? '';
  const initialScope = searchParams.get('scope') as ContentType | null;

  const [query, setQuery] = useState(initialQuery);
  const [activeType, setActiveType] = useState<ContentType>(initialScope ?? 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);

  const inputRef = useRef<HTMLInputElement>(null);

  // Scope from URL params (echo_id or shard_id)
  const scopeEchoId = searchParams.get('echo_id') ?? undefined;
  const scopeShardId = searchParams.get('shard_id') ?? undefined;

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

  // Auto-search on mount if query in URL
  useEffect(() => {
    if (initialQuery) {
      void performSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setIsLoading(true);
      setHasSearched(true);
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
        const responses = await Promise.allSettled(promises);
        for (const r of responses) {
          if (r.status === 'fulfilled') {
            allResults.push(...r.value.data);
          }
        }

        // Sort by created_at descending
        allResults.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setResults(allResults);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeType, dateFrom, dateTo, scopeEchoId, scopeShardId],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    trackEvent('search.performed', { query_length: query.trim().length, scope: activeType });
    setSearchParams({ q: query.trim() });
    void performSearch(query.trim());
  };

  const handleRecentClick = (q: string) => {
    setQuery(q);
    setSearchParams({ q });
    void performSearch(q);
  };

  const handleResultClick = (result: SearchResult) => {
    trackEvent('search.result_clicked', { result_type: result.result_type, result_id: result.id });
    switch (result.result_type) {
      case 'Echo':
        navigate(`/echoes/${result.id}`);
        break;
      case 'DiaryEntry':
      case 'LifeEvent':
        if (result.echo_id) navigate(`/echoes/${result.echo_id}`);
        break;
      case 'Shard':
        navigate(`/shards/${result.id}`);
        break;
      case 'Message':
        navigate('/community');
        break;
    }
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.result_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  function highlightSnippet(text: string | undefined | null, q: string): React.ReactNode {
    if (!text) return '';
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="rounded-sm bg-accent/30 px-0.5 text-text-primary">
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
            onChange={(e) => setQuery(e.target.value)}
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
          <div className="flex gap-1" role="tablist" aria-label={t('search.filterByType')}>
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                role="tab"
                aria-selected={activeType === type}
                onClick={() => setActiveType(type)}
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
            <Calendar size={14} className="text-text-muted" aria-hidden="true" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text-primary"
              aria-label={t('search.dateFrom')}
            />
            <span className="text-xs text-text-muted">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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
            <span className="inline-block size-6 animate-spin rounded-full border-2 border-accent border-bs-transparent" role="status">
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
                      <span className="text-text-muted">({items.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {items.map((result) => (
                        <button
                          key={`${result.result_type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="w-full rounded-lg border border-border bg-surface p-3 text-start transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary">
                                {highlightSnippet(result.title, query)}
                              </p>
                              <p className="mbs-1 line-clamp-2 text-xs text-text-secondary">
                                {highlightSnippet(result.snippet, query)}
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
