import { useState, useEffect, useCallback } from 'react';
import { Zap, Users, Navigation, TrendingUp } from 'lucide-react';
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

/** Get a short event-style summary for diary entries (location-based). */
function diaryTickerText(item: FeedItem, shardName: string): string {
  // Use headline if it's short and event-like
  if (item.title && item.title.length <= 60 && item.title.length > 5) {
    return item.title;
  }
  // Fall back to location-based summary
  if (shardName) {
    return `Exploring ${shardName}`;
  }
  return 'Going about their day';
}

/**
 * Community Pulse — event ticker showing significant moments across all
 * user's echoes. Per ME-CSS-001: life events, relationships, travel,
 * mood changes — NOT diary text previews.
 */
export function CommunityPulseCard() {
  const { echoList } = useEchoStore();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [shardNames, setShardNames] = useState<Record<string, string>>({});

  const fetchFeed = useCallback(() => {
    void feeds.personal().then((data) => setItems(data.slice(0, 12))).catch(() => {});
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

  // Prioritise events over diary entries. Show diary only as filler.
  const eventItems = items.filter((i) => i.item_type !== 'diary_entry');
  const diaryItems = items.filter((i) => i.item_type === 'diary_entry');

  // Show up to 8 items: events first, fill remaining slots with diary summaries
  const display = [
    ...eventItems,
    ...diaryItems.slice(0, Math.max(0, 8 - eventItems.length)),
  ].slice(0, 8);

  if (display.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
        {display.map((item) => {
          const echo = echoNameMap.get(item.echo_id);
          const echoName = echo?.name ?? item.echo_id.slice(0, 8);
          const moodColor = echo ? getMoodColor(echo.current_mood) : '#8E8E93';
          const shardName = shardNames[item.shard_id] ?? '';
          const isLifeEvent = item.item_type === 'life_event' || item.item_type === 'LifeEvent';
          const isRelationship = item.item_type === 'relationship_change' || item.item_type === 'RelationshipChange';
          const isDiary = item.item_type === 'diary_entry';

          // Event text — news ticker style
          const tickerText = isDiary
            ? diaryTickerText(item, shardName)
            : item.title || item.body;

          // Icon per type
          const Icon = isLifeEvent ? Zap
            : isRelationship ? Users
            : isDiary ? Navigation
            : TrendingUp;

          const iconColor = isLifeEvent ? 'text-accent'
            : isRelationship ? 'text-pink-400'
            : 'text-text-muted';

          const mr = parseInt(moodColor.slice(1, 3), 16);
          const mg = parseInt(moodColor.slice(3, 5), 16);
          const mb = parseInt(moodColor.slice(5, 7), 16);

          return (
            <div
              key={item.item_id}
              className="w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left bg-surface-raised/50"
              style={{
                boxShadow: `0 0 10px 2px rgba(${mr},${mg},${mb},0.10)`,
                borderLeftColor: isLifeEvent
                  ? 'var(--color-accent)'
                  : isRelationship
                    ? 'rgb(244,114,182)'
                    : `rgba(${mr},${mg},${mb},0.4)`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: moodColor }}
                />
                <Icon size={11} className={`flex-shrink-0 ${iconColor} ${isLifeEvent ? 'fill-accent' : ''}`} />
                <span className="text-xs font-medium text-text-primary truncate">{echoName}</span>
                <span className="ml-auto text-[10px] text-text-muted whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
              </div>
              <p className="text-xs leading-snug pl-[27px] text-text-secondary line-clamp-1">
                {tickerText}
              </p>
            </div>
          );
        })}
    </div>
  );
}
