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
  const { t, i18n } = useTranslation();
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
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      document
        .querySelectorAll('.section-reveal')
        .forEach((el) => el.classList.add('revealed'));
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
        <meta
          property="og:image"
          content="https://echolabsme.com/og-image-v2.png"
        />
        {/* og:url is emitted path-aware by WebsiteLayout so it matches the
            active locale's URL (/es/home, /ja/plans, …). Don't hardcode here. */}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@EchoLabsME" />
        <meta
          name="twitter:image"
          content="https://echolabsme.com/og-image-v2.png"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Multiverse Echoes',
            description: t('website.home.metaDesc'),
            inLanguage: i18n.language,
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
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pbs-16">
        {/* Full-bleed background image */}
        <div className="me-hero-bg absolute inset-0 bg-cover bg-center bg-no-repeat" />
        {/* Dark overlay + blur for text readability */}
        <div className="absolute inset-0 bg-[#0A0F14]/80 backdrop-blur-sm" />
        {/* Radial glow */}
        <div className="me-hero-glow pointer-events-none absolute inset-s-1/2 inset-bs-[40%] size-175 -translate-1/2 rounded-full" />

        <div className="section-reveal relative z-10 mx-auto max-w-2xl px-6 text-center">
          <img
            src="/logo.png"
            alt="Multiverse Echoes"
            className="me-fade-up mx-auto mbe-8 size-24 rounded-2xl object-contain"
          />
          <h1
            className="me-fade-up mbe-5 font-serif text-4xl font-light tracking-[0.12em] text-[#E8E0D8] sm:text-5xl lg:text-6xl"
            data-delay="150"
          >
            {t('website.hero.headline')}
          </h1>
          <p
            className="me-fade-up mx-auto mbe-10 max-w-lg text-lg/relaxed font-light text-(--accent) italic"
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
          <div className="me-fade-up mbs-6" data-delay="600">
            <a
              href="https://x.com/EchoLabsME"
              target="_blank"
              rel="noopener noreferrer"
              className="me-x-link inline-flex items-center gap-2 rounded-md border border-(--text-muted) px-5 py-2 text-sm tracking-wider text-(--text-primary) transition-all hover:border-(--accent) hover:text-(--accent) hover:shadow-[0_0_20px_rgba(212,145,92,0.08)]"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              {t('website.home.followJourney')}
            </a>
          </div>
        </div>

        <div
          className="me-fade-up absolute inset-be-8 flex flex-col items-center gap-1"
          data-delay="900"
        >
          <p className="text-xs tracking-[0.2em] text-(--text-muted)">
            {t('website.home.scrollExplore')}
          </p>
          <svg
            className="size-4 animate-bounce text-(--text-muted)"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 2: How It Works ═══ */}
      <section className="section-reveal px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mbe-16 text-center font-serif text-3xl font-light tracking-[0.08em] text-(--text-primary)">
            {t('website.howItWorks.title')}
          </h2>
          <div className="mx-auto flex max-w-xl flex-col gap-10">
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n} className="section-reveal flex gap-5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--accent) font-serif text-base leading-none text-(--accent)">
                  {n}
                </div>
                <div>
                  <h3 className="mbe-1 text-lg font-medium text-(--text-primary)">
                    {t(`website.howItWorks.step${n}Title`)}
                  </h3>
                  <p className="text-sm/relaxed text-(--text-secondary)">
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
      <section id="features" className="section-reveal px-6 pbs-28 pbe-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mbe-16 text-center font-serif text-3xl font-light tracking-[0.08em] text-(--text-primary)">
            {t('website.features.title')}
          </h2>

          {/* Feature 1: Autonomous diary — image left */}
          <div className="section-reveal mbe-20 flex flex-col items-center gap-10 md:flex-row">
            <div className="w-full overflow-hidden rounded-xl border border-(--border) shadow-lg md:w-1/2">
              <img
                src="/screenshots/Echo_DIary_with_Avatar.jpeg"
                alt="Echo diary with AI portrait"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="w-full md:w-1/2">
              <h3 className="mbe-2 text-xl font-medium text-(--text-primary)">
                {t('website.features.diaryTitle')}
              </h3>
              <p className="leading-relaxed text-(--text-secondary)">
                {t('website.features.diaryDesc')}
              </p>
            </div>
          </div>

          {/* Feature 2: AI images — image right */}
          <div className="section-reveal mbe-20 flex flex-col-reverse items-center gap-10 md:flex-row">
            <div className="w-full md:w-1/2">
              <h3 className="mbe-2 text-xl font-medium text-(--text-primary)">
                {t('website.features.imagesTitle')}
              </h3>
              <p className="leading-relaxed text-(--text-secondary)">
                {t('website.features.imagesDesc')}
              </p>
            </div>
            <div className="w-full overflow-hidden rounded-xl border border-(--border) shadow-lg md:w-1/2">
              <img
                src="/screenshots/App_Page_Full_Capture.jpeg"
                alt="AI-generated diary scene"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Feature 3: Nudge — image left */}
          <div className="section-reveal mbe-20 flex flex-col items-center gap-10 md:flex-row">
            <div className="w-full overflow-hidden rounded-xl border border-(--border) shadow-lg md:w-1/2">
              <img
                src="/screenshots/Nudge_Echo.jpeg"
                alt="Nudge your Echo"
                className="w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="w-full md:w-1/2">
              <h3 className="mbe-2 text-xl font-medium text-(--text-primary)">
                {t('website.features.voiceTitle')}
              </h3>
              <p className="leading-relaxed text-(--text-secondary)">
                {t('website.features.voiceDesc')}
              </p>
            </div>
          </div>

          {/* Remaining features in a grid */}
          <div className="section-reveal grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-(--border) bg-(--surface) p-6">
              <div className="mbe-3 text-2xl">🎥</div>
              <h3 className="mbe-1 font-medium text-(--text-primary)">
                {t('website.features.videoTitle')}
              </h3>
              <p className="text-sm text-(--text-secondary)">
                {t('website.features.videoDesc')}
              </p>
            </div>
            <div className="rounded-xl border border-(--border) bg-(--surface) p-6">
              <div className="mbe-3 text-2xl">🌐</div>
              <h3 className="mbe-1 font-medium text-(--text-primary)">
                {t('website.features.languagesTitle')}
              </h3>
              <p className="text-sm text-(--text-secondary)">
                {t('website.features.languagesDesc')}
              </p>
            </div>
            <div className="rounded-xl border border-(--border) bg-(--surface) p-6">
              <div className="mbe-3 text-2xl">💞</div>
              <h3 className="mbe-1 font-medium text-(--text-primary)">
                {t('website.features.relationshipsTitle')}
              </h3>
              <p className="text-sm text-(--text-secondary)">
                {t('website.features.relationshipsDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 4: Worlds ═══ */}
      <section className="section-reveal px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mbe-16 text-center font-serif text-3xl font-light tracking-[0.08em] text-(--text-primary)">
            {t('website.worlds.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Cyber-Tokyo */}
            <div className="section-reveal group relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
              <div className="me-shard-bg-tokyo h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 inset-bs-0 h-48 bg-linear-to-b from-transparent via-transparent to-(--surface)" />
              <div className="relative p-6 pbs-0">
                <h3 className="mbe-2 font-serif text-xl font-semibold text-[#00d4ff]">
                  {t('website.worlds.tokyoName')}
                </h3>
                <p className="text-sm/relaxed text-(--text-secondary)">
                  {t('website.worlds.tokyoDesc')}
                </p>
              </div>
            </div>

            {/* Nomad Australia */}
            <div className="section-reveal group relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
              <div className="me-shard-bg-australia h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 inset-bs-0 h-48 bg-linear-to-b from-transparent via-transparent to-(--surface)" />
              <div className="relative p-6 pbs-0">
                <h3 className="mbe-2 font-serif text-xl font-semibold text-[#c4783c]">
                  {t('website.worlds.australiaName')}
                </h3>
                <p className="text-sm/relaxed text-(--text-secondary)">
                  {t('website.worlds.australiaDesc')}
                </p>
              </div>
            </div>

            {/* Renaissance Florence */}
            <div className="section-reveal group relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
              <div className="me-shard-bg-florence h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 inset-bs-0 h-48 bg-linear-to-b from-transparent via-transparent to-(--surface)" />
              <div className="relative p-6 pbs-0">
                <h3 className="mbe-2 font-serif text-xl font-semibold text-[#8b6f47]">
                  {t('website.worlds.florenceName')}
                </h3>
                <p className="text-sm/relaxed text-(--text-secondary)">
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
          <p className="mbe-6 font-serif text-5xl font-light text-(--accent) italic">
            {t('website.home.socialProofQuote')}
          </p>
          <SectionDivider />
          <div className="mbs-12 flex flex-col items-center gap-2">
            <p className="text-4xl font-light text-(--text-primary)">
              {waitlistCount !== null ? waitlistCount.toLocaleString() : '—'}
            </p>
            <p className="text-sm text-(--text-secondary)">
              {waitlistCount !== null
                ? t('website.social.waitlistCount', {
                    count: waitlistCount.toLocaleString(),
                  })
                : t('website.social.waitlistCount', { count: 'Many' })}
            </p>
            <p className="mbs-4 text-xs text-(--text-muted) italic">
              {t('website.social.builtBy')}
            </p>
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
          <p className="mbe-8 font-serif text-xl/relaxed font-light text-(--accent) italic">
            {t('website.founder.brief')}
          </p>
          <Link
            to="/about"
            className="text-sm tracking-wider text-(--text-secondary) underline decoration-(--border) underline-offset-4 transition-colors hover:text-(--accent) hover:decoration-(--accent)"
          >
            {t('website.founder.readMore')} →
          </Link>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ Section 8: Final CTA ═══ */}
      <section className="section-reveal relative overflow-hidden px-6 py-32">
        {/* Background glow */}
        <div className="me-radial-glow-ambient pointer-events-none absolute inset-s-1/2 inset-bs-1/2 size-125 -translate-1/2 rounded-full" />
        <div className="relative z-10 mx-auto max-w-lg text-center">
          <h2 className="mbe-8 font-serif text-4xl font-light tracking-[0.08em] text-(--text-primary)">
            {t('website.finalCta.headline')}
          </h2>
          <Link
            to={ctaTo}
            className="me-btn-primary inline-block rounded-md px-10 py-4 text-base font-semibold"
          >
            {t('website.finalCta.cta')}
          </Link>
          <p className="mbs-6 text-sm text-(--text-muted)">
            {t('website.finalCta.noCreditCard')}
          </p>
        </div>
      </section>
    </>
  );
}
