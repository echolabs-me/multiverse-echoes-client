import type { ChannelMessage } from '../types/api.ts';

/** Whether `msg` has the same author as `prev`, so the two can share one
 *  header. A removed author, an unlinked Discord relay and every Discord user
 *  relayed that way share the nil author id, so whether the author was
 *  removed and the Discord name are compared too (R211, R218). A server that
 *  predates the Discord name omits it, so a missing name and `null` are both
 *  "no Discord name" (R246). */
export function sameMessageAuthor(
  prev: ChannelMessage | null,
  msg: ChannelMessage,
): boolean {
  return (
    prev !== null &&
    prev.author_id === msg.author_id &&
    prev.author_removed === msg.author_removed &&
    (prev.external_author_name ?? null) === (msg.external_author_name ?? null)
  );
}
