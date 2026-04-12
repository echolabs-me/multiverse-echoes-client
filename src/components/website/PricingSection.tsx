import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/useAuthStore.ts';

interface Tier {
  nameKey: string;
  price: string;
  echoes: string;
  heartbeat: string;
  conversations: string;
  nudges: string;
  video: string;
  voice: string;
  adNote: string;
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    nameKey: 'tiers.free',
    price: '$0',
    echoes: '1',
    heartbeat: 'tiers.twiceDaily',
    conversations: '—',
    nudges: 'tiers.addOns.title',
    video: '2',
    voice: '2',
    adNote: 'tiers.adSupported',
  },
  {
    nameKey: 'tiers.starter',
    price: '$9.99',
    echoes: '3',
    heartbeat: '120 min',
    conversations: '5',
    nudges: '3',
    video: '6',
    voice: '6',
    adNote: 'tiers.adFree',
  },
  {
    nameKey: 'tiers.core',
    price: '$24.99',
    echoes: '5',
    heartbeat: '30 min',
    conversations: '10',
    nudges: '10',
    video: '10',
    voice: '10',
    adNote: 'tiers.adFree',
    popular: true,
  },
  {
    nameKey: 'tiers.creator',
    price: '$39.99',
    echoes: '8',
    heartbeat: '15 min',
    conversations: '20',
    nudges: '20',
    video: '16',
    voice: '16',
    adNote: 'tiers.adFree',
  },
  {
    nameKey: 'tiers.godMode',
    price: '$59.99',
    echoes: '12',
    heartbeat: '5 min',
    conversations: 'tiers.unlimited',
    nudges: 'tiers.unlimited',
    video: 'tiers.unlimited',
    voice: 'tiers.unlimited',
    adNote: 'tiers.adFree',
  },
];

interface AddOn {
  nameKey: string;
  descKey: string;
  price: string;
}

const ADD_ONS: AddOn[] = [
  { nameKey: 'tiers.addOns.speedBoost', descKey: 'tiers.addOns.speedBoostDesc', price: '$4.99/mo' },
  { nameKey: 'tiers.addOns.videoVoiceBoost', descKey: 'tiers.addOns.videoVoiceBoostDesc', price: '$3.99/mo' },
  { nameKey: 'tiers.addOns.extraEcho', descKey: 'tiers.addOns.extraEchoDesc', price: '$5/mo' },
  { nameKey: 'tiers.addOns.nudgePack', descKey: 'tiers.addOns.nudgePackDesc', price: '$2.99' },
  { nameKey: 'tiers.addOns.privateShard', descKey: 'tiers.addOns.privateShardDesc', price: '$4.99/mo' },
];

function FeatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-2 text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function PricingSection() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const resolveValue = (val: string): string => {
    // If it looks like an i18n key, translate it
    if (val.startsWith('tiers.')) {
      return t(val);
    }
    return val;
  };

  return (
    <section id="pricing" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 text-center text-3xl font-light tracking-wider text-[var(--text-primary)]">
          {t('website.nav.pricing')}
        </h2>
        <p className="mx-auto mb-16 max-w-lg text-center text-[var(--text-secondary)]">
          {t('payment.subtitle')}
        </p>

        {/* Tier cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <div
              key={tier.nameKey}
              className={`relative flex flex-col rounded-xl border p-5 transition-all hover:border-[var(--accent)] ${
                tier.popular
                  ? 'border-[var(--accent)] shadow-[0_0_30px_rgba(212,145,92,0.15)]'
                  : 'border-[var(--border)]'
              } bg-[var(--surface)]`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-semibold text-[var(--canvas)]">
                  {t('tiers.mostPopular')}
                </span>
              )}

              <h3 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">{t(tier.nameKey)}</h3>
              <div className="mb-4">
                <span className="text-2xl font-bold text-[var(--accent)]">{tier.price}</span>
                {tier.price !== '$0' && (
                  <span className="text-xs text-[var(--text-muted)]">/{t('tiers.perMonth')}</span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-0">
                <FeatureRow label={t('tiers.echoes')} value={tier.echoes} />
                <FeatureRow label={t('tiers.heartbeat')} value={resolveValue(tier.heartbeat)} />
                <FeatureRow label={t('tiers.conversations')} value={resolveValue(tier.conversations)} />
                <FeatureRow label={t('tiers.nudges')} value={resolveValue(tier.nudges)} />
                <FeatureRow label={t('tiers.videoDiary')} value={`${resolveValue(tier.video)}${tier.video !== 'tiers.unlimited' ? ` ${t('tiers.perDay')}` : ''}`} />
                <FeatureRow label={t('tiers.voiceCalls')} value={`${resolveValue(tier.voice)}${tier.voice !== 'tiers.unlimited' ? ` ${t('tiers.perDay')}` : ''}`} />
                <div className="mt-2 text-center text-xs text-[var(--text-muted)]">{t(tier.adNote)}</div>
              </div>

              <Link
                to={isAuthenticated ? '/settings' : '/register'}
                className={`mt-4 block rounded-md py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.popular
                    ? 'bg-[var(--accent)] text-[var(--canvas)] hover:bg-[var(--accent-hover)]'
                    : 'border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              >
                {tier.price === '$0' ? t('website.hero.cta') : t('tiers.subscribe')}
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">{t('tiers.enterprise')}</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Custom echoes, custom heartbeat, custom everything.
          </p>
          <a
            href="mailto:hello@echolabs.me"
            className="inline-block rounded-md border border-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--canvas)]"
          >
            {t('tiers.contactUs')}
          </a>
        </div>

        {/* Add-ons */}
        <div className="mt-16">
          <h3 className="mb-8 text-center text-xl font-light tracking-wider text-[var(--text-primary)]">
            {t('tiers.addOns.title')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ADD_ONS.map((addon) => (
              <div
                key={addon.nameKey}
                className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t(addon.nameKey)}</h4>
                  <span className="shrink-0 text-sm font-bold text-[var(--accent)]">{addon.price}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{t(addon.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
