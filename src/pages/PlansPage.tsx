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

type TierKey = 'Free' | 'Starter' | 'Core' | 'Creator' | 'GodMode';

type AddOnKey =
  | 'nudge_100_pack'
  | 'premium_actions_20_pack'
  | 'speed_boost'
  | 'video_voice_boost'
  | 'extra_echo'
  | 'private_shard';

type AddOnAvailability = 'available' | 'unavailable' | { included: number };

interface TierSpec {
  key: TierKey;
  stripeKey: string;
  nameKey: string;
  priceCents: number;
  featureKeys: string[];
  popular?: boolean;
}

const TIERS: TierSpec[] = [
  {
    key: 'Free',
    stripeKey: '',
    nameKey: 'tiers.free',
    priceCents: 0,
    featureKeys: [
      'tiers.features.1echoPublic',
      'tiers.features.diaryAmPm',
      'tiers.features.1conv',
      'tiers.features.1nudge',
      'tiers.features.2ip',
    ],
  },
  {
    key: 'Starter',
    stripeKey: 'starter',
    nameKey: 'tiers.starter',
    priceCents: 999,
    featureKeys: [
      'tiers.features.3echoes',
      'tiers.features.diary2hr',
      'tiers.features.5conv',
      'tiers.features.3nudges',
      'tiers.features.4ip',
      'tiers.features.adFree',
    ],
  },
  {
    key: 'Core',
    stripeKey: 'core',
    nameKey: 'tiers.core',
    priceCents: 2499,
    featureKeys: [
      'tiers.features.5echoes',
      'tiers.features.diary30m',
      'tiers.features.10conv',
      'tiers.features.10nudges',
      'tiers.features.6ip',
    ],
    popular: true,
  },
  {
    key: 'Creator',
    stripeKey: 'creator',
    nameKey: 'tiers.creator',
    priceCents: 3999,
    featureKeys: [
      'tiers.features.8echoes',
      'tiers.features.diary15m',
      'tiers.features.20conv',
      'tiers.features.20nudges',
      'tiers.features.12ip',
      'tiers.features.1privateShard',
    ],
  },
  {
    key: 'GodMode',
    stripeKey: 'god_mode',
    nameKey: 'tiers.godMode',
    priceCents: 5999,
    featureKeys: [
      'tiers.features.12echoes',
      'tiers.features.diary5m',
      'tiers.features.unlimitedConv',
      'tiers.features.unlimitedNudges',
      'tiers.features.unlimitedIp',
      'tiers.features.3privateShards',
      'tiers.features.priorityInference',
    ],
  },
];

interface AddOnSpec {
  key: AddOnKey;
  emoji: string;
  nameKey: string;
  descKey: string;
  priceLabel: string;
  recurring: boolean;
}

const ADD_ONS: AddOnSpec[] = [
  { key: 'nudge_100_pack', emoji: '💬', nameKey: 'tiers.addOns.nudgePack', descKey: 'tiers.addOns.nudgePackDesc', priceLabel: '$2.99', recurring: false },
  { key: 'premium_actions_20_pack', emoji: '✨', nameKey: 'tiers.addOns.premiumActionsPack', descKey: 'tiers.addOns.premiumActionsPackDesc', priceLabel: '$3.99', recurring: false },
  { key: 'speed_boost', emoji: '⚡', nameKey: 'tiers.addOns.speedBoost', descKey: 'tiers.addOns.speedBoostDesc', priceLabel: '$4.99', recurring: true },
  { key: 'video_voice_boost', emoji: '🎬', nameKey: 'tiers.addOns.videoVoiceBoost', descKey: 'tiers.addOns.videoVoiceBoostDesc', priceLabel: '$3.99', recurring: true },
  { key: 'extra_echo', emoji: '🎭', nameKey: 'tiers.addOns.extraEcho', descKey: 'tiers.addOns.extraEchoDesc', priceLabel: '$5', recurring: true },
  { key: 'private_shard', emoji: '🌐', nameKey: 'tiers.addOns.privateShard', descKey: 'tiers.addOns.privateShardDesc', priceLabel: '$4.99', recurring: true },
];

const ADDON_AVAILABILITY: Record<AddOnKey, Record<TierKey, AddOnAvailability>> = {
  nudge_100_pack: {
    Free: 'available', Starter: 'available', Core: 'available', Creator: 'available', GodMode: 'unavailable',
  },
  premium_actions_20_pack: {
    Free: 'available', Starter: 'available', Core: 'available', Creator: 'available', GodMode: 'unavailable',
  },
  speed_boost: {
    Free: 'unavailable', Starter: 'available', Core: 'available', Creator: 'available', GodMode: 'unavailable',
  },
  video_voice_boost: {
    Free: 'unavailable', Starter: 'available', Core: 'available', Creator: 'available', GodMode: 'unavailable',
  },
  extra_echo: {
    Free: 'unavailable', Starter: 'available', Core: 'available', Creator: 'available', GodMode: 'available',
  },
  private_shard: {
    Free: 'unavailable', Starter: 'unavailable', Core: 'available', Creator: { included: 1 }, GodMode: { included: 3 },
  },
};

function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars.toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1');
}

