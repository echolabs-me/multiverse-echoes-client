import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const WAITLIST_API = 'https://api.echolabs.me';

export function AboutPage() {
  const { t } = useTranslation();
  // Same source of truth as /waitlist — D1 via the me-waitlist Worker.
  // Otherwise this number drifts from the one shown on /waitlist and
  // visitors notice the inconsistency.
  const [waitlistTotal, setWaitlistTotal] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${WAITLIST_API}/waitlist/count`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { total?: number }) => {
        if (!cancelled && typeof data.total === 'number') {
          setWaitlistTotal(data.total);
        }
      })
      .catch(() => {
        // Silent — page renders with a placeholder if D1 is unreachable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>{t('website.about.title')}</title>
        <meta name="description" content={t('website.about.metaDesc')} />
        <meta property="og:title" content={t('website.about.title')} />
        <meta property="og:description" content={t('website.about.metaDesc')} />
        <meta property="og:image" content="https://echolabsme.com/og-image-v2.png" />
        {/* og:url is emitted path-aware by WebsiteLayout. */}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@EchoLabsME" />
      </Helmet>

      <div className="px-4 pbs-28 pbe-16 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <h1 className="mbe-8 font-serif text-4xl font-light tracking-wider text-(--text-primary)">
            {t('website.nav.about')}
          </h1>

          <section className="mbe-12">
            <h2 className="mbe-4 text-xl font-medium text-(--text-primary)">{t('website.about.originTitle')}</h2>
            <p className="mbe-4 leading-relaxed text-(--text-secondary)">
              {t('website.about.originP1')}
            </p>
            <p className="mbe-4 leading-relaxed text-(--text-secondary)">
              {t('website.about.originP2')}
            </p>
          </section>

          <section className="mbe-12">
            <h2 className="mbe-4 text-xl font-medium text-(--text-primary)">{t('website.about.buildTitle')}</h2>
            <p className="mbe-4 leading-relaxed text-(--text-secondary)">
              {t('website.about.buildP1')}
            </p>
            <p className="mbe-4 leading-relaxed text-(--text-secondary)">
              {t('website.about.buildP2')}
            </p>
          </section>

          <section className="mbe-12">
            <h2 className="mbe-4 text-xl font-medium text-(--text-primary)">{t('website.about.stackTitle')}</h2>
            <div className="rounded-xl border border-(--border) bg-(--surface) p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mbe-2 text-sm font-semibold text-(--accent)">{t('website.about.stackEngine')}</h3>
                  <ul className="space-y-1 text-sm text-(--text-secondary)">
                    <li>{t('website.about.stackEngine1')}</li>
                    <li>{t('website.about.stackEngine2')}</li>
                    <li>{t('website.about.stackEngine3')}</li>
                    <li>{t('website.about.stackEngine4')}</li>
                    <li>{t('website.about.stackEngine5')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="mbe-2 text-sm font-semibold text-(--accent)">{t('website.about.stackClient')}</h3>
                  <ul className="space-y-1 text-sm text-(--text-secondary)">
                    <li>{t('website.about.stackClient1')}</li>
                    <li>{t('website.about.stackClient2')}</li>
                    <li>{t('website.about.stackClient3')}</li>
                    <li>{t('website.about.stackClient4')}</li>
                    <li>{t('website.about.stackClient5')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mbe-12">
            <h2 className="mbe-4 text-xl font-medium text-(--text-primary)">{t('website.about.visionTitle')}</h2>
            <p className="mbe-4 leading-relaxed text-(--text-secondary)">
              {t('website.about.visionP1')}
            </p>
            <p className="mbe-4 leading-relaxed text-(--text-secondary)">
              {t('website.about.visionP2')}
            </p>
          </section>

          <section className="mbe-12">
            <h2 className="mbe-4 text-xl font-medium text-(--text-primary)">{t('website.about.numbersTitle')}</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="text-center">
                <p className="text-3xl font-light text-(--accent)">95,000</p>
                <p className="mbs-1 text-sm text-(--text-muted)">{t('website.about.numbersCode')}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-light text-(--accent)">
                  {waitlistTotal !== null ? waitlistTotal.toLocaleString() : '—'}
                </p>
                <p className="mbs-1 text-sm text-(--text-muted)">{t('website.about.numbersWaitlist')}</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="mbs-16 text-center">
            <Link
              to="/register"
              className="inline-block rounded-md bg-(--accent) px-8 py-3 text-base font-semibold text-(--canvas) transition-all hover:bg-(--accent-hover) hover:shadow-[0_0_30px_rgba(212,145,92,0.2)]"
            >
              {t('website.hero.cta')}
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
