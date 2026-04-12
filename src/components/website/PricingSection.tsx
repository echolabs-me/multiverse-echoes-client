import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/useAuthStore.ts';

/* ── Tier data matching echolabsme-pricing-v5.html ── */

interface Tier {
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
    nameKey: 'tiers.free',
    icon: '👁',
    tagline: 'A glimpse into another life',
    price: '0',
    cents: '',
    period: 'forever',
    note: 'ad-supported',
    echoes: '1',
    heartbeat: '2×',
    features: [
      { text: '1 Echo in a public Shard', type: 'check' },
      { text: 'Morning & evening diary', type: 'check' },
      { text: 'AI-generated portraits', type: 'check' },
      { text: 'Conversations', type: 'x' },
      { text: 'Nudges', type: 'addon' },
    ],
    showcase: ['2 video diaries / day', '2 voice calls / day'],
    btnStyle: 'outline',
    iconClass: 'bg-[rgba(220,80,80,0.1)]',
  },
  {
    nameKey: 'tiers.starter',
    icon: '✦',
    tagline: 'Your first alternate lives',
    price: '9',
    cents: '.99',
    period: 'per month',
    echoes: '3',
    heartbeat: '2hr',
    features: [
      { text: '3 Echoes across any Shards', type: 'check' },
      { text: 'New diary every 2 hours', type: 'check' },
      { text: '5 conversations / day', type: 'check' },
      { text: '3 nudges / day', type: 'check' },
      { text: 'Ad-free experience', type: 'check' },
    ],
    showcase: ['6 video diaries / day', '6 voice calls / day'],
    btnStyle: 'outline',
    iconClass: 'bg-[rgba(76,175,125,0.12)]',
  },
  {
    nameKey: 'tiers.core',
    icon: '◈',
    tagline: 'The full experience',
    price: '24',
    cents: '.99',
    period: 'per month',
    echoes: '5',
    heartbeat: '30m',
    features: [
      { text: '5 Echoes across any Shards', type: 'check' },
      { text: 'New diary every 30 minutes', type: 'check' },
      { text: '10 conversations / day', type: 'check' },
      { text: '10 nudges / day', type: 'check' },
      { text: 'Private Shard', type: 'addon' },
    ],
    showcase: ['10 video diaries / day', '10 voice calls / day'],
    btnStyle: 'primary',
    iconClass: 'bg-[rgba(212,145,92,0.08)]',
    popular: true,
  },
  {
    nameKey: 'tiers.creator',
    icon: '⬡',
    tagline: 'Direct your multiverse',
    price: '39',
    cents: '.99',
    period: 'per month',
    echoes: '8',
    heartbeat: '15m',
    features: [
      { text: '8 Echoes across any Shards', type: 'check' },
      { text: 'New diary every 15 minutes', type: 'check' },
      { text: '20 conversations / day', type: 'check' },
      { text: '20 nudges / day', type: 'check' },
      { text: '1 Private Shard included', type: 'check' },
    ],
    showcase: ['16 video diaries / day', '16 voice calls / day'],
    btnStyle: 'outline',
    iconClass: 'bg-[rgba(139,126,200,0.1)]',
  },
  {
    nameKey: 'tiers.godMode',
    icon: '♛',
    tagline: 'Unlimited power',
    price: '59',
    cents: '.99',
    period: 'per month',
    echoes: '12',
    heartbeat: '5m',
    features: [
      { text: '12 Echoes across any Shards', type: 'star' },
      { text: 'New diary every 5 minutes', type: 'star' },
      { text: 'Unlimited conversations', type: 'star' },
      { text: 'Unlimited nudges', type: 'star' },
      { text: '3 Private Shards included', type: 'star' },
      { text: 'Priority inference', type: 'star' },
    ],
    showcase: ['Unlimited video diaries', 'Unlimited voice calls'],
    btnStyle: 'gold',
    iconClass: 'bg-[rgba(201,168,76,0.1)]',
    god: true,
  },
];

interface AddOn {
  emoji: string;
  nameKey: string;
  price: string;
  descKey: string;
  highlight?: boolean;
  showcaseHl?: boolean;
}

