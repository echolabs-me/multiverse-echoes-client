import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import {
  useSharedShardNotice,
  SHARED_SHARD_NOTICE_REQUIRED,
  type SharedShardNoticeOutcome,
} from '../src/hooks/useSharedShardNotice.tsx';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { account } from '../src/lib/api/endpoints.ts';
import type { PrivacySettings } from '../src/types/api.ts';

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: {
    getPrivacy: vi.fn(),
    acknowledgeSharedShardNotice: vi.fn(),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'sharedShardNotice.title': 'Entering a shared world',
        'sharedShardNotice.body': 'In shared worlds, your Echo meets others.',
        'sharedShardNotice.privacyLink': 'Read the privacy policy',
        'sharedShardNotice.accept': 'I understand',
        'sharedShardNotice.cancel': 'Cancel',
        'common.close': 'Close',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

const NOTICE = 'Entering a shared world';

function privacy(acknowledged: string | null | undefined): PrivacySettings {
  const settings: PrivacySettings = {
    solo_mode: false,
    do_not_sell: false,
    analytics_opt_out: false,
    community_opt_out: false,
    community_opt_out_cleanup_pending: false,
    shared_shard_notice_acknowledged_at: acknowledged ?? null,
    profile_visibility: 'Public',
  };
  // A server that predates the field omits it.
  if (acknowledged === undefined)
    delete settings.shared_shard_notice_acknowledged_at;
  return settings;
}

function Harness({
  shared,
  action,
  onOutcome,
  onError,
}: {
  shared: boolean;
  action: () => Promise<string>;
  onOutcome: (outcome: SharedShardNoticeOutcome<string>) => void;
  onError: (err: unknown) => void;
}) {
  const { run, notice, running } = useSharedShardNotice();
  return (
    <>
      <button onClick={() => void run(shared, action).then(onOutcome, onError)}>
        go
      </button>
      <output>{running ? 'running' : 'idle'}</output>
      {notice}
    </>
  );
}

/** What each run threw, for the tests whose action fails. */
const errors: unknown[] = [];

/** Mounts the hook and lets its mount read answer. */
async function mount(shared: boolean, action: () => Promise<string>) {
  const outcomes: SharedShardNoticeOutcome<string>[] = [];
  await act(async () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <Harness
          shared={shared}
          action={action}
          onOutcome={(o) => outcomes.push(o)}
          onError={(e) => errors.push(e)}
        />
      </I18nextProvider>,
    );
  });
  return outcomes;
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

/** What a browser does on a repeated Escape: a `cancel` the page cannot
 *  prevent, and then, in a later task, the dialog closes. */
async function browserCloses(dialog: HTMLElement) {
  await act(async () => {
    fireEvent(dialog, new Event('cancel', { cancelable: false }));
  });
  await act(async () => {
    (dialog as HTMLDialogElement).close();
    fireEvent(dialog, new Event('close'));
  });
}

function noticeShown() {
  return screen.queryByRole('dialog', { name: NOTICE }) !== null;
}

function running() {
  return screen.getByRole('status').textContent === 'running';
}

/** A promise and the function that settles it, for a request the test
 *  holds open. */
function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function required() {
  return new ApiRequestError(409, SHARED_SHARD_NOTICE_REQUIRED, 'acknowledge');
}

beforeEach(() => {
  errors.length = 0;
  // happy-dom has no showModal: open and close the dialog by its attribute,
  // which is what makes it reachable by role.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  vi.mocked(account.getPrivacy).mockReset();
  vi.mocked(account.getPrivacy).mockResolvedValue(privacy(null));
  vi.mocked(account.acknowledgeSharedShardNotice).mockReset();
  vi.mocked(account.acknowledgeSharedShardNotice).mockResolvedValue(undefined);
});

