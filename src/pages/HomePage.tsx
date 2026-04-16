import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { PricingSection } from '../components/website/PricingSection.tsx';
import { useAuthStore } from '../stores/useAuthStore.ts';

const WAITLIST_API = 'https://api.echolabs.me';

async function fetchWaitlistCount(): Promise<{ total: number }> {
  const res = await fetch(`${WAITLIST_API}/waitlist/count`, { method: 'GET' });
  if (!res.ok) throw new Error(`count failed: ${res.status}`);
  return (await res.json()) as { total: number };
}

function SectionDivider() {
  return <div className="mx-auto my-0 h-px w-16 bg-[rgba(212,145,92,0.15)]" />;
}

export function HomePage() {
  const { t } = useTranslation();
  // Read auth state once at render — don't subscribe to changes so backend
  // failures can't trigger re-renders that break scroll animations.
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  const ctaTo = isAuthenticated ? '/dashboard' : '/register';
  
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWaitlistCount()
      .then((r) => {
        if (!cancelled) setWaitlistCount(r.total);
      })
      .catch(() => {
        // Silent on failure, page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll-triggered reveal via IntersectionObserver.
  // Uses requestAnimationFrame to ensure DOM is painted before observing.
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('.section-reveal').forEach((el) => el.classList.add('revealed'));
      return;
    }
    let obs: IntersectionObserver | null = null;
    const raf = requestAnimationFrame(() => {
      const els = document.querySelectorAll('.section-reveal');
      obs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('revealed');
              obs?.unobserve(e.target);
            }
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
      );
      els.forEach((el) => obs!.observe(el));
    });
    return () => {
      cancelAnimationFrame(raf);
      obs?.disconnect();
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>{t('website.home.metaTitle')}</title>
        <meta name="description" content={t('website.home.metaDesc')} />
        <meta property="og:title" content={t('website.home.ogTitle')} />
        <meta property="og:description" content={t('website.home.ogDesc')} />
        <meta property="og:image" content="https://echolabsme.com/og-image-v2.png" />
        <meta property="og:url" content="https://echolabsme.com/home" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@EchoLabsME" />
        <meta name="twitter:image" content="https://echolabsme.com/og-image-v2.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Multiverse Echoes',
            description: 'AI-powered life simulation platform where autonomous digital selves live, write diaries, and experience life events in parallel worlds.',
            url: 'https://echolabsme.com',
            applicationCategory: 'Simulation',
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

      {/* ═══ Section 1: Hero ═══ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16">
        {/* Full-bleed background image */}
        <div className="me-hero-bg absolute inset-0 bg-cover bg-center bg-no-repeat" />
        {/* Dark overlay + blur for text readability */}
        <div className="absolute inset-0 bg-[#0A0F14]/80 backdrop-blur-sm" />
        {/* Radial glow */}
        <div className="me-hero-glow pointer-events-none absolute left-1/2 top-[40%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

        <div className="section-reveal relative z-10 mx-auto max-w-2xl px-6 text-center">
          <img
            src="/logo.png"
            alt="Multiverse Echoes"
            className="me-fade-up mx-auto mb-8 h-24 w-24 rounded-2xl object-contain"
          />
          <h1
            className="me-fade-up mb-5 font-serif text-4xl font-light tracking-[0.12em] text-[#E8E0D8] sm:text-5xl lg:text-6xl"
            data-delay="150"
          >
            {t('website.hero.headline')}
          </h1>
          <p
            className="me-fade-up mx-auto mb-10 max-w-lg text-lg font-light italic leading-relaxed text-[var(--accent)]"
            data-delay="300"
          >
            {t('website.hero.subheadline')}
          </p>
          <div className="me-fade-up" data-delay="450">
            <Link
              to={ctaTo}
              className="me-btn-primary inline-block rounded-md px-10 py-3.5 text-base font-semibold"
            >
              {t('website.hero.cta')}
            </Link>
          </div>
          <div className="me-fade-up mt-6" data-delay="600">
            <a
              href="https://x.com/EchoLabsME"
              target="_blank"
              rel="noopener noreferrer"
              className="me-x-link inline-flex items-center gap-2 rounded-md border border-[var(--text-muted)] px-5 py-2 text-sm tracking-wider text-[var(--text-primary)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-[0_0_20px_rgba(212,145,92,0.08)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              {t('website.home.followJourney')}
            </a>
          </div>
        </div>

        <div
          className="me-fade-up absolute bottom-8 flex flex-col items-center gap-1"
          data-delay="900"
        >
          <p className="text-xs tracking-[0.2em] text-[var(--text-muted)]">
            {t('website.home.scrollExplore')}
          </p>
          <svg className="h-4 w-4 animate-bounce text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 2: How It Works ═══ */}
      <section className="section-reveal px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-16 text-center font-serif text-3xl font-light tracking-[0.08em] text-[var(--text-primary)]">
            {t('website.howItWorks.title')}
          </h2>
          <div className="flex flex-col gap-10">
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n} className="section-reveal flex gap-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] font-serif text-base text-[var(--accent)]">
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

      {/* ═══ Section 3: Features Showcase ═══ */}
      <section id="features" className="section-reveal px-6 pb-24 pt-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center font-serif text-3xl font-light tracking-[0.08em] text-[var(--text-primary)]">
            {t('website.features.title')}
          </h2>

          {/* Feature 1: Autonomous diary — image left */}
          <div className="section-reveal mb-20 flex flex-col items-center gap-10 md:flex-row">
            <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] shadow-lg md:w-1/2">
              <img
                src="/screenshots/Echo_DIary_with_Avatar.jpeg"
                alt="Echo diary with AI portrait"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="w-full md:w-1/2">
              <h3 className="mb-2 text-xl font-medium text-[var(--text-primary)]">
                {t('website.features.diaryTitle')}
              </h3>
              <p className="leading-relaxed text-[var(--text-secondary)]">
                {t('website.features.diaryDesc')}
              </p>
            </div>
          </div>

          {/* Feature 2: AI images — image right */}
          <div className="section-reveal mb-20 flex flex-col-reverse items-center gap-10 md:flex-row">
            <div className="w-full md:w-1/2">
              <h3 className="mb-2 text-xl font-medium text-[var(--text-primary)]">
                {t('website.features.imagesTitle')}
              </h3>
              <p className="leading-relaxed text-[var(--text-secondary)]">
                {t('website.features.imagesDesc')}
              </p>
            </div>
            <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] shadow-lg md:w-1/2">
              <img
                src="/screenshots/App_Page_Full_Capture.jpeg"
                alt="AI-generated diary scene"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Feature 3: Nudge — image left */}
          <div className="section-reveal mb-20 flex flex-col items-center gap-10 md:flex-row">
            <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] shadow-lg md:w-1/2">
              <img
                src="/screenshots/Nudge_Echo.jpeg"
                alt="Nudge your Echo"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="w-full md:w-1/2">
              <h3 className="mb-2 text-xl font-medium text-[var(--text-primary)]">
                {t('website.features.voiceTitle')}
              </h3>
              <p className="leading-relaxed text-[var(--text-secondary)]">
                {t('website.features.voiceDesc')}
              </p>
            </div>
          </div>

          {/* Remaining features in a grid */}
          <div className="section-reveal grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-3 text-2xl">🎥</div>
              <h3 className="mb-1 font-medium text-[var(--text-primary)]">{t('website.features.videoTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{t('website.features.videoDesc')}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-3 text-2xl">🌐</div>
              <h3 className="mb-1 font-medium text-[var(--text-primary)]">{t('website.features.languagesTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{t('website.features.languagesDesc')}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-3 text-2xl">💞</div>
              <h3 className="mb-1 font-medium text-[var(--text-primary)]">{t('website.features.relationshipsTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{t('website.features.relationshipsDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 4: Worlds ═══ */}
      <section className="section-reveal px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center font-serif text-3xl font-light tracking-[0.08em] text-[var(--text-primary)]">
            {t('website.worlds.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Cyber-Tokyo */}
            <div className="section-reveal group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="me-shard-bg-tokyo h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-transparent via-transparent to-[var(--surface)]" />
              <div className="relative p-6 pt-0">
                <h3 className="mb-2 font-serif text-xl font-semibold text-[#00d4ff]">
                  {t('website.worlds.tokyoName')}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {t('website.worlds.tokyoDesc')}
                </p>
              </div>
            </div>

            {/* Nomad Australia */}
            <div className="section-reveal group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="me-shard-bg-australia h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-transparent via-transparent to-[var(--surface)]" />
              <div className="relative p-6 pt-0">
                <h3 className="mb-2 font-serif text-xl font-semibold text-[#c4783c]">
                  {t('website.worlds.australiaName')}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {t('website.worlds.australiaDesc')}
                </p>
              </div>
            </div>

            {/* Renaissance Florence */}
            <div className="section-reveal group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="me-shard-bg-florence h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-transparent via-transparent to-[var(--surface)]" />
              <div className="relative p-6 pt-0">
                <h3 className="mb-2 font-serif text-xl font-semibold text-[#8b6f47]">
                  {t('website.worlds.florenceName')}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {t('website.worlds.florenceDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 5: Social Proof ═══ */}
      <section className="section-reveal px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <p className="mb-6 font-serif text-5xl font-light italic text-[var(--accent)]">
            {t('website.home.socialProofQuote')}
          </p>
          <SectionDivider />
          <div className="mt-12 flex flex-col items-center gap-2">
            <p className="text-4xl font-light text-[var(--text-primary)]">
              {waitlistCount !== null ? waitlistCount.toLocaleString() : '—'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {waitlistCount !== null 
                ? t('website.social.waitlistCount', { count: waitlistCount.toLocaleString() })
                : t('website.social.waitlistCount', { count: 'Many' })}
            </p>
            <p className="mt-4 text-xs italic text-[var(--text-muted)]">{t('website.social.builtBy')}</p>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 6: Pricing ═══ */}
      <PricingSection />

      <SectionDivider />

      {/* ═══ Section 7: The Founder (brief) ═══ */}
      <section className="section-reveal px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <p className="mb-8 font-serif text-xl font-light italic leading-relaxed text-[var(--accent)]">
            {t('website.founder.brief')}
          </p>
          <Link
            to="/about"
            className="text-sm tracking-wider text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
          >
            {t('website.founder.readMore')} →
          </Link>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 8: Final CTA ═══ */}
      <section className="section-reveal relative overflow-hidden px-6 py-32">
        {/* Background glow */}
        <div className="me-radial-glow-ambient pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="relative z-10 mx-auto max-w-lg text-center">
          <h2 className="mb-8 font-serif text-4xl font-light tracking-[0.08em] text-[var(--text-primary)]">
            {t('website.finalCta.headline')}
          </h2>
          <Link
            to={ctaTo}
            className="me-btn-primary inline-block rounded-md px-10 py-4 text-base font-semibold"
          >
            {t('website.finalCta.cta')}
          </Link>
          <p className="mt-6 text-sm text-[var(--text-muted)]">{t('website.finalCta.noCreditCard')}</p>
        </div>
      </section>

    </>
  );
}
