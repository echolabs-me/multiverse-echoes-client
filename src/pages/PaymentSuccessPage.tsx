import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { payments } from '../lib/api/endpoints.ts';

export function PaymentSuccessPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Pending');
  const [polling, setPolling] = useState(true);

  const paymentId = searchParams.get('id');

  useEffect(() => {
    if (!paymentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot guard: stop the pending spinner when the page is opened without a payment id; a lazy initial state would change when polling first becomes false
      setPolling(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      while (!cancelled && attempts < maxAttempts) {
        try {
          const result = await payments.getStatus(paymentId);
          setStatus(result.status);
          if (
            result.status === 'Finished' ||
            result.status === 'Failed' ||
            result.status === 'Expired'
          ) {
            setPolling(false);
            return;
          }
        } catch {
          // Continue polling on error
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
      }
      setPolling(false);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

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
