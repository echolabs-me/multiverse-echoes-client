import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useBillingHealth } from '../stores/useBillingHealth.ts';
import type { DunningPhase } from '../types/generated.ts';

/**
 * Persistent app-shell banner that surfaces a user's billing-health
 * state. Mounted in `AppLayout` above `<main>`. Renders nothing for
 * `Active` / `Lapsed` / `null` (the latter while the initial
 * `GET /me/billing-health` is in flight, and for users with no
 * crypto subscription history).
 *
 * Reference: ME-UXF-001 §14.5, ME-MIS-001 §5.4.5.
 */

/**
 * Recency window for `payment.banner.paymentFailed` copy. A
 * `PaymentFailed` WS event landed within this window takes
 * precedence over the phase-driven copy so the user sees immediate
 * feedback that the most recent attempt failed; outside this window
 * the banner falls back to the phase's standing copy. 10 minutes is
 * comfortably longer than the hourly driver tick — by the time the
 * window closes, `DunningPhaseChanged` will have arrived.
 */
const PAYMENT_FAILED_RECENCY_MS = 10 * 60 * 1000;

type BannerVariant = {
  id: string;
  copyKey: string;
  severity: 'warning' | 'error';
};

const PHASE_VARIANTS: Partial<Record<DunningPhase, BannerVariant>> = {
  renewal_pending: {
    id: 'renewal-pending',
    copyKey: 'payment.banner.renewalPending',
    severity: 'warning',
  },
  renewal_imminent: {
    id: 'renewal-imminent',
    copyKey: 'payment.banner.renewalImminent',
    severity: 'warning',
  },
  grace_period: {
    id: 'grace-period',
    copyKey: 'payment.banner.gracePeriod',
    severity: 'error',
  },
};

const PAYMENT_FAILED_VARIANT: BannerVariant = {
  id: 'payment-failed',
  copyKey: 'payment.banner.paymentFailed',
  severity: 'error',
};

function pickVariant(
  phase: DunningPhase | null,
  lastPaymentFailedAt: Date | null,
): BannerVariant | null {
  if (
    lastPaymentFailedAt &&
    Date.now() - lastPaymentFailedAt.getTime() < PAYMENT_FAILED_RECENCY_MS
  ) {
    return PAYMENT_FAILED_VARIANT;
  }
  if (phase === null) return null;
  return PHASE_VARIANTS[phase] ?? null;
}

export function BillingBanner() {
  const { t } = useTranslation();
  const phase = useBillingHealth((s) => s.phase);
  const lastPaymentFailedAt = useBillingHealth((s) => s.lastPaymentFailedAt);

  const variant = pickVariant(phase, lastPaymentFailedAt);
  if (!variant) return null;

  const styles =
    variant.severity === 'error'
      ? 'border-error/30 bg-error/10 text-error'
      : 'border-warning/30 bg-warning/10 text-warning';

  return (
    <div
      className={`flex shrink-0 items-center gap-3 border-be px-4 py-3 text-sm ${styles}`}
      role="alert"
      data-testid="billing-banner-root"
    >
      <AlertTriangle size={18} className="shrink-0" />
      <span
        className="flex-1"
        data-testid={`billing-banner-variant-${variant.id}`}
      >
        {t(variant.copyKey)}
      </span>
      <Link
        to="/plans"
        className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90"
        data-testid="billing-banner-update-payment-link"
      >
        {t('payment.banner.updatePaymentMethod')}
      </Link>
    </div>
  );
}
