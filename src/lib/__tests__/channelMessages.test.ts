import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/endpoints.ts', () => ({
  channels: { messages: vi.fn() },
}));

import { channels } from '../api/endpoints.ts';
import {
  CHANNEL_PAGE_LIMIT,
  insertOnce,
  newestChannelMessages,
  oldestFirstChannelMessages,
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

describe('oldestFirstChannelMessages (R594)', () => {
  it('answers the newest messages, across pages, oldest first', async () => {
    // The server answers newest first.
    serve([
      { ids: ['e', 'd'], next: 'c1' },
      { ids: ['c', 'b', 'a'], next: 'c2' },
    ]);
    const got = await oldestFirstChannelMessages('ch', 3);
    expect(got.map((m) => m.message_id)).toEqual(['c', 'd', 'e']);
  });

  it('answers nothing for an empty channel', async () => {
    serve([{ ids: [], next: null }]);
    expect(await oldestFirstChannelMessages('ch', 3)).toEqual([]);
  });

  it('passes the read’s currency check on', async () => {
    const calls = serve([
      { ids: [], next: 'c1' },
      { ids: ['a'], next: null },
    ]);
    let current = true;
    const read = oldestFirstChannelMessages('ch', 1, () => current);
    current = false;
    expect(await read).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe('insertOnce (R594)', () => {
  const at = (id: string, created_at: string) =>
    ({ message_id: id, created_at }) as unknown as ChannelMessage;
  const ids = (list: ChannelMessage[]) => list.map((m) => m.message_id);

  it('puts an answer before a newer message a live read landed first', () => {
    const held = [
      at('a', '2026-09-30T00:01:00Z'),
      at('c', '2026-09-30T00:03:00Z'),
    ];
    expect(ids(insertOnce(at('b', '2026-09-30T00:02:00Z'))(held))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('appends an answer newer than every message held', () => {
    const held = [at('a', '2026-09-30T00:01:00Z')];
    expect(ids(insertOnce(at('b', '2026-09-30T00:02:00Z'))(held))).toEqual([
      'a',
      'b',
    ]);
  });

  it('orders by the digits below the millisecond', () => {
    // Ids that order the other way, so only the digits below the
    // millisecond place the answer.
    const held = [
      at('x', '2026-09-30T00:01:00.123456Z'),
      at('a', '2026-09-30T00:01:00.123458Z'),
    ];
    expect(
      ids(insertOnce(at('m', '2026-09-30T00:01:00.123457Z'))(held)),
    ).toEqual(['x', 'm', 'a']);
  });

  it('orders one instant written with and without a fraction as equal, then by id', () => {
    const held = [
      at('a', '2026-09-30T00:01:00Z'),
      at('c', '2026-09-30T00:01:00.000Z'),
    ];
    expect(
      ids(insertOnce(at('b', '2026-09-30T00:01:00.000000Z'))(held)),
    ).toEqual(['a', 'b', 'c']);
  });

  it('orders the form the server sends, a +00:00 offset and six digits', () => {
    // The server writes created_at with to_rfc3339 (channels.rs). Ids that
    // order the other way, so only the timestamps place the answer.
    const held = [
      at('x', '2026-09-30T00:01:00.123456+00:00'),
      at('a', '2026-09-30T00:01:00.123458+00:00'),
    ];
    expect(
      ids(insertOnce(at('m', '2026-09-30T00:01:00.123457+00:00'))(held)),
    ).toEqual(['x', 'm', 'a']);
  });

  it('keeps the list as it is when it already holds the answer', () => {
    const held = [at('a', '2026-09-30T00:01:00Z')];
    expect(insertOnce(at('a', '2026-09-30T00:01:00Z'))(held)).toBe(held);
  });
});
