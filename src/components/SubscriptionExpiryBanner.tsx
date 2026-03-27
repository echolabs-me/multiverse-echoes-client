import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore.ts';

export function SubscriptionExpiryBanner() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;
  if (user.subscription_tier === 'Free') return null;

  const expiresAt = user.subscription_expires_at;
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining > 7) return null;

  const isExpired = daysRemaining <= 0;

  return (
    <div
      className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
        isExpired
          ? 'border-error/30 bg-error/10 text-error'
          : 'border-warning/30 bg-warning/10 text-warning'
      }`}
      role="alert"
    >
      <AlertTriangle size={18} className="shrink-0" />
      <span className="flex-1">
        {isExpired
          ? t('payment.expiredBanner')
          : t('payment.renewBanner', { tier: user.subscription_tier, days: daysRemaining })}
      </span>
      <Link
        to="/plans"
        className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90"
      >
        {t('payment.renew')}
      </Link>
    </div>
  );
}
