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
