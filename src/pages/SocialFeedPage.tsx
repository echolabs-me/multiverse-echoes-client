import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, Zap, TrendingUp, Share2 } from 'lucide-react';
import {
  Card,
  Badge,
  Spinner,
  EmptyState,
  Button,
  ShareModal,
} from '../components/index.ts';
import { useFeedStore } from '../stores/useFeedStore.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { FeedItem } from '../types/api.ts';

const PAGE_SIZE = 20;

export function SocialFeedPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { socialFeed, isLoading, fetchSocialFeed } = useFeedStore();
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetchSocialFeed();
    trackEvent('feed.viewed', { variant: 'social' });
  }, [fetchSocialFeed]);

  // Sort by significance descending
  const sortedFeed = [...socialFeed].sort((a, b) => b.significance - a.significance);
  const paginatedFeed = sortedFeed.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedFeed.length < sortedFeed.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <h1 className="mbe-4 text-2xl font-bold text-text-primary">
            {t('feeds.socialTitle')}
          </h1>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : socialFeed.length === 0 ? (
            <EmptyState
              title={t('feeds.socialEmpty')}
              description={t('feeds.socialEmptyDesc')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedFeed.map((item) => (
                <SocialFeedCard
                  key={item.item_id}
                  item={item}
                  onEchoClick={(id) => navigate(`/echoes/${id}`)}
                />
              ))}
              {hasMore && (
                <Button variant="ghost" onClick={() => { setPage((p) => p + 1); trackEvent('feed.scrolled', { variant: 'social' }); }}>
                  {t('common.loadMore')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
  );
}

function SocialFeedCard({
  item,
  onEchoClick,
}: {
  item: FeedItem;
  onEchoClick: (echoId: string) => void;
}) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const icon =
    item.item_type === 'diary_entry' ? (
      <BookOpen size={14} className="text-accent" aria-hidden="true" />
    ) : (
      <Zap size={14} className="text-accent" aria-hidden="true" />
    );

  return (
    <>
      <Card variant="compact" className="group animate-slide-in">
        <div className="flex items-start gap-3">
          <div className="mbs-0.5">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEchoClick(item.echo_id)}
                className="text-sm font-medium text-accent hover:text-accent/80"
              >
                {item.title}
              </button>
              <Badge variant="default">{t(`feedTypes.${item.item_type}`, { defaultValue: item.item_type.replace('_', ' ') })}</Badge>
            </div>
            <p className="mbs-1 text-sm text-text-secondary">{item.body}</p>
            <div className="mbs-1 flex items-center gap-2 text-xs text-text-muted">
              <span>{new Date(item.created_at).toLocaleString()}</span>
              {item.significance > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp size={10} aria-hidden="true" />
                  {t('feeds.significance')}: {item.significance}
                </span>
              )}
              <button
                onClick={() => setShareOpen(true)}
                className="rounded-sm p-1 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label={t('share.title')}
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </Card>
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={item.title}
        body={item.body}
        itemId={item.item_id}
      />
    </>
  );
}
