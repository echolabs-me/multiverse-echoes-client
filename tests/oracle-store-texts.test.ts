import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import i18n from '../src/i18n.ts';
import { oracle } from '../src/lib/api/endpoints.ts';
import { useOracleStore } from '../src/stores/useOracleStore.ts';

/**
 * Rule 14, in a file #297 changes: the Oracle store's own replies (queued,
 * deep in thought, and an empty answer) are locale text, not English written
 * in code. Each key is given other text for these tests, because its English
 * equals what the code once wrote, and a test on that text could not fail.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  oracle: { ask: vi.fn() },
  feedback: { submit: vi.fn() },
}));

const KEYS = {
  'oracle.queued': 'Queued text from the locale.',
  'oracle.deepThought': 'Deep-thought text from the locale.',
  'oracle.emptyAnswer': 'Empty-answer text from the locale.',
};
const saved: Record<string, string> = {};

beforeEach(() => {
  for (const [key, value] of Object.entries(KEYS)) {
    saved[key] = i18n.t(key);
    i18n.addResource('en', 'translation', key, value);
  }
  vi.useFakeTimers();
  vi.mocked(oracle.ask).mockReset();
  useOracleStore.setState({
    messages: [],
    error: null,
    pendingFeedback: null,
    feedbackMode: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  for (const [key, value] of Object.entries(saved)) {
    i18n.addResource('en', 'translation', key, value);
  }
});

const reply = (answer: string) => ({
  answer,
  context_type: null,
  context_id: null,
});

const oracleTexts = () =>
  useOracleStore
    .getState()
    .messages.filter((m) => m.role === 'oracle')
    .map((m) => m.text);

describe("the Oracle store's own replies come from the locale", () => {
  it('shows the queued text, then the deep-thought text, then the empty-answer text', async () => {
    // Seven queued answers, then an empty one.
    for (let i = 0; i < 7; i++) {
      vi.mocked(oracle.ask).mockResolvedValueOnce(reply('__QUEUED__'));
    }
    vi.mocked(oracle.ask).mockResolvedValueOnce(reply(''));

    const asked = useOracleStore.getState().ask('Where is my Echo?');
    await vi.advanceTimersByTimeAsync(0);
    expect(oracleTexts()).toEqual([KEYS['oracle.queued']]);

    // The deep-thought text replaces it from the sixth retry.
    await vi.advanceTimersByTimeAsync(6 * 15_000);
    expect(oracleTexts()).toEqual([KEYS['oracle.deepThought']]);

    await vi.advanceTimersByTimeAsync(15_000);
    await asked;
    expect(oracleTexts()).toEqual([KEYS['oracle.emptyAnswer']]);
  });
});
