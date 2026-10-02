import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../components/index.ts';
import { ApiRequestError } from '../lib/api/client.ts';
import { account } from '../lib/api/endpoints.ts';

/** The code the API refuses an Echo's entry into a shared shard with until
 *  the user has acknowledged the shared-shard notice (R216.3). */
export const SHARED_SHARD_NOTICE_REQUIRED = 'SHARED_SHARD_NOTICE_REQUIRED';

/** What `run` did: ran the action; ran nothing because the user cancelled
 *  the notice; or ran nothing because another `run` was still in flight. */
export type SharedShardNoticeOutcome<T> =
  | { status: 'ran'; value: T }
  | { status: 'cancelled' }
  | { status: 'ignored' };

/** What the hook knows of the user's acknowledgment (R253.1). */
type Acknowledgment = 'acknowledged' | 'unacknowledged' | 'unknown';

interface RunOptions {
  /** Called just before the notice is shown, so a page can bring back the
   *  view the notice is rendered in. */
  beforeNotice?: () => void;
}

/** Runs an action that may put the user's Echo into a shared (Public or
 *  Private) shard (R216.4, R253). The hook reads the user's acknowledgment
 *  once, when it mounts, and a click acts at once on what it knows: a user
 *  who has not acknowledged the notice sees it and nothing is sent;
 *  otherwise the action is sent, and a 409 SHARED_SHARD_NOTICE_REQUIRED
 *  shows the notice. Cancelling runs nothing, so the Echo stays where it
 *  is. Accepting posts the acknowledgment, and the notice is busy and cannot
 *  be dismissed until it settles. If it fails, the notice closes and nothing
 *  is sent. If it succeeds, the notice closes and the action is sent at once,
 *  so the page shows it as it does for a user who had already acknowledged
 *  (R257.1).
 *  One `run` is in flight at a time: a `run` that starts while another is in
 *  flight is ignored, and `running` is true until the one in flight has
 *  settled, so a page can disable the control that starts it (R249).
 *  Render `notice` in the view the action starts from. */
export function useSharedShardNotice() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const answer = useRef<((accepted: boolean) => void) | null>(null);
  const inFlight = useRef(false);
  const [running, setRunning] = useState(false);
  const acknowledgment = useRef<Acknowledgment>('unknown');

  useEffect(() => {
    account.getPrivacy().then(
      (privacy) => {
        // A 409 or an Accept that answered first already knows more.
        if (acknowledgment.current !== 'unknown') return;
        // A server that predates the field omits it: not acknowledged.
        acknowledgment.current =
          privacy.shared_shard_notice_acknowledged_at == null
            ? 'unacknowledged'
            : 'acknowledged';
      },
      // A failed read leaves it unknown: a click sends the action, and the
      // server's 409 shows the notice.
      () => undefined,
    );
  }, []);

  // Answers the notice while it asks. Once Accept is chosen nothing is left
  // to answer: the notice is busy until the acknowledgment settles, so its
  // buttons are disabled and Escape and the backdrop do not close it (R257.1).
  const settle = useCallback((accepted: boolean) => {
    const resolve = answer.current;
    if (!resolve) return;
    answer.current = null;
    if (accepted) setWorking(true);
    else setOpen(false);
    resolve(accepted);
  }, []);

  const throughNotice = useCallback(
    async <T,>(
      action: () => Promise<T>,
      options: RunOptions,
    ): Promise<SharedShardNoticeOutcome<T>> => {
      options.beforeNotice?.();
      const accepted = await new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setOpen(true);
      });
      if (!accepted) return { status: 'cancelled' };
      try {
        await account.acknowledgeSharedShardNotice();
      } finally {
        setWorking(false);
        setOpen(false);
      }
      acknowledgment.current = 'acknowledged';
      return { status: 'ran', value: await action() };
    },
    [],
  );

  const run = useCallback(
    async <T,>(
      shared: boolean,
      action: () => Promise<T>,
      options: RunOptions = {},
    ): Promise<SharedShardNoticeOutcome<T>> => {
      // A second click while the first is in flight would otherwise take the
      // notice's resolver from the first, and could run the action twice.
      if (inFlight.current) return { status: 'ignored' };
      inFlight.current = true;
      setRunning(true);
      try {
        if (shared && acknowledgment.current === 'unacknowledged') {
          return await throughNotice(action, options);
        }
        try {
          return { status: 'ran', value: await action() };
        } catch (err) {
          if (
            !(err instanceof ApiRequestError) ||
            err.code !== SHARED_SHARD_NOTICE_REQUIRED
          ) {
            throw err;
          }
          acknowledgment.current = 'unacknowledged';
          return await throughNotice(action, options);
        }
      } finally {
        inFlight.current = false;
        setRunning(false);
      }
    },
    [throughNotice],
  );

  const notice = (
    <Modal
      open={open}
      onClose={() => settle(false)}
      title={t('sharedShardNotice.title')}
      busy={working}
    >
      <p className="mbe-3 text-sm text-text-secondary">
        {t('sharedShardNotice.body')}
      </p>
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="mbe-4 inline-block text-sm text-accent underline"
      >
        {t('sharedShardNotice.privacyLink')}
      </a>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => settle(false)}
          disabled={working}
        >
          {t('sharedShardNotice.cancel')}
        </Button>
        <Button onClick={() => settle(true)} disabled={working}>
          {t('sharedShardNotice.accept')}
        </Button>
      </div>
    </Modal>
  );

  return { run, notice, running };
}
