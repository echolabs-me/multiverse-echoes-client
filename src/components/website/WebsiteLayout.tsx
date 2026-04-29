import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { WebsiteNav } from './WebsiteNav.tsx';
import { WebsiteFooter } from './WebsiteFooter.tsx';
import { HreflangTags } from './HreflangTags.tsx';
import { toCanonicalPath } from '../../lib/canonicalPath.ts';

const CANONICAL_BASE = 'https://echolabsme.com';

export function WebsiteLayout() {
  const { pathname, hash } = useLocation();
  const { t, i18n } = useTranslation();
  // Always emit the trailing-slash form regardless of which URL variant the
  // user hit. This keeps `<link rel="canonical">` and `<meta property="og:url">`
  // stable across `/foo`, `/foo/`, `/foo?x=1`, and `/foo#anchor` — CF Pages
  // 308s `/foo` to `/foo/` so the slash form is the only stable canonical.
  // `useLocation().pathname` already strips query/hash, so we only need to
  // normalize the trailing slash here.
  const canonicalUrl = `${CANONICAL_BASE}${toCanonicalPath(pathname)}`;

  // Scroll to hash on navigation, or to top on route change
  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      // Small delay to allow DOM to render
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col bg-(--canvas)">
      <Helmet>
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'EchoLabsME',
            url: 'https://echolabsme.com',
            logo: 'https://echolabsme.com/logo.png',
            // Localised description + inLanguage so the JSON-LD on /es/home
            // advertises Spanish, /ja/home advertises Japanese, etc. Reuses
            // the already-translated website.hero.subheadline key instead of
            // adding a new SEO-description key across 20 locales.
            description: t('website.hero.subheadline'),
            inLanguage: i18n.language,
            sameAs: [
              'https://x.com/EchoLabsME',
              'https://discord.gg/dRcB4QxUmJ',
            ],
          })}
        </script>
      </Helmet>
      <HreflangTags />
      <WebsiteNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <WebsiteFooter />
    </div>
  );
}
