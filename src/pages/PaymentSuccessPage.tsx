import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { payments } from '../lib/api/endpoints.ts';
import { useLatestLoad } from '../hooks/useCurrentKey.ts';

/** What the poll last read, and the payment it was read for. */
interface PollState {
  key: string | null;
  status: string;
  polling: boolean;
}

export function PaymentSuccessPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paymentId = searchParams.get('id');

  // The poll's state is shown only while the query names the payment it was
  // read for (R371.1): the first render for another payment shows it
  // pending, never the earlier payment's status. A page opened without a
  // payment id polls nothing.
  const [held, setHeld] = useState<PollState>({
    key: paymentId,
    status: 'Pending',
    polling: true,
  });
  const current: PollState =
    held.key === paymentId
      ? held
      : { key: paymentId, status: 'Pending', polling: true };
  const status = current.status;
  const polling = !!paymentId && current.polling;

  // Of the polls the page starts, only the last one started for the query's
  // payment writes, and only while the page is mounted; the check is made
  // between each read and its write (R361.1, R381.1).
  const startPoll = useLatestLoad(paymentId);

  useEffect(() => {
    if (!paymentId) return;
    const key = paymentId;
    const isCurrent = startPoll(key);
    if (!isCurrent()) return;
    let attempts = 0;
    const maxAttempts = 30;
    const write = (next: string, keepPolling: boolean) =>
      setHeld({ key, status: next, polling: keepPolling });

    const poll = async () => {
      let last = 'Pending';
      while (attempts < maxAttempts) {
        try {
          const result = await payments.getStatus(key);
          if (!isCurrent()) return;
          last = result.status;
          if (
            result.status === 'Finished' ||
            result.status === 'Failed' ||
            result.status === 'Expired'
          ) {
            write(result.status, false);
            return;
          }
          write(result.status, true);
        } catch {
          // Continue polling on error
          if (!isCurrent()) return;
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
        if (!isCurrent()) return;
      }
      write(last, false);
    };

    void poll();
  }, [paymentId, startPoll]);

  const isConfirmed = status === 'Finished';
  const isPending =
    status === 'Pending' || status === 'Confirming' || status === 'Confirmed';

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="mx-auto max-w-md p-6 text-center">
        {isConfirmed ? (
          <>
            <CheckCircle size={48} className="mx-auto mbe-4 text-success" />
            <h1 className="mbe-2 text-2xl font-bold text-text-primary">
              {t('payment.successTitle')}
            </h1>
            <p className="mbe-6 text-sm text-text-secondary">
              {t('payment.successDesc')}
            </p>
          </>
        ) : isPending && polling ? (
          <>
            <Loader2
              size={48}
              className="mx-auto mbe-4 animate-spin text-accent"
            />
            <h1 className="mbe-2 text-2xl font-bold text-text-primary">
              {t('payment.successPending')}
            </h1>
            <p className="mbe-6 text-sm text-text-secondary">
              {t('payment.successPendingDesc')}
            </p>
            <p className="text-xs text-text-muted">
              {t('payment.checkingStatus')}
            </p>
          </>
        ) : (
          <>
            <h1 className="mbe-2 text-2xl font-bold text-text-primary">
              {t('payment.successPending')}
            </h1>
            <p className="mbe-6 text-sm text-text-secondary">
              {t('payment.successPendingDesc')}
            </p>
          </>
        )}

        <div className="mbs-6 flex flex-col gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            {t('payment.backToDashboard')}
          </button>
          <button
            onClick={() => navigate('/plans')}
            className="flex items-center justify-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            {t('payment.backToPlans')}
          </button>
        </div>
      </div>
    </div>
  );
}
