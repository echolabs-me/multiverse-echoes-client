import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiRequestError,
  apiErrorFromResponse,
  request,
} from '../src/lib/api/client.ts';
import { echoes, channels, account } from '../src/lib/api/endpoints.ts';

/**
 * R283.2: every request the client sends to the API throws `ApiRequestError`
 * when the response is not OK, built by the one function `client.ts` builds
 * it with. These are tests of the endpoints themselves: `fetch` is the only
 * stand-in, and nothing leaves the machine (SR51).
 */

function answer(status: number, body: string | null) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const envelope = (code: string, message: string) =>
  JSON.stringify({ error: { code, message } });

async function caught(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error('the call resolved');
}

const file = new File(['x'], 'x.png', { type: 'image/png' });

// Each request the client sends with `fetch` directly, outside `request()`.
const members: [string, () => Promise<unknown>][] = [
  ['echoes.narrate', () => echoes.narrate('e1', 'd1')],
  ['echoes.narrateVideoStart', () => echoes.narrateVideoStart('e1', 'd1')],
  [
    'echoes.narrateVideoResult',
    () => echoes.narrateVideoResult('e1', 'd1', 'j1'),
  ],
  ['channels.uploadImage', () => channels.uploadImage('c1', file)],
  ['account.downloadExport', () => account.downloadExport('x1')],
];

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('every request to the API throws ApiRequestError on a response that is not OK (R283.2)', () => {
  it.each(members)(
    '%s: an envelope gives the error its code, message and status',
    async (_name, call) => {
      answer(429, envelope('DAILY_VIDEO_LIMIT', 'limit reached'));
      const err = await caught(call);
      expect(err).toBeInstanceOf(ApiRequestError);
      expect(err).toMatchObject({
        status: 429,
        code: 'DAILY_VIDEO_LIMIT',
        message: 'limit reached',
      });
    },
  );

  it.each(members)(
    '%s: a body with no envelope gives no message and keeps its status',
    async (_name, call) => {
      answer(502, '<html>Bad Gateway</html>');
      const err = await caught(call);
      expect(err).toBeInstanceOf(ApiRequestError);
      expect(err).toMatchObject({ status: 502, code: 'UNKNOWN', message: '' });
    },
  );
});

describe('apiErrorFromResponse, the one builder', () => {
  it('reads a validation body: the code, and each field message', async () => {
    const err = await apiErrorFromResponse(
      new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          fields: { name: ['too long'], bio: ['empty'] },
        }),
        { status: 422 },
      ),
    );
    expect(err).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'too long empty',
    });
  });

  it('gives JSON that is not an envelope no message, and keeps its status (SR31)', async () => {
    for (const body of ['{}', 'null', '{"error":{}}', '[1]']) {
      const err = await apiErrorFromResponse(
        new Response(body, { status: 503 }),
      );
      expect(err).toMatchObject({ status: 503, code: 'UNKNOWN', message: '' });
    }
  });

  it('is what request() throws', async () => {
    answer(409, envelope('EMAIL_TAKEN', 'taken'));
    const err = await caught(() => request('/x'));
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });
});
