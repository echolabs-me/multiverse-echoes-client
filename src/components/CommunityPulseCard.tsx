import { useState, useEffect, useCallback } from 'react';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { getMoodColor } from '../lib/moodColor.ts';
import { feeds } from '../lib/api/endpoints.ts';
import type { FeedItem } from '../types/api.ts';

/** Format a date as relative time (e.g. "2 hours ago", "3 days ago"). */
function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Community Pulse — activity feed showing recent diary/life event activity
 * across all user's echoes, with Echo name + Shard name attribution.
 * Rendered once in the EchoSidebar, not per-echo.
 */
export function CommunityPulseCard() {
  const { echoList } = useEchoStore();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [shardNames, setShardNames] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchFeed = useCallback(() => {
    void feeds.personal().then((data) => setItems(data.slice(0, 8))).catch(() => {});
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 60_000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // Resolve shard names from items we have.
  useEffect(() => {
    const unknownShardIds = items
      .map((i) => i.shard_id)
      .filter((id) => id && !shardNames[id]);
    const unique = [...new Set(unknownShardIds)];
    for (const id of unique) {
      void import('../lib/api/endpoints.ts').then(({ shards }) =>
        shards.get(id).then((s) => {
          setShardNames((prev) => ({ ...prev, [id]: s.name }));
        }).catch(() => {}),
      );
    }
  }, [items, shardNames]);

  const echoNameMap = new Map(echoList.map((e) => [e.echo_id, e]));

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
        {items.map((item) => {
          const echo = echoNameMap.get(item.echo_id);
          const echoName = echo?.name ?? item.echo_id.slice(0, 8);
          const moodColor = echo ? getMoodColor(echo.current_mood) : '#8E8E93';
          const shardName = shardNames[item.shard_id] ?? '';
          const content = item.body || item.title || '';
          const isExpanded = expandedItems.has(item.item_id);

          return (
            <button
              key={item.item_id}
              onClick={() => setExpandedItems((prev) => {
                const next = new Set(prev);
                if (next.has(item.item_id)) next.delete(item.item_id);
                else next.add(item.item_id);
                return next;
              })}
              className="w-full rounded-lg bg-surface-raised/50 px-2.5 py-2 text-left transition-colors hover:bg-surface-raised"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: moodColor }}
                />
                <span className="text-xs font-medium text-text-primary truncate">{echoName}</span>
                {shardName && (
                  <>
                    <span className="text-xs text-text-secondary">·</span>
                    <span className="text-xs text-text-secondary truncate">{shardName}</span>
                  </>
                )}
                <span className="text-xs text-text-secondary">·</span>
                <span className="text-xs text-text-secondary whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
              </div>
              <p
                className="text-xs text-text-secondary leading-snug pl-[14px]"
                style={isExpanded ? undefined : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              >
                {content}
              </p>
              {!isExpanded && content.length > 150 && (
                <span className="text-[10px] text-accent mt-0.5 pl-[14px] inline-block">show more</span>
              )}
            </button>
          );
        })}
    </div>
  );
}