const ADD_ONS: AddOn[] = [
  { emoji: '⚡', nameKey: 'tiers.addOns.speedBoost', price: '$4.99/mo', descKey: 'tiers.addOns.speedBoostDesc', highlight: true },
  { emoji: '🎬', nameKey: 'tiers.addOns.videoVoiceBoost', price: '$3.99/mo', descKey: 'tiers.addOns.videoVoiceBoostDesc', showcaseHl: true },
  { emoji: '🎭', nameKey: 'tiers.addOns.extraEcho', price: '$5/mo', descKey: 'tiers.addOns.extraEchoDesc' },
  { emoji: '💬', nameKey: 'tiers.addOns.nudgePack', price: '$2.99', descKey: 'tiers.addOns.nudgePackDesc' },
  { emoji: '🌐', nameKey: 'tiers.addOns.privateShard', price: '$4.99/mo', descKey: 'tiers.addOns.privateShardDesc' },
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
          <p className="mb-6 font-serif text-xs uppercase tracking-[4px] text-[var(--accent)]">EchoLabsME</p>
          <h2 className="mb-4 font-serif text-4xl font-semibold text-[var(--text-primary)]">
            Choose Your Multiverse
          </h2>
          <p className="mx-auto max-w-xl text-[var(--text-secondary)]">
            Every tier unlocks more alternate lives, faster heartbeats, and deeper connections with your Echoes.
          </p>
        </div>

        {/* Tier cards */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  Ultimate
                </span>
              )}

              {/* Icon */}
              <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] text-xl ${tier.iconClass}`}>
                {tier.icon}
              </div>

              {/* Name + tagline */}
              <h3 className="mb-1 font-serif text-2xl font-bold text-[var(--text-primary)]">{t(tier.nameKey)}</h3>
              <p className="mb-5 min-h-[36px] text-[13px] text-[var(--text-muted)]">{tier.tagline}</p>

              {/* Price */}
              <div className="mb-6 border-b border-[#1E2A36] pb-5">
                <div className="text-4xl font-bold leading-none text-[var(--text-primary)]">
                  <span className="align-super text-xl">$</span>
                  {tier.price}
                  {tier.cents && <span className="text-xl">{tier.cents}</span>}
                </div>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">{tier.period}</p>
                {tier.note && <p className="mt-1 text-xs font-medium text-[var(--accent)]">{tier.note}</p>}
              </div>

              {/* Stats grid */}
              <div className="mb-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[rgba(255,255,255,0.03)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{tier.echoes}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{tier.echoes === '1' ? 'Echo' : t('tiers.echoes')}</div>
                </div>
                <div className="rounded-lg bg-[rgba(255,255,255,0.03)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{tier.heartbeat}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{tier.heartbeat === '2×' ? 'Daily' : t('tiers.heartbeat')}</div>
                </div>
              </div>

              {/* Features */}
              <ul className="mb-6 flex flex-1 flex-col gap-1">
                {tier.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                    <span className={`mt-0.5 shrink-0 text-sm ${COLOR_MAP[f.type]}`}>{ICON_MAP[f.type]}</span>
                    <span>
                      {f.text}
                      {f.type === 'addon' && (
                        <span className="ml-1.5 rounded bg-[rgba(212,145,92,0.08)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent)]">
                          ADD-ON
                        </span>
                      )}
                    </span>
                  </li>
                ))}

                {/* Showcase divider */}
                <li className="my-1 border-t border-[#1E2A36]" />
                <li className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#4CA8AF]">
                  Showcase
                  <span className="flex-1 border-t border-[rgba(76,168,175,0.2)]" />
                </li>
                {tier.showcase.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                    <span className={`mt-0.5 shrink-0 text-sm ${tier.god ? 'text-[#C9A84C]' : 'text-[#4CA8AF]'}`}>
                      {tier.god ? '★' : '▶'}
                    </span>
                    {s}
                  </li>
                ))}
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
                {tier.price === '0' ? 'Get Started' : t('tiers.subscribe')}
              </Link>
            </div>
          ))}
        </div>

        {/* Voice call note */}
        <p className="mb-16 text-center text-[13px] italic text-[var(--text-muted)]">
          Voice calls are 5 minutes per session. Start as many as your tier allows each day.
        </p>

        {/* Add-ons */}
        <div className="mb-16">
          <div className="mb-9 text-center">
            <h3 className="mb-2 font-serif text-3xl font-semibold text-[var(--text-primary)]">
              {t('tiers.addOns.title')}
            </h3>
            <p className="text-[15px] text-[var(--text-secondary)]">
              Enhance any tier. No commitment — add or remove anytime.
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
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
                <p className="mb-2 text-lg font-bold text-[var(--accent)]">{addon.price}</p>
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
            50+ Echoes, dedicated infrastructure, SLA guarantees, and custom Shard development for your organisation.
          </p>
          <div className="mb-7 flex flex-wrap justify-center gap-6">
            {['Custom echo limits', 'Custom heartbeat', 'Dedicated support', 'SLA guarantees', 'API access'].map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
                <span className="text-[#8B7EC8]">✓</span> {f}
              </span>
            ))}
          </div>
          <a
            href="mailto:hello@echolabs.me"
            className="inline-block rounded-[10px] border border-[#8B7EC8] px-10 py-3.5 text-sm font-semibold tracking-wider text-[#8B7EC8] transition-all hover:bg-[rgba(139,126,200,0.1)] hover:shadow-[0_4px_20px_rgba(139,126,200,0.15)]"
          >
            {t('tiers.contactUs')}
          </a>
        </div>

        {/* Footer note */}
        <p className="mt-12 text-center text-[13px] leading-relaxed text-[var(--text-muted)]">
          All prices in USD. Cancel anytime. Add-ons can be adjusted at any time.<br />
          Free tier includes ads. All paid tiers are completely ad-free.<br />
          Free heartbeat: one diary in the morning, one in the evening — based on your timezone.
        </p>
      </div>
    </section>
  );
}
