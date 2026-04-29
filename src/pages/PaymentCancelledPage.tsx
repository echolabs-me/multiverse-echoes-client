import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle, ArrowLeft } from 'lucide-react';

export function PaymentCancelledPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="mx-auto max-w-md p-6 text-center">
        <XCircle size={48} className="mx-auto mbe-4 text-text-muted" />
        <h1 className="mbe-2 text-2xl font-bold text-text-primary">
          {t('payment.cancelledTitle')}
        </h1>
        <p className="mbe-6 text-sm text-text-secondary">
          {t('payment.cancelledDesc')}
        </p>

        <div className="mbs-6 flex flex-col gap-3">
          <button
            onClick={() => navigate('/plans')}
            className="flex items-center justify-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            <ArrowLeft size={14} />
            {t('payment.backToPlans')}
          </button>
        </div>
      </div>
    </div>
  );
}
