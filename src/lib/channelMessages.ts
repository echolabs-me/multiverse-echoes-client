import { channels } from './api/endpoints.ts';
import type { ChannelMessage } from '../types/api.ts';

/** The server's largest page (`MAX_PAGE_SIZE` in
 *  `crates/api/src/pagination.rs`, which
 *  `crates/api/tests/channel_page_limit_sync.rs` holds this to). The first
 *  page asks for what the caller wants; every page after it is read at this
 *  size, so a run of messages the server leaves out costs one request per
 *  this many rows, not one per row. */
export const CHANNEL_PAGE_LIMIT = 100;

/** Reads channel `channelId`'s newest `want` messages, newest first. A page
 *  may hold fewer than its `limit`, or none, when the server leaves out
 *  messages the viewer may not see, and its `next_cursor` then leads on
 *  (R580.3), so pages are followed until `want` messages are held or the
 *  channel has no more. Each page reads past the last, so paging ends. A
 *  read whose `isCurrent` turns false stops after the page in flight. */
export async function newestChannelMessages(
  channelId: string,
  want: number,
  isCurrent: () => boolean = () => true,
): Promise<ChannelMessage[]> {
  const held: ChannelMessage[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await channels.messages(channelId, {
      ...(cursor ? { limit: CHANNEL_PAGE_LIMIT, cursor } : { limit: want }),
    });
    held.push(...page.data);
    if (held.length >= want || !page.next_cursor || !isCurrent()) {
      return held.slice(0, want);
    }
    cursor = page.next_cursor;
  }
}

/** Reads channel `channelId`'s newest `want` messages, as
 *  `newestChannelMessages` does, and answers them oldest first: the order
 *  both channel views hold and draw, so the newest message is last, a sent
 *  message is placed in its oldest-first place (`insertOnce`), a live one
 *  comes with a full read, and the view scrolls to the newest. The
 *  server answers newest first (`ORDER BY m.created_at DESC, m.message_id
 *  DESC`, `crates/core/src/repositories/pg_channel_message_repo.rs`), so the
 *  order is turned here, once (R594). */
export async function oldestFirstChannelMessages(
  channelId: string,
  want: number,
  isCurrent: () => boolean = () => true,
): Promise<ChannelMessage[]> {
  return (await newestChannelMessages(channelId, want, isCurrent)).reverse();
}

/** Orders two messages oldest first, as the server's newest-first order
 *  (`created_at DESC, message_id DESC`) turned: by `created_at`, then by
 *  `message_id`. A timestamp's digits below the millisecond, which
 *  `Date.parse` drops, still order it. */
export function compareOldestFirst(a: ChannelMessage, b: ChannelMessage) {
  const at = Date.parse(a.created_at);
  const bt = Date.parse(b.created_at);
  if (at !== bt) return at < bt ? -1 : 1;
  const af = belowMillisecond(a.created_at);
  const bf = belowMillisecond(b.created_at);
  if (af !== bf) return af < bf ? -1 : 1;
  if (a.message_id === b.message_id) return 0;
  return a.message_id < b.message_id ? -1 : 1;
}

/** A timestamp's fraction of a second below the millisecond, as six
 *  digits. */
function belowMillisecond(timestamp: string): string {
  const fraction = /\.(\d+)/.exec(timestamp)?.[1] ?? '';
  return fraction.padEnd(9, '0').slice(3, 9);
}

/** Shows a sent message in a channel's messages, once and in its place
 *  oldest first: a read that landed first may already hold it (R422.2),
 *  and a live read may have landed a newer message while it was pending. */
export const insertOnce =
  (msg: ChannelMessage) =>
  (prev: ChannelMessage[]): ChannelMessage[] => {
    if (prev.some((m) => m.message_id === msg.message_id)) return prev;
    const at = prev.findIndex((m) => compareOldestFirst(m, msg) > 0);
    return at === -1
      ? [...prev, msg]
      : [...prev.slice(0, at), msg, ...prev.slice(at)];
  };
