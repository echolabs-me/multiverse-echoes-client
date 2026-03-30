import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, Zap, Filter, Share2 } from 'lucide-react';
import {
  Card,
  Badge,
  Spinner,
  EmptyState,
  Button,
  ShareModal,
  ReportButton,
} from '../components/index.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useFeedStore } from '../stores/useFeedStore.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { FeedItem } from '../types/api.ts';

const PAGE_SIZE = 20;

export function PersonalFeedPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { echoList, fetchEchoes } = useEchoStore();
  const { personalFeed, isLoading, fetchPersonalFeed } = useFeedStore();
  const [selectedEchoId, setSelectedEchoId] = useState<string>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetchEchoes();
    trackEvent('feed.viewed', { variant: 'personal' });
  }, [fetchEchoes]);

  useEffect(() => {
    void fetchPersonalFeed(selectedEchoId || undefined);
  }, [fetchPersonalFeed, selectedEchoId]);

  const paginatedFeed = personalFeed.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedFeed.length < personalFeed.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <h1 className="mb-4 text-2xl font-bold text-text-primary">
            {t('feeds.personalTitle')}
          </h1>

          {/* Echo filter */}
          <div className="mb-6 flex items-center gap-2">
            <Filter size={16} className="text-text-muted" aria-hidden="true" />
            <select
              value={selectedEchoId}
              onChange={(e) => { setSelectedEchoId(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              aria-label={t('feeds.filterByEcho')}
            >
              <option value="">{t('feeds.allEchoes')}</option>
              {echoList.map((echo) => (
                <option key={echo.echo_id} value={echo.echo_id}>
                  {echo.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : personalFeed.length === 0 ? (
            <EmptyState
              title={t('feeds.personalEmpty')}
              description={t('feeds.personalEmptyDesc')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedFeed.map((item) => (
                <FeedItemCard key={item.item_id} item={item} onEchoClick={(id) => navigate(`/echoes/${id}`)} />
              ))}
              {hasMore && (
                <Button variant="ghost" onClick={() => { setPage((p) => p + 1); trackEvent('feed.scrolled', { variant: 'personal' }); }}>
                  {t('common.loadMore')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
  );
}

function FeedItemCard({
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

  const shareUrl = `${window.location.origin}/share/${item.item_id}`;

  return (
    <>
      <Card variant="compact" className="group animate-slide-in">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEchoClick(item.echo_id)}
                className="text-sm font-medium text-accent hover:text-accent/80"
              >
                {item.title}
              </button>
              <Badge variant="default">{item.item_type.replace('_', ' ')}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{item.body}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-text-muted">
                {new Date(item.created_at).toLocaleString()}
              </span>
              <button
                onClick={() => setShareOpen(true)}
                className="rounded p-1 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label={t('share.title')}
              >
                <Share2 size={14} />
              </button>
              <ReportButton targetType="content" targetId={item.item_id} />
            </div>
          </div>
        </div>
      </Card>
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={item.title}
        body={item.body}
        shareUrl={shareUrl}
      />
    </>
  );
}
