import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Check, Settings } from 'lucide-react';
import { Card, Badge, Tooltip } from '../components/index.ts';
import { StripeLogo, NowPaymentsLogo, XamanLogo } from '../components/PaymentIcons.tsx';
import { payments } from '../lib/api/endpoints.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useToastStore } from '../stores/useToastStore.ts';

const TIERS = [
  {
    name: 'Free',
    key: 'Free' as const,
    stripeKey: '',
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
    stripeKey: 'core',
    price: 900,
    features: [
      '5 Echoes',
      '5 conversations/day (20 messages)',
      'Access to public Shards',
      '5 influence points/day',
      '2 API keys',
    ],
  },
  {
    name: 'Creator',
    key: 'Creator' as const,
    stripeKey: 'creator',
    price: 2900,
    features: [
      '20 Echoes',
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
    stripeKey: 'god_mode',
    price: 9900,
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
  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState<string | null>(null);

  const currentTier = user?.subscription_tier ?? 'Free';
  const isPaid = currentTier !== 'Free';

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Rate lookup') || msg.includes('rate')) {
        addToast(t('payment.cryptoUnavailable'), 'warning');
      } else {
        addToast(t('common.errorGeneric'), 'danger');
      }
    } finally {
      setLoading(null);
    }
  };

  // Stripe checkout handler removed — will be re-added after company incorporation.
  // The Stripe API endpoint (payments.stripeCheckout) still exists in endpoints.ts.

  const handleManageSubscription = async () => {
    setLoading('manage');
    try {
      const result = await payments.stripePortal();
      if (result.portal_url) {
        window.location.href = result.portal_url;
      }
    } catch {
      addToast(t('common.errorGeneric'), 'danger');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>{t('payment.title')} — Multiverse Echoes</title>
        <meta name="description" content={t('payment.subtitle')} />
      </Helmet>
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

        {isPaid && (
          <div className="mb-6">
            <button
              onClick={() => void handleManageSubscription()}
              disabled={loading === 'manage'}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
            >
              <Settings size={16} />
              {loading === 'manage' ? t('common.loading') : t('payment.manageSubscription')}
            </button>
          </div>
        )}

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
                    {isFree ? t('payment.free') : `$${(tier.price / 100).toFixed(0)}${t('payment.perMonth')}`}
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
                      {/* Stripe — branded purple button with Coming Soon badge */}
                      <Tooltip content={t('payment.cardComingSoon')} position="top">
                        <button
                          onClick={() => addToast(t('payment.cardComingSoon'), 'info')}
                          className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#635BFF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#5851db] transition-colors"
                        >
                          <StripeLogo height={20} />
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white/90">{t('common.comingSoon')}</span>
                        </button>
                      </Tooltip>

                      {/* NOWPayments — black button */}
                      <button
                        onClick={() => void handlePayment(tier.key, 'nowpayments')}
                        disabled={loading !== null}
                        className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-900 disabled:opacity-50 transition-colors"
                      >
                        <NowPaymentsLogo height={16} />
                        {loading === `${tier.key}-nowpayments` ? t('payment.subscribing') : t('payment.payWithCrypto')}
                      </button>

                      {/* Xaman — branded blue button */}
                      <button
                        onClick={() => void handlePayment(tier.key, 'xaman')}
                        disabled={loading !== null}
                        className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#3052FF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#2744d9] disabled:opacity-50 transition-colors"
                      >
                        <XamanLogo height={16} />
                        {loading === `${tier.key}-xaman` ? t('payment.subscribing') : t('payment.payWithXRP')}
                      </button>
                    </div>
                  )}

                  {isCurrent && !isFree && (
                    <p className="mt-2 text-center text-xs text-text-secondary">{t('payment.currentPlan')}</p>
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
