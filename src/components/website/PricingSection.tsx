import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/useAuthStore.ts';
import { Tooltip } from '../index.ts';

/* ── Tier data matching echolabsme-pricing-v5.html ── */

type TierKey = 'free' | 'starter' | 'core' | 'creator' | 'godMode';

interface Tier {
  key: TierKey;
  nameKey: string;
  icon: string;
  tagline: string;
  price: string;
  cents: string;
  period: string;
  note?: string;
  echoes: string;
  heartbeat: string;
  features: { text: string; type: 'check' | 'x' | 'star' | 'addon' }[];
  showcase: string[];
  btnStyle: 'outline' | 'primary' | 'gold';
  iconClass: string;
  popular?: boolean;
  god?: boolean;
}

const TIERS: Tier[] = [
  {
    key: 'free',
    nameKey: 'tiers.free',
    icon: '👁',
    tagline: 'tiers.taglineFree',
    price: '0',
    cents: '',
    period: 'tiers.forever',
    note: 'tiers.adSupported',
    echoes: '1',
    heartbeat: 'tiers.heartbeatTwiceDaily',
    features: [
      { text: 'tiers.features.1echoPublic', type: 'check' },
      { text: 'tiers.features.diaryAmPm', type: 'check' },
      { text: 'tiers.features.aiPortraits', type: 'check' },
      { text: 'tiers.features.1conv', type: 'check' },
      { text: 'tiers.features.1nudge', type: 'check' },
      { text: 'tiers.features.2ip', type: 'check' },
    ],
    showcase: ['tiers.showcaseText.2vid', 'tiers.showcaseText.2voice'],
    btnStyle: 'outline',
    iconClass: 'bg-[rgba(220,80,80,0.1)]',
  },
  {
    key: 'starter',
    nameKey: 'tiers.starter',
    icon: '✦',
    tagline: 'tiers.taglineStarter',
    price: '9',
    cents: '.99',
    period: 'tiers.perMonth',
    echoes: '3',
    heartbeat: 'tiers.heartbeat2hr',
    features: [
      { text: 'tiers.features.3echoes', type: 'check' },
      { text: 'tiers.features.diary2hr', type: 'check' },
      { text: 'tiers.features.5conv', type: 'check' },
      { text: 'tiers.features.3nudges', type: 'check' },
      { text: 'tiers.features.4ip', type: 'check' },
      { text: 'tiers.features.adFree', type: 'check' },
    ],
    showcase: ['tiers.showcaseText.6vid', 'tiers.showcaseText.6voice'],
    btnStyle: 'outline',
    iconClass: 'bg-[rgba(76,175,125,0.12)]',
  },
  {
    key: 'core',
    nameKey: 'tiers.core',
    icon: '◈',
    tagline: 'tiers.taglineCore',
    price: '24',
    cents: '.99',
    period: 'tiers.perMonth',
    echoes: '5',
    heartbeat: 'tiers.heartbeat30m',
    features: [
      { text: 'tiers.features.5echoes', type: 'check' },
      { text: 'tiers.features.diary30m', type: 'check' },
      { text: 'tiers.features.10conv', type: 'check' },
      { text: 'tiers.features.10nudges', type: 'check' },
      { text: 'tiers.features.6ip', type: 'check' },
      { text: 'tiers.features.privateShard', type: 'addon' },
    ],
    showcase: ['tiers.showcaseText.10vid', 'tiers.showcaseText.10voice'],
    btnStyle: 'primary',
    iconClass: 'bg-[rgba(212,145,92,0.08)]',
    popular: true,
  },
  {
    key: 'creator',
    nameKey: 'tiers.creator',
    icon: '⬡',
    tagline: 'tiers.taglineCreator',
    price: '39',
    cents: '.99',
    period: 'tiers.perMonth',
    echoes: '8',
    heartbeat: 'tiers.heartbeat15m',
    features: [
      { text: 'tiers.features.8echoes', type: 'check' },
      { text: 'tiers.features.diary15m', type: 'check' },
      { text: 'tiers.features.20conv', type: 'check' },
      { text: 'tiers.features.20nudges', type: 'check' },
      { text: 'tiers.features.12ip', type: 'check' },
      { text: 'tiers.features.1privateShard', type: 'check' },
    ],
    showcase: ['tiers.showcaseText.16vid', 'tiers.showcaseText.16voice'],
    btnStyle: 'outline',
    iconClass: 'bg-[rgba(139,126,200,0.1)]',
  },
  {
    key: 'godMode',
    nameKey: 'tiers.godMode',
    icon: '♛',
    tagline: 'tiers.taglineGodMode',
    price: '59',
    cents: '.99',
    period: 'tiers.perMonth',
    echoes: '12',
    heartbeat: 'tiers.heartbeat5m',
    features: [
      { text: 'tiers.features.12echoes', type: 'star' },
      { text: 'tiers.features.diary5m', type: 'star' },
      { text: 'tiers.features.unlimitedConv', type: 'star' },
      { text: 'tiers.features.unlimitedNudges', type: 'star' },
      { text: 'tiers.features.unlimitedIp', type: 'star' },
      { text: 'tiers.features.3privateShards', type: 'star' },
      { text: 'tiers.features.priorityInference', type: 'star' },
    ],
    showcase: ['tiers.showcaseText.unlimitedVid', 'tiers.showcaseText.unlimitedVoice'],
    btnStyle: 'gold',
    iconClass: 'bg-[rgba(201,168,76,0.1)]',
    god: true,
  },
];

