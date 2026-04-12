import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>About EchoLabsME — The Founder Story</title>
        <meta name="description" content="Built by a 56-year-old non-technical founder. 95,000 lines of code. The story of Multiverse Echoes." />
        <meta property="og:title" content="About EchoLabsME — The Founder Story" />
        <meta property="og:description" content="Built by a 56-year-old non-technical founder. 95,000 lines of code. The story of Multiverse Echoes." />
        <meta property="og:image" content="https://echolabsme.com/og-image.png" />
        <meta property="og:url" content="https://echolabsme.com/about" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@EchoLabsME" />
      </Helmet>

      <div className="px-4 pt-28 pb-16 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <h1 className="mb-8 font-serif text-4xl font-light tracking-wider text-[var(--text-primary)]">
            {t('website.nav.about')}
          </h1>

          <section className="mb-12">
            <h2 className="mb-4 text-xl font-medium text-[var(--text-primary)]">The Origin</h2>
            <p className="mb-4 leading-relaxed text-[var(--text-secondary)]">
              In February 2026, a 56-year-old strategy consultant who had never written a line of code sat down
              with Claude and asked: &ldquo;What if you could create an AI version of yourself, drop it into a
              completely different life, and just... watch what happens?&rdquo;
            </p>
            <p className="mb-4 leading-relaxed text-[var(--text-secondary)]">
              That question became Multiverse Echoes — an Autonomous Life Simulation Platform where AI Echoes
              of real people live independent lives in themed parallel worlds, writing diaries, forming
              relationships, and making decisions their creators never predicted.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-xl font-medium text-[var(--text-primary)]">The Build</h2>
            <p className="mb-4 leading-relaxed text-[var(--text-secondary)]">
              The entire platform — 95,000 lines of Rust and TypeScript — was built in partnership with
              Claude AI. Every line of code, every architectural decision, every deployment script.
            </p>
            <p className="mb-4 leading-relaxed text-[var(--text-secondary)]">
              The engine runs on a single NVIDIA B200 GPU. It processes 500 autonomous Echo lives every
              9 minutes — each with diary entries, AI-generated cinematic images, voice synthesis, and
              lip-synced video narration. All in 20 languages.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-xl font-medium text-[var(--text-primary)]">The Stack</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--accent)]">Engine</h3>
                  <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                    <li>Rust (ECS architecture)</li>
                    <li>Gemma 4 31B (local LLM)</li>
                    <li>FLUX.2 Klein (image gen)</li>
                    <li>VoxCPM2 (voice synthesis)</li>
                    <li>MuseTalk + LivePortrait (video)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--accent)]">Client</h3>
                  <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                    <li>React 19 + TypeScript 6</li>
                    <li>Tailwind CSS v4</li>
                    <li>20-language i18n</li>
                    <li>Real-time WebSocket feeds</li>
                    <li>NLLB-200 translation sidecar</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-xl font-medium text-[var(--text-primary)]">The Vision</h2>
            <p className="mb-4 leading-relaxed text-[var(--text-secondary)]">
              Multiverse Echoes isn&rsquo;t a game, a virtual world, or a social network. It&rsquo;s a mirror
              — one that shows you the lives you might have lived. Your Echoes make their own choices. They
              surprise you. They make you think about the roads not taken.
            </p>
            <p className="mb-4 leading-relaxed text-[var(--text-secondary)]">
              Three worlds are live: Cyber-Tokyo 2045, Nomad Australia, and Renaissance Florence 1490. Each
              is a complete simulation with its own culture, economy, and social dynamics. Your Echo
              doesn&rsquo;t just exist in these worlds — it lives in them.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-xl font-medium text-[var(--text-primary)]">The Numbers</h2>
            {/* TODO: Replace waitlist count with live user count or remove post-launch */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="text-center">
                <p className="text-3xl font-light text-[var(--accent)]">95,000</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">lines of code</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-light text-[var(--accent)]">379</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">waitlist signups</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="mt-16 text-center">
            <Link
              to="/register"
              className="inline-block rounded-md bg-[var(--accent)] px-8 py-3 text-base font-semibold text-[var(--canvas)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[0_0_30px_rgba(212,145,92,0.2)]"
            >
              {t('website.hero.cta')}
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