export function PlansPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const pageTitle = `${t('payment.title')} — Multiverse Echoes`;
  const pageDesc = t('payment.subtitle');
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState<string | null>(null);

  const currentTier: TierKey = (user?.subscription_tier as TierKey | undefined) ?? 'Free';
  const isPaid = currentTier !== 'Free';

  const handleTierPayment = async (tierKey: string, provider: 'nowpayments' | 'xaman') => {
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
        addToast(t('common.errorGeneric'), 'danger', { platformLink: true });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading('manage');
    try {
      const result = await payments.stripePortal();
      if (result.portal_url) {
        window.location.href = result.portal_url;
      }
    } catch {
      addToast(t('common.errorGeneric'), 'danger', { platformLink: true });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
      </Helmet>
      <div className="mx-auto w-full max-w-6xl p-6">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier) => {
            const isCurrent = tier.key === currentTier;
            const isFree = tier.key === 'Free';

            return (
              <Card key={tier.key} className={isCurrent ? 'border-accent' : ''}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-text-primary">{t(tier.nameKey)}</h3>
                    {isCurrent && <Badge variant="success">{t('payment.current')}</Badge>}
                    {tier.popular && !isCurrent && (
                      <Badge variant="accent">{t('tiers.mostPopular')}</Badge>
                    )}
                  </div>
                  <p className="text-xl font-semibold text-accent">
                    {isFree ? t('payment.free') : `$${formatPrice(tier.priceCents)}${t('payment.perMonth')}`}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {tier.featureKeys.map((featureKey) => {
                      const isIpRow =
                        featureKey.endsWith('ip') || featureKey === 'tiers.features.unlimitedIp';
                      return (
                        <li key={featureKey} className="flex items-start gap-2 text-xs text-text-secondary">
                          <Check size={14} className="mt-0.5 shrink-0 text-success" />
                          <span>
                            {t(featureKey)}
                            {isIpRow && (
                              <Tooltip content={t('tiers.influencePoints.explainer')} position="top">
                                <span className="ml-1 cursor-help text-[10px] text-text-muted">ⓘ</span>
                              </Tooltip>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {!isFree && !isCurrent && (
                    <div className="mt-2 flex flex-col gap-2">
                      <Tooltip content={t('payment.cardComingSoon')} position="top">
                        <button
                          onClick={() => addToast(t('payment.cardComingSoon'), 'info')}
                          className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#635BFF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#5851db] transition-colors"
                        >
                          <StripeLogo height={20} />
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white/90">{t('common.comingSoon')}</span>
                        </button>
                      </Tooltip>

                      <button
                        onClick={() => void handleTierPayment(tier.stripeKey, 'nowpayments')}
                        disabled={loading !== null}
                        className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-900 disabled:opacity-50 transition-colors"
                      >
                        <NowPaymentsLogo height={16} />
                        {loading === `${tier.stripeKey}-nowpayments` ? t('payment.subscribing') : t('payment.payWithCrypto')}
                      </button>

                      <button
                        onClick={() => void handleTierPayment(tier.stripeKey, 'xaman')}
                        disabled={loading !== null}
                        className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#3052FF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#2744d9] disabled:opacity-50 transition-colors"
                      >
                        <XamanLogo height={16} />
                        {loading === `${tier.stripeKey}-xaman` ? t('payment.subscribing') : t('payment.payWithXRP')}
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

        <Card className="mt-6">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-text-primary">{t('tiers.enterprise')}</h3>
              <p className="text-xs text-text-secondary">{t('tiers.enterpriseDesc')}</p>
            </div>
            <button
              onClick={() => navigate('/contact')}
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-xs font-semibold text-text-primary hover:bg-surface-raised transition-colors"
            >
              {t('tiers.contactUs')}
            </button>
          </div>
        </Card>

        <div className="mt-10">
          <h2 className="mb-1 text-xl font-bold text-text-primary">{t('tiers.addOns.title')}</h2>
          <p className="mb-4 text-sm text-text-secondary">{t('tiers.enhanceTiers')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addon) => {
              const availability = ADDON_AVAILABILITY[addon.key][currentTier];
              const canBuy = availability === 'available';
              const isIncluded = typeof availability === 'object' && 'included' in availability;
              return (
                <Card key={addon.key}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{addon.emoji}</span>
                      <h3 className="flex-1 text-sm font-bold text-text-primary">{t(addon.nameKey)}</h3>
                    </div>
                    <p className="text-sm font-semibold text-accent">
                      {addon.priceLabel}
                      {addon.recurring ? t('payment.perMonth') : ''}
                    </p>
                    <p className="text-xs leading-relaxed text-text-secondary">{t(addon.descKey)}</p>
                    {canBuy && (
                      <Tooltip content={t('payment.cardComingSoon')} position="top">
                        <button
                          onClick={() => addToast(t('payment.cardComingSoon'), 'info')}
                          disabled={loading !== null}
                          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5851db] disabled:opacity-50 transition-colors"
                        >
                          <StripeLogo height={16} />
                          <span>{t('tiers.addOns.buyAddon')}</span>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium text-white/90">
                            {t('common.comingSoon')}
                          </span>
                        </button>
                      </Tooltip>
                    )}
                    {isIncluded && (
                      <p className="mt-1 text-xs font-semibold text-success">
                        {t('tiers.addOns.included', { count: availability.included })}
                      </p>
                    )}
                    {availability === 'unavailable' && (
                      <p className="mt-1 text-xs italic text-text-muted">{t('tiers.addOns.notAvailableOnPlan')}</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
