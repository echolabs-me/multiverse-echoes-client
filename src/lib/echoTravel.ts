import type { WsEchoEvent } from '../types/api.ts';

/**
 * Whether an Echo stream event is a completed travel between shards.
 *
 * `ShardTravelCompleted` is the travel event. `EchoMoved` is a move inside a
 * shard, and does not count as a travel (R180).
 */
export function isTravelEvent(event: WsEchoEvent): boolean {
  return event.type === 'ShardTravelCompleted';
}