interface AddOn {
  key: AddOnKey;
  emoji: string;
  nameKey: string;
  price: string;
  recurring?: boolean;
  descKey: string;
  highlight?: boolean;
  showcaseHl?: boolean;
}

type AddOnKey =
  | 'nudge_100_pack'
  | 'premium_actions_20_pack'
  | 'speed_boost'
  | 'video_voice_boost'
  | 'extra_echo'
  | 'private_shard';

/** ME-MIS-001 canonical add-on matrix.
 *  'available' = purchasable as an add-on.
 *  'unavailable' = not applicable at this tier.
 *  { included: N } = tier includes N of this item at no extra cost.
 *  Order of tiers in this record is irrelevant — lookups are keyed. */
type AddOnAvailability = 'available' | 'unavailable' | { included: number };

const ADDON_MATRIX: Record<AddOnKey, Record<TierKey, AddOnAvailability>> = {
  nudge_100_pack: {
    free: 'available',
    starter: 'available',
    core: 'available',
    creator: 'available',
    godMode: 'unavailable',
  },
  premium_actions_20_pack: {
    free: 'available',
    starter: 'available',
    core: 'available',
    creator: 'available',
    godMode: 'unavailable',
  },
  speed_boost: {
    free: 'unavailable',
    starter: 'available',
    core: 'available',
    creator: 'available',
    godMode: 'unavailable',
  },
  video_voice_boost: {
    free: 'unavailable',
    starter: 'available',
    core: 'available',
    creator: 'available',
    godMode: 'unavailable',
  },
  extra_echo: {
    free: 'unavailable',
    starter: 'available',
    core: 'available',
    creator: 'available',
    godMode: 'available',
  },
  private_shard: {
    free: 'unavailable',
    starter: 'unavailable',
    core: 'available',
    creator: { included: 1 },
    godMode: { included: 3 },
  },
};

const ADD_ONS: AddOn[] = [
  { key: 'speed_boost', emoji: '⚡', nameKey: 'tiers.addOns.speedBoost', price: '$4.99', recurring: true, descKey: 'tiers.addOns.speedBoostDesc', highlight: true },
  { key: 'video_voice_boost', emoji: '🎬', nameKey: 'tiers.addOns.videoVoiceBoost', price: '$3.99', recurring: true, descKey: 'tiers.addOns.videoVoiceBoostDesc', showcaseHl: true },
  { key: 'extra_echo', emoji: '🎭', nameKey: 'tiers.addOns.extraEcho', price: '$5', recurring: true, descKey: 'tiers.addOns.extraEchoDesc' },
  { key: 'nudge_100_pack', emoji: '💬', nameKey: 'tiers.addOns.nudgePack', price: '$2.99', descKey: 'tiers.addOns.nudgePackDesc' },
  { key: 'premium_actions_20_pack', emoji: '✨', nameKey: 'tiers.addOns.premiumActionsPack', price: '$3.99', descKey: 'tiers.addOns.premiumActionsPackDesc' },
  { key: 'private_shard', emoji: '🌐', nameKey: 'tiers.addOns.privateShard', price: '$4.99', recurring: true, descKey: 'tiers.addOns.privateShardDesc' },
];

const ICON_MAP = { check: '✓', x: '✗', star: '★', addon: '✓' };
const COLOR_MAP = { check: 'text-[#4CAF7D]', x: 'text-[var(--text-muted)] opacity-50', star: 'text-[#C9A84C]', addon: 'text-[#4CAF7D]' };

