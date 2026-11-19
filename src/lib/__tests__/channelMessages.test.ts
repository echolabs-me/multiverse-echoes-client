import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/endpoints.ts', () => ({
  channels: { messages: vi.fn() },
}));

import { channels } from '../api/endpoints.ts';
import {
  CHANNEL_PAGE_LIMIT,
  newestChannelMessages,
} from '../channelMessages.ts';
import type { ChannelMessage } from '../../types/api.ts';

type Page = Awaited<ReturnType<typeof channels.messages>>;

function msg(id: string): ChannelMessage {
  return { message_id: id } as unknown as ChannelMessage;
}

/** Serves `pages` in order, recording each call's options. */
function serve(pages: Array<{ ids: string[]; next: string | null }>) {
  const calls: Array<{ limit?: number; cursor?: string }> = [];
  let n = 0;
  vi.mocked(channels.messages).mockImplementation((_id, opts) => {
    calls.push({ ...opts });
    const p = pages[n++];
    if (!p) throw new Error('read past the last page');
    return Promise.resolve({
      data: p.ids.map(msg),
      next_cursor: p.next,
    } as Page);
  });
  return calls;
}

beforeEach(() => {
  vi.mocked(channels.messages).mockReset();
});

describe('newestChannelMessages (R580.3)', () => {
  it('follows the cursor past pages the server left empty', async () => {
    const calls = serve([
      { ids: [], next: 'c1' },
      { ids: [], next: 'c2' },
      { ids: ['older'], next: 'c3' },
    ]);
    const got = await newestChannelMessages('ch', 1);
    expect(got.map((m) => m.message_id)).toEqual(['older']);
    expect(calls).toEqual([
      { limit: 1 },
      { limit: CHANNEL_PAGE_LIMIT, cursor: 'c1' },
      { limit: CHANNEL_PAGE_LIMIT, cursor: 'c2' },
    ]);
  });

  it('fills a short page from the next one and holds no more than asked', async () => {
    serve([
      { ids: ['a', 'b'], next: 'c1' },
      { ids: ['c', 'd', 'e'], next: 'c2' },
    ]);
    const got = await newestChannelMessages('ch', 3);
    expect(got.map((m) => m.message_id)).toEqual(['a', 'b', 'c']);
  });

  it('ends when the channel has no more', async () => {
    const calls = serve([
      { ids: ['a'], next: 'c1' },
      { ids: [], next: null },
    ]);
    const got = await newestChannelMessages('ch', 5);
    expect(got.map((m) => m.message_id)).toEqual(['a']);
    expect(calls).toHaveLength(2);
  });

  it('stops after the page in flight once the read is no longer current', async () => {
    const calls = serve([
      { ids: [], next: 'c1' },
      { ids: ['a'], next: null },
    ]);
    let current = true;
    const read = newestChannelMessages('ch', 1, () => current);
    current = false;
    expect(await read).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});
