import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { BookOpen, Image, Phone, Video, Globe, Users } from 'lucide-react';
import { PricingSection } from '../components/website/PricingSection.tsx';
import { useAuthStore } from '../stores/useAuthStore.ts';
import type { ReactNode } from 'react';

function SectionDivider() {
  return <div className="mx-auto h-px w-16 bg-[rgba(212,145,92,0.15)]" />;
}

interface FeatureCardProps {
  icon: ReactNode;
  titleKey: string;
  descKey: string;
}

function FeatureCard({ icon, titleKey, descKey }: FeatureCardProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-4">
      <div className="mt-1 shrink-0 text-[var(--accent)]">{icon}</div>
      <div>
        <h3 className="mb-1 text-lg font-medium text-[var(--text-primary)]">{t(titleKey)}</h3>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{t(descKey)}</p>
      </div>
    </div>
  );
}

const SHARD_COLORS = {
  tokyo: 'var(--accent-cyber-tokyo)',
  australia: 'var(--accent-nomad-australia)',
  florence: 'var(--accent-renaissance-florence)',
};

export function HomePage() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <>
      <Helmet>
        <title>{t('website.hero.headline')} | Multiverse Echoes</title>
        <meta name="description" content="Create an AI version of yourself that lives an autonomous life in a parallel world. Autonomous diary, AI images, voice calls, 20 languages." />
        <meta property="og:title" content="Multiverse Echoes — What if you'd taken a different path?" />
        <meta property="og:description" content="Create an AI version of yourself that lives an autonomous life in a parallel world. Autonomous diary, AI images, voice calls, 20 languages." />
        <meta property="og:image" content="https://echolabsme.com/og-image.png" />
        <meta property="og:url" content="https://echolabsme.com/home" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@EchoLabsME" />
        <meta name="twitter:image" content="https://echolabsme.com/og-image.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Multiverse Echoes',
            description: 'Autonomous AI Life Simulation Platform',
            url: 'https://echolabsme.com',
            applicationCategory: 'Entertainment',
            operatingSystem: 'Web',
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '0',
              highPrice: '59.99',
              priceCurrency: 'USD',
            },
            author: {
              '@type': 'Organization',
              name: 'EchoLabsME',
              url: 'https://echolabsme.com',
            },
          })}
        </script>
      </Helmet>

      {/* Section 1: Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-16 text-center">
        {/* Background glow */}
        <div
          className="pointer-events-none fixed left-1/2 top-[40%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(212,145,92,0.08) 0%, transparent 70%)',
            animation: 'me-hero-breathe 8s ease-in-out infinite',
          }}
        />

        <div className="relative z-10 mx-auto max-w-2xl" style={{ animation: 'me-fade-up 1.2s ease-out both' }}>
          <h1 className="mb-4 font-serif text-4xl font-light tracking-wider text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
            {t('website.hero.headline')}
          </h1>
          <p
            className="mx-auto mb-8 max-w-lg text-lg text-[var(--text-secondary)]"
            style={{ animation: 'me-fade-up 1.2s ease-out 0.15s both' }}
          >
            {t('website.hero.subheadline')}
          </p>
          <div style={{ animation: 'me-fade-up 1.2s ease-out 0.3s both' }}>
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-block rounded-md bg-[var(--accent)] px-8 py-3 text-base font-semibold text-[var(--canvas)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[0_0_30px_rgba(212,145,92,0.2)]"
            >
              {t('website.hero.cta')}
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <p
          className="absolute bottom-8 text-xs tracking-widest text-[var(--text-muted)]"
          style={{ animation: 'me-fade-up 1.2s ease-out 0.6s both' }}
        >
          ↓
        </p>
      </section>

      <SectionDivider />

      {/* Section 2: How It Works */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-16 text-center text-3xl font-light tracking-wider text-[var(--text-primary)]">
            {t('website.howItWorks.title')}
          </h2>
          <div className="grid gap-12 sm:grid-cols-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] text-sm font-medium text-[var(--accent)]">
                  {n}
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-medium text-[var(--text-primary)]">
                    {t(`website.howItWorks.step${n}Title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {t(`website.howItWorks.step${n}Desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Section 3: Features Showcase */}
      <section id="features" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-16 text-center text-3xl font-light tracking-wider text-[var(--text-primary)]">
            {t('website.features.title')}
          </h2>
          <div className="grid gap-10 sm:grid-cols-2">
            <FeatureCard icon={<BookOpen size={24} />} titleKey="website.features.diaryTitle" descKey="website.features.diaryDesc" />
            <FeatureCard icon={<Image size={24} />} titleKey="website.features.imagesTitle" descKey="website.features.imagesDesc" />
            <FeatureCard icon={<Phone size={24} />} titleKey="website.features.voiceTitle" descKey="website.features.voiceDesc" />
            <FeatureCard icon={<Video size={24} />} titleKey="website.features.videoTitle" descKey="website.features.videoDesc" />
            <FeatureCard icon={<Globe size={24} />} titleKey="website.features.languagesTitle" descKey="website.features.languagesDesc" />
            <FeatureCard icon={<Users size={24} />} titleKey="website.features.relationshipsTitle" descKey="website.features.relationshipsDesc" />
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Section 4: Worlds */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-16 text-center text-3xl font-light tracking-wider text-[var(--text-primary)]">
            {t('website.worlds.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {(['tokyo', 'australia', 'florence'] as const).map((shard) => (
              <div
                key={shard}
                className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:border-current"
                style={{ color: SHARD_COLORS[shard] }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10"
                  style={{ background: `radial-gradient(circle at 50% 0%, currentColor, transparent 70%)` }}
                />
                <h3 className="relative mb-2 text-lg font-semibold">{t(`website.worlds.${shard}Name`)}</h3>
                <p className="relative text-sm leading-relaxed text-[var(--text-secondary)]">
                  {t(`website.worlds.${shard}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Section 5: Social Proof */}
      <section className="px-4 py-24 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-4xl font-light text-[var(--accent)]">379</p>
          <p className="mb-8 text-lg text-[var(--text-secondary)]">{t('website.social.waitlistCount', { count: 379 })}</p>
          <p className="text-sm italic text-[var(--text-muted)]">{t('website.social.builtBy')}</p>
        </div>
      </section>

      <SectionDivider />

      {/* Section 6: Pricing */}
      <PricingSection />

      <SectionDivider />

      {/* Section 7: The Founder (brief) */}
      <section className="px-4 py-24 text-center sm:px-6">
        <div className="mx-auto max-w-xl">
          <p className="mb-6 text-lg font-light italic leading-relaxed text-[var(--accent)]">
            {t('website.founder.brief')}
          </p>
          <Link
            to="/about"
            className="text-sm font-medium text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
          >
            {t('website.founder.readMore')} →
          </Link>
        </div>
      </section>

      <SectionDivider />

      {/* Section 8: Final CTA */}
      <section className="px-4 py-24 text-center sm:px-6">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-6 text-3xl font-light tracking-wider text-[var(--text-primary)]">
            {t('website.finalCta.headline')}
          </h2>
          <Link
            to={isAuthenticated ? '/dashboard' : '/register'}
            className="mb-4 inline-block rounded-md bg-[var(--accent)] px-8 py-3.5 text-base font-semibold text-[var(--canvas)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[0_0_30px_rgba(212,145,92,0.2)]"
          >
            {t('website.finalCta.cta')}
          </Link>
          <p className="mt-4 text-sm text-[var(--text-muted)]">{t('website.finalCta.noCreditCard')}</p>
        </div>
      </section>

      {/* Keyframe animations */}
      <style>{`
        @keyframes me-hero-breathe {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes me-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