export function PricingSection() {
  const { t } = useTranslation();
  // Read once — don't subscribe. Backend failures must not re-render public pages.
  const isAuthenticated = useAuthStore.getState().isAuthenticated;

  return (
    <section id="pricing" className="section-reveal px-4 pb-24 pt-28 sm:px-6">
      <div className="mx-auto max-w-[1360px]">
        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-6 font-serif text-xs uppercase tracking-[4px] text-[var(--accent)]">{t('website.pricing.eyebrow')}</p>
          <h2 className="mb-4 font-serif text-4xl font-semibold text-[var(--text-primary)]">
            {t('website.pricing.headline')}
          </h2>
          <p className="mx-auto max-w-xl text-[var(--text-secondary)]">
            {t('website.pricing.subheadline')}
          </p>
        </div>

        {/* Tier cards */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <div
              key={tier.nameKey}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] ${
                tier.popular
                  ? 'border-[var(--accent)] bg-[#1A2330] shadow-[0_0_40px_rgba(212,145,92,0.15)]'
                  : tier.god
                    ? 'border-[#C9A84C] bg-[#111920] shadow-[0_0_30px_rgba(201,168,76,0.1)]'
                    : 'border-[#1E2A36] bg-[#111920]'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-1 text-[11px] font-bold uppercase tracking-[1.5px] text-[#0A0F14]">
                  {t('tiers.mostPopular')}
                </span>
              )}
              {tier.god && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E0C060] px-4 py-1 text-[11px] font-bold uppercase tracking-[1.5px] text-[#0A0F14]">
                  {t('tiers.ultimate')}
                </span>
              )}

              {/* Icon */}
              <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] text-xl ${tier.iconClass}`}>
                {tier.icon}
              </div>

              {/* Name + tagline */}
              <h3 className="mb-1 font-serif text-2xl font-bold text-[var(--text-primary)]">{t(tier.nameKey)}</h3>
              <p className="mb-5 min-h-[36px] text-[13px] text-[var(--text-muted)]">{t(tier.tagline)}</p>

              {/* Price */}
              <div className="mb-6 border-b border-[#1E2A36] pb-5">
                <div className="text-4xl font-bold leading-none text-[var(--text-primary)]">
                  <span className="align-super text-xl">$</span>
                  {tier.price}
                  {tier.cents && <span className="text-xl">{tier.cents}</span>}
                </div>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">{t(tier.period)}</p>
                {tier.note && <p className="mt-1 text-xs font-medium text-[var(--accent)]">{t(tier.note)}</p>}
              </div>

              {/* Stats grid */}
              <div className="mb-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[rgba(255,255,255,0.03)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{tier.echoes}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{tier.echoes === '1' ? t('tiers.echoesSingle', 'Echo') : t('tiers.echoes')}</div>
                </div>
                <div className="rounded-lg bg-[rgba(255,255,255,0.03)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{t(tier.heartbeat)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{tier.heartbeat === 'tiers.heartbeatTwiceDaily' ? t('tiers.heartbeatDaily') : t('tiers.heartbeat')}</div>
                </div>
              </div>

              {/* Features */}
              <ul className="mb-6 flex flex-1 flex-col gap-1">
                {tier.features.map((f) => {
                  const isIpRow = f.text.endsWith('ip') || f.text === 'tiers.features.unlimitedIp';
                  return (
                    <li key={f.text} className="flex items-start gap-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                      <span className={`mt-0.5 shrink-0 text-sm ${COLOR_MAP[f.type]}`}>{ICON_MAP[f.type]}</span>
                      <span>
                        {t(f.text)}
                        {f.type === 'addon' && (
                          <span className="ml-1.5 rounded bg-[rgba(212,145,92,0.08)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent)]">
                            {t('tiers.addonLabel')}
                          </span>
                        )}
                        {isIpRow && (
                          <Tooltip content={t('tiers.influencePoints.explainer')} position="top">
                            <span className="ml-1 cursor-help text-[10px] text-[var(--text-muted)]">ⓘ</span>
                          </Tooltip>
                        )}
                      </span>
                    </li>
                  );
                })}

                {/* Showcase divider */}
                <li className="my-1 border-t border-[#1E2A36]" />
                <li className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#4CA8AF]">
                  {t('tiers.showcase')}
                  <span className="flex-1 border-t border-[rgba(76,168,175,0.2)]" />
                </li>
                {tier.showcase.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                    <span className={`mt-0.5 shrink-0 text-sm ${tier.god ? 'text-[#C9A84C]' : 'text-[#4CA8AF]'}`}>
                      {tier.god ? '★' : '▶'}
                    </span>
                    {t(s)}
                  </li>
                ))}

                {/* Add-on availability strip */}
                <li className="my-1 border-t border-[#1E2A36]" />
                <li className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {t('tiers.addOns.title')}
                  <span className="flex-1 border-t border-[rgba(255,255,255,0.08)]" />
                </li>
                <li className="flex flex-wrap gap-1.5">
                  {ADD_ONS.map((addon) => {
                    const availability = ADDON_MATRIX[addon.key][tier.key];
                    let label: string;
                    let chipClass: string;
                    if (availability === 'available') {
                      label = t('tiers.addOns.availabilityAddon');
                      chipClass = 'bg-[rgba(212,145,92,0.12)] text-[var(--accent)]';
                    } else if (availability === 'unavailable') {
                      label = t('tiers.addOns.availabilityUnavailable');
                      chipClass = 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] opacity-60';
                    } else {
                      label = t('tiers.addOns.included', { count: availability.included });
                      chipClass = 'bg-[rgba(76,175,125,0.14)] text-[#4CAF7D]';
                    }
                    return (
                      <Tooltip
                        key={addon.key}
                        content={`${t(addon.nameKey)} — ${label}`}
                        position="top"
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${chipClass}`}
                        >
                          <span>{addon.emoji}</span>
                          <span className="sr-only">{t(addon.nameKey)}: </span>
                          <span>{label}</span>
                        </span>
                      </Tooltip>
                    );
                  })}
                </li>
              </ul>

              {/* Button */}
              <Link
                to={isAuthenticated ? '/settings' : '/register'}
                className={`mt-auto block rounded-[10px] py-3 text-center text-sm font-semibold tracking-wider transition-all duration-200 ${
                  tier.btnStyle === 'primary'
                    ? 'bg-[var(--accent)] text-[#0A0F14] hover:bg-[#e0a06a] hover:shadow-[0_4px_20px_rgba(212,145,92,0.15)]'
                    : tier.btnStyle === 'gold'
                      ? 'bg-gradient-to-r from-[#C9A84C] to-[#E0C060] text-[#0A0F14] hover:shadow-[0_4px_20px_rgba(201,168,76,0.2)]'
                      : 'border border-[#1E2A36] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tier.price === '0' ? t('tiers.getStarted') : t('tiers.subscribe')}
              </Link>
            </div>
          ))}
        </div>

        {/* Voice call note */}
        <p className="mb-16 text-center text-[13px] italic text-[var(--text-muted)]">
          {t('tiers.voiceCallNote')}
        </p>

        {/* Add-ons */}
        <div className="mb-16">
          <div className="mb-9 text-center">
            <h3 className="mb-2 font-serif text-3xl font-semibold text-[var(--text-primary)]">
              {t('tiers.addOns.title')}
            </h3>
            <p className="text-[15px] text-[var(--text-secondary)]">
              {t('tiers.enhanceTiers')}
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {ADD_ONS.map((addon) => (
              <div
                key={addon.nameKey}
                className={`rounded-xl border p-5 transition-all duration-300 hover:bg-[#161E27] ${
                  addon.highlight
                    ? 'border-[rgba(212,145,92,0.3)] bg-gradient-to-br from-[#111920] to-[rgba(212,145,92,0.04)]'
                    : addon.showcaseHl
                      ? 'border-[rgba(76,168,175,0.3)] bg-gradient-to-br from-[#111920] to-[rgba(76,168,175,0.04)]'
                      : 'border-[#1E2A36] bg-[#111920]'
                }`}
              >
                <div className="mb-3 text-2xl">{addon.emoji}</div>
                <h4 className="mb-1 text-[15px] font-semibold text-[var(--text-primary)]">{t(addon.nameKey)}</h4>
                <p className="mb-2 text-lg font-bold text-[var(--accent)]">{addon.price}{addon.recurring ? t('payment.perMonth') : ''}</p>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{t(addon.descKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-[#1E2A36] bg-gradient-to-br from-[#111920] to-[rgba(139,126,200,0.08)] p-12 text-center">
          <h3 className="mb-3 font-serif text-3xl font-semibold text-[var(--text-primary)]">
            {t('tiers.enterprise')}
          </h3>
          <p className="mx-auto mb-6 max-w-lg text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {t('tiers.enterpriseDesc')}
          </p>
          <div className="mb-7 flex flex-wrap justify-center gap-6">
            {[
              'tiers.enterpriseFeatures.customEchoLimits',
              'tiers.enterpriseFeatures.customHeartbeat',
              'tiers.enterpriseFeatures.dedicatedSupport',
              'tiers.enterpriseFeatures.slaGuarantees',
              'tiers.enterpriseFeatures.apiAccess'
            ].map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
                <span className="text-[#8B7EC8]">✓</span> {t(f)}
              </span>
            ))}
          </div>
          <Link
            to="/contact"
            className="inline-block rounded-[10px] border border-[#8B7EC8] px-10 py-3.5 text-sm font-semibold tracking-wider text-[#8B7EC8] transition-all hover:bg-[rgba(139,126,200,0.1)] hover:shadow-[0_4px_20px_rgba(139,126,200,0.15)]"
          >
            {t('tiers.contactUs')}
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-12 text-center text-[13px] leading-relaxed text-[var(--text-muted)]">
          {t('tiers.footerNoteLine1')}<br />
          {t('tiers.footerNoteLine2')}<br />
          {t('tiers.footerNoteLine3')}
        </p>
      </div>
    </section>
  );
}
