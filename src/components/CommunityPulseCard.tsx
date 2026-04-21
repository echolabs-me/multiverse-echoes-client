import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Users, Navigation, TrendingUp } from 'lucide-react';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { getMoodColor } from '../lib/moodColor.ts';
import { feeds } from '../lib/api/endpoints.ts';
import type { FeedItem } from '../types/api.ts';

/**
 * Community Pulse — event ticker showing significant moments across all
 * user's echoes. Per ME-CSS-001: life events, relationships, travel,
 * mood changes — NOT diary text previews.
 */
export function CommunityPulseCard() {
  const { t } = useTranslation();
  const { echoList } = useEchoStore();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [shardNames, setShardNames] = useState<Record<string, string>>({});

  const fetchFeed = useCallback(() => {
    void feeds.personal().then((page) => setItems(page.data.slice(0, 12))).catch(() => {});
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
            ? (shardName
                ? t('communityFeed.exploringShard', { shard: shardName })
                : t('communityFeed.goingAboutDay'))
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
              ref={(el) => {
                if (!el) return;
                el.style.setProperty('--me-mood-color', moodColor);
                el.style.setProperty('--me-mood-shadow', `rgba(${mr},${mg},${mb},0.10)`);
                el.style.setProperty('--me-mood-edge', `rgba(${mr},${mg},${mb},0.5)`);
              }}
              className="me-community-row w-full rounded-lg border-s-[3px] bg-surface-raised/50 px-2.5 py-1.5 text-start"
            >
              <div className="flex items-center gap-1.5">
                <span className="me-mood-dot size-2 shrink-0 rounded-full" />
                <Icon size={11} className={`shrink-0 ${iconColor} ${isLifeEvent ? 'fill-accent' : ''}`} />
                <span className="truncate text-xs font-medium text-text-primary">{echoName}</span>
                <span className="ms-auto text-[10px] whitespace-nowrap text-text-muted">{(() => {
                  const seconds = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 1000);
                  if (seconds < 60) return t('communityFeed.justNow');
                  const minutes = Math.floor(seconds / 60);
                  if (minutes < 60) return t('communityFeed.minutesAgo', { count: minutes });
                  const hours = Math.floor(minutes / 60);
                  if (hours < 24) return t('communityFeed.hoursAgo', { count: hours });
                  const days = Math.floor(hours / 24);
                  return t('communityFeed.daysAgo', { count: days });
                })()}</span>
              </div>
              <p className="line-clamp-1 ps-[27px] text-xs/snug text-text-secondary">
                {tickerText}
              </p>
            </div>
          );
        })}
    </div>
  );
}
