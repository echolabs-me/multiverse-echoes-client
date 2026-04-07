import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search, MapPin } from 'lucide-react';
import {
  Card,
  Badge,
  Spinner,
  EmptyState,
} from '../components/index.ts';
import { useShardStore } from '../stores/useShardStore.ts';

export function ShardBrowserPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { shardList, isLoading, fetchShards } = useShardStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void fetchShards();
  }, [fetchShards]);

  const filteredShards = useMemo(() => {
    if (!searchQuery.trim()) return shardList;
    const q = searchQuery.toLowerCase();
    return shardList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [shardList, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl p-6">
          {/* Back */}
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <h1 className="mb-4 text-2xl font-bold text-text-primary">
            {t('shardBrowser.title')}
          </h1>

          {/* Search */}
          <div className="relative mb-6">
            <Search
              size={16}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('shardBrowser.searchPlaceholder')}
              className="w-full rounded-lg border border-border bg-surface py-2 ps-9 pe-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label={t('shardBrowser.searchPlaceholder')}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : filteredShards.length === 0 ? (
            <EmptyState
              title={t('shardBrowser.empty')}
              description={t('shardBrowser.emptyDesc')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredShards.map((shard) => (
                <Card
                  key={shard.shard_id}
                  onClick={() => navigate(`/shards/${shard.shard_id}`)}
                  className="overflow-hidden !p-0"
                >
                  {shard.banner_image && (
                    <img
                      src={shard.banner_image}
                      alt=""
                      className="h-36 w-full object-cover sm:h-40"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {t(`shardNames.${shard.name.toLowerCase().replace(/\s+/g, '-')}`, { defaultValue: shard.name })}
                      </h3>
                      <Badge
                        variant={shard.status === 'Active' ? 'success' : 'default'}
                      >
                        {t(`shardBrowser.status${shard.status}`, { defaultValue: shard.status })}
                      </Badge>
                    </div>
                    <p className="line-clamp-4 text-xs text-text-secondary">
                      {t(`shardDescriptions.${shard.name.toLowerCase().replace(/\s+/g, '-')}`, { defaultValue: shard.description })}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <MapPin size={12} aria-hidden="true" />
                      <span>{t(`shardBrowser.type${shard.shard_type}`, { defaultValue: shard.shard_type })}</span>
                      <span>&middot;</span>
                      <span>
                        {t('shardBrowser.echoCount', { current: shard.current_active_count, max: shard.max_active_echoes })}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
