import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, CreditCard, Coins, Wallet } from 'lucide-react';
import { Card, Badge } from '../components/index.ts';
import { payments } from '../lib/api/endpoints.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';

const TIERS = [
  {
    name: 'Free',
    key: 'Free' as const,
    price: 0,
    features: [
      '1 Echo',
      '1 conversation/day (10 messages)',
      'Personal Shard',
      'Basic diary & timeline',
    ],
  },
  {
    name: 'Core',
    key: 'Core' as const,
    price: 999,
    features: [
      '3 Echoes',
      '5 conversations/day (20 messages)',
      'Access to public Shards',
      '5 influence points/day',
      '2 API keys',
    ],
  },
  {
    name: 'Creator',
    key: 'Creator' as const,
    price: 2499,
    features: [
      '10 Echoes',
      '20 conversations/day (50 messages)',
      'Create custom Shards',
      '20 influence points/day',
      '10 API keys',
      'Story export (video)',
    ],
  },
  {
    name: 'God Mode',
    key: 'GodMode' as const,
    price: 4999,
    features: [
      '50 Echoes',
      'Unlimited conversations',
      'All Creator features',
      'Unlimited influence',
      'Priority LLM inference',
      'Early access to new features',
    ],
  },
];

export function PlansPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState<string | null>(null);

  const currentTier = user?.subscription_tier ?? 'Free';

  const handlePayment = async (tierKey: string, provider: 'nowpayments' | 'xaman') => {
    setLoading(`${tierKey}-${provider}`);
    try {
      const result =
        provider === 'nowpayments'
          ? await payments.createNowpayments(tierKey)
          : await payments.createXaman(tierKey);

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      // Error handled by API client
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="mx-auto w-full max-w-5xl p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <h1 className="mb-2 text-2xl font-bold text-text-primary">{t('payment.title')}</h1>
        <p className="mb-8 text-sm text-text-secondary">{t('payment.subtitle')}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.key === currentTier;
            const isFree = tier.key === 'Free';

            return (
              <Card key={tier.name} className={isCurrent ? 'border-accent' : ''}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-text-primary">{tier.name}</h3>
                    {isCurrent && <Badge variant="success">{t('payment.current')}</Badge>}
                  </div>
                  <p className="text-xl font-semibold text-accent">
                    {isFree ? t('payment.free') : `$${(tier.price / 100).toFixed(2)}${t('payment.perMonth')}`}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-text-secondary">
                        <Check size={14} className="mt-0.5 shrink-0 text-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {!isFree && !isCurrent && (
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        onClick={() => handlePayment(tier.key, 'nowpayments')}
                        disabled={loading !== null}
                        className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                      >
                        <Coins size={14} />
                        {loading === `${tier.key}-nowpayments` ? t('payment.subscribing') : t('payment.payWithCrypto')}
                      </button>
                      <button
                        onClick={() => handlePayment(tier.key, 'xaman')}
                        disabled={loading !== null}
                        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50"
                      >
                        <Wallet size={14} />
                        {loading === `${tier.key}-xaman` ? t('payment.subscribing') : t('payment.payWithXRP')}
                      </button>
                      <button
                        disabled
                        title={t('payment.cardComingSoon')}
                        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-muted opacity-50"
                      >
                        <CreditCard size={14} />
                        {t('payment.payWithCard')}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
