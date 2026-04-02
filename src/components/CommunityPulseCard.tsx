import { useState, useEffect, useCallback } from 'react';
import { Zap, Users } from 'lucide-react';
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
          const headline = item.title || '';
          const isLifeEvent = item.item_type === 'LifeEvent';
          const isRelationship = item.item_type === 'RelationshipChange';

          const borderColor = isLifeEvent
            ? 'border-l-accent'
            : isRelationship
              ? 'border-l-pink-400'
              : 'border-l-border';

          const mr = parseInt(moodColor.slice(1, 3), 16);
          const mg = parseInt(moodColor.slice(3, 5), 16);
          const mb = parseInt(moodColor.slice(5, 7), 16);

          return (
            <div
              key={item.item_id}
              className={`w-full rounded-lg border-l-[3px] px-2.5 py-2 text-left ${borderColor} ${
                isLifeEvent
                  ? 'bg-accent/10 border border-accent/20'
                  : isRelationship
                    ? 'bg-pink-500/10 border border-pink-500/20'
                    : 'bg-surface-raised/50'
              }`}
              style={{
                boxShadow: `0 0 14px 3px rgba(${mr},${mg},${mb},0.15)`,
                borderLeftColor: `rgba(${mr},${mg},${mb},0.5)`,
              }}
            >
              <div className="flex items-start gap-1.5 mb-0.5">
                <span
                  className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: moodColor }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-text-primary">{echoName}</span>
                    {isLifeEvent && (
                      <Zap size={11} className="flex-shrink-0 text-accent fill-accent" />
                    )}
                    {isRelationship && (
                      <Users size={11} className="flex-shrink-0 text-pink-400" />
                    )}
                    <span className="ml-auto text-[10px] text-text-muted whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                  </div>
                  {shardName && (
                    <p className="text-[11px] text-text-muted">{shardName}</p>
                  )}
                </div>
              </div>
              <p className={`text-xs leading-snug pl-[14px] line-clamp-2 ${
                isLifeEvent
                  ? 'text-text-primary font-medium'
                  : isRelationship
                    ? 'text-text-primary'
                    : 'text-text-secondary'
              }`}>
                {headline}
              </p>
            </div>
          );
        })}
    </div>
  );
}