describe('the shared-shard notice (R216.4)', () => {
  it('reads the acknowledgment once, when it mounts', async () => {
    await mount(true, vi.fn().mockResolvedValue('moved'));
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);

    await click('go');
    await click('Cancel');
    await click('go');
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);
  });

  it('is shown at once to a user who has not acknowledged it, and accepting acknowledges and runs the action', async () => {
    const action = vi.fn().mockResolvedValue('moved');
    const outcomes = await mount(true, action);

    await click('go');
    expect(noticeShown()).toBe(true);
    expect(action).not.toHaveBeenCalled();

    await click('I understand');
    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
    expect(noticeShown()).toBe(false);
  });

  it('cancelling runs nothing and acknowledges nothing', async () => {
    const action = vi.fn().mockResolvedValue('moved');
    const outcomes = await mount(true, action);

    await click('go');
    await click('Cancel');
    expect(action).not.toHaveBeenCalled();
    expect(account.acknowledgeSharedShardNotice).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ status: 'cancelled' }]);
    expect(noticeShown()).toBe(false);
  });

  it('sends an acknowledged user’s action at once, with no read after the click', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValue(
      privacy('2026-10-02T00:00:00Z'),
    );
    const action = vi.fn().mockResolvedValue('moved');
    const outcomes = await mount(true, action);

    await click('go');
    expect(noticeShown()).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
  });

  it('is shown when the server omits the acknowledgment', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValue(privacy(undefined));
    const action = vi.fn().mockResolvedValue('moved');
    await mount(true, action);

    await click('go');
    expect(noticeShown()).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('is not shown for a Personal destination', async () => {
    const action = vi.fn().mockResolvedValue('moved');
    const outcomes = await mount(false, action);

    await click('go');
    expect(noticeShown()).toBe(false);
    expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
  });

  it.each([
    ['has not answered', () => held<PrivacySettings>().promise],
    ['failed', () => Promise.reject(new Error('offline'))],
  ])(
    'sends the action when the mount read %s, and a 409 shows the notice',
    async (_, read) => {
      vi.mocked(account.getPrivacy).mockImplementation(read);
      const action = vi
        .fn()
        .mockRejectedValueOnce(required())
        .mockResolvedValueOnce('moved');
      const outcomes = await mount(true, action);

      await click('go');
      expect(action).toHaveBeenCalledTimes(1);
      expect(noticeShown()).toBe(true);

      await click('I understand');
      expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledTimes(2);
      expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
    },
  );

  it('cancelling after a 409 does not retry the action, and the next click shows the notice at once', async () => {
    vi.mocked(account.getPrivacy).mockResolvedValue(
      privacy('2026-10-02T00:00:00Z'),
    );
    const action = vi.fn().mockRejectedValueOnce(required());
    const outcomes = await mount(true, action);

    await click('go');
    await click('Cancel');
    expect(action).toHaveBeenCalledTimes(1);
    expect(account.acknowledgeSharedShardNotice).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ status: 'cancelled' }]);

    await click('go');
    expect(noticeShown()).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('remembers an acknowledgment, so the next click sends its action at once', async () => {
    const action = vi.fn().mockResolvedValue('moved');
    await mount(true, action);

    await click('go');
    await click('I understand');
    await click('go');
    expect(noticeShown()).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
  });

  it('a mount read that answers after an acknowledgment does not undo it', async () => {
    const read = held<PrivacySettings>();
    vi.mocked(account.getPrivacy).mockReturnValue(read.promise);
    const action = vi
      .fn()
      .mockRejectedValueOnce(required())
      .mockResolvedValue('moved');
    await mount(true, action);

    await click('go');
    await click('I understand');
    expect(action).toHaveBeenCalledTimes(2);
    await act(async () => {
      read.resolve(privacy(null));
    });

    await click('go');
    expect(noticeShown()).toBe(false);
    expect(action).toHaveBeenCalledTimes(3);
  });

  describe('after Accept (R257.1)', () => {
    /** Mounts, clicks and accepts, with the acknowledgment held open. */
    async function acceptHeld() {
      const acknowledgment = held<undefined>();
      vi.mocked(account.acknowledgeSharedShardNotice).mockReturnValueOnce(
        acknowledgment.promise,
      );
      const action = vi.fn().mockResolvedValue('moved');
      const outcomes = await mount(true, action);
      await click('go');
      await click('I understand');
      return { acknowledgment, action, outcomes };
    }

    function dialog() {
      return screen.getByRole('dialog', { name: NOTICE });
    }

    it('is busy and sends no action until the acknowledgment lands, then closes and sends it', async () => {
      const acknowledgment = held<undefined>();
      vi.mocked(account.acknowledgeSharedShardNotice).mockReturnValueOnce(
        acknowledgment.promise,
      );
      const action = vi.fn().mockResolvedValue('moved');
      const outcomes = await mount(true, action);

      await click('go');
      expect(dialog()).not.toHaveAttribute('aria-busy');
      expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();

      await click('I understand');
      expect(dialog()).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'I understand' }),
      ).toBeDisabled();
      expect(action).not.toHaveBeenCalled();

      await act(async () => {
        acknowledgment.resolve(undefined);
      });
      expect(noticeShown()).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
      expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
    });

    it('is gone while the action runs, and running holds until it settles, so a second run is ignored', async () => {
      const work = held<string>();
      const action = vi.fn().mockReturnValue(work.promise);
      const outcomes = await mount(true, action);

      await click('go');
      await click('I understand');
      expect(noticeShown()).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
      expect(running()).toBe(true);

      await click('go');
      expect(outcomes).toEqual([{ status: 'ignored' }]);
      expect(action).toHaveBeenCalledTimes(1);
      expect(noticeShown()).toBe(false);

      await act(async () => {
        work.resolve('moved');
      });
      expect(running()).toBe(false);
      expect(outcomes).toEqual([
        { status: 'ignored' },
        { status: 'ran', value: 'moved' },
      ]);
    });

    it.each([
      ['its close button', () => click('Close')],
      [
        'Escape',
        () =>
          act(async () => {
            fireEvent(dialog(), new Event('cancel', { cancelable: true }));
          }),
      ],
      [
        'the backdrop',
        () =>
          act(async () => {
            fireEvent.click(dialog());
          }),
      ],
      [
        'the browser closing it on a repeated Escape',
        () => browserCloses(dialog()),
      ],
    ])(
      'cannot be dismissed by %s until the acknowledgment settles',
      async (_, dismiss) => {
        const { acknowledgment, action, outcomes } = await acceptHeld();

        await dismiss();
        expect(noticeShown()).toBe(true);
        expect(outcomes).toEqual([]);

        await act(async () => {
          acknowledgment.resolve(undefined);
        });
        expect(noticeShown()).toBe(false);
        expect(action).toHaveBeenCalledTimes(1);
        expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
      },
    );

    it('closes, runs nothing and releases the next run when the acknowledgment fails', async () => {
      const failure = new Error('acknowledgment failed');
      vi.mocked(account.acknowledgeSharedShardNotice).mockRejectedValueOnce(
        failure,
      );
      const action = vi.fn().mockResolvedValue('moved');
      await mount(true, action);

      await click('go');
      await click('I understand');
      expect(action).not.toHaveBeenCalled();
      expect(errors).toEqual([failure]);
      expect(noticeShown()).toBe(false);
      expect(running()).toBe(false);
    });
  });

  describe('one run at a time (R249)', () => {
    it('two runs in a row open one notice, send one acknowledgment and run one action, and the first settles', async () => {
      const action = vi.fn().mockResolvedValue('moved');
      const outcomes = await mount(true, action);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'go' }));
        fireEvent.click(screen.getByRole('button', { name: 'go' }));
      });
      expect(noticeShown()).toBe(true);
      expect(running()).toBe(true);
      expect(outcomes).toEqual([{ status: 'ignored' }]);

      await click('I understand');
      expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledTimes(1);
      expect(outcomes).toEqual([
        { status: 'ignored' },
        { status: 'ran', value: 'moved' },
      ]);
      expect(noticeShown()).toBe(false);
      expect(running()).toBe(false);
    });

    it('a run while the notice is open is ignored, and cancelling still settles the first', async () => {
      const action = vi.fn().mockResolvedValue('moved');
      const outcomes = await mount(true, action);

      await click('go');
      expect(noticeShown()).toBe(true);
      await click('go');
      expect(outcomes).toEqual([{ status: 'ignored' }]);

      await click('Cancel');
      expect(action).not.toHaveBeenCalled();
      expect(account.acknowledgeSharedShardNotice).not.toHaveBeenCalled();
      expect(outcomes).toEqual([
        { status: 'ignored' },
        { status: 'cancelled' },
      ]);
      expect(running()).toBe(false);
    });

    it('a run whose action fails releases the next run', async () => {
      const failure = new Error('travel failed');
      const action = vi
        .fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce('moved');
      const outcomes = await mount(false, action);

      await click('go');
      expect(errors).toEqual([failure]);
      expect(running()).toBe(false);

      await click('go');
      expect(action).toHaveBeenCalledTimes(2);
      expect(outcomes).toEqual([{ status: 'ran', value: 'moved' }]);
    });
  });
});
