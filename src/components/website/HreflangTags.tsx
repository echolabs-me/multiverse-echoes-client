import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import {
  SUPPORTED_LOCALES,
  LOCALE_PATH_PATTERN,
  type SupportedLocale,
} from '../../i18n.ts';

const BASE_URL = 'https://echolabsme.com';

/**
 * Maps our i18n locale codes to OpenGraph `og:locale` values (the format
 * `{lang}_{REGION}` per the OG spec). Social scrapers (FB, LinkedIn, WhatsApp,
 * iMessage, Discord, Twitter) read these to know which localized preview to
 * render for a shared URL.
 *
 * Regions are chosen to match our flag picks and CLDR defaults:
 *   - en_US, en_GB are both common; we use en_US as the widely-recognised default
 *   - zh_CN for Simplified (mainland), zh_HK for Traditional (Hong Kong flag)
 *   - pt_BR for Brazilian Portuguese (matches the locale code)
 *   - ar_SA for Arabic (KSA is the most widely-indexed region for ar)
 */
const OG_LOCALE: Record<SupportedLocale, string> = {
  en: 'en_US',
  'zh-Hans': 'zh_CN',
  'zh-Hant': 'zh_HK',
  hi: 'hi_IN',
  es: 'es_ES',
  ar: 'ar_SA',
  fr: 'fr_FR',
  bn: 'bn_BD',
  'pt-BR': 'pt_BR',
  ru: 'ru_RU',
  ur: 'ur_PK',
  id: 'id_ID',
  de: 'de_DE',
  ja: 'ja_JP',
  vi: 'vi_VN',
  tr: 'tr_TR',
  ko: 'ko_KR',
  tl: 'tl_PH',
  it: 'it_IT',
  th: 'th_TH',
  ms: 'ms_MY',
};

/**
 * Split a pathname into `{ base, locale }` by detecting a leading locale
 * segment. `/es/home` -> `{ base: '/home', locale: 'es' }`;
 * `/home` -> `{ base: '/home', locale: 'en' }` (English lives at the
 * unprefixed root).
 */
function splitLocale(
  pathname: string,
): { base: string; locale: SupportedLocale } {
  const match = pathname.match(LOCALE_PATH_PATTERN);
  if (match && (SUPPORTED_LOCALES as readonly string[]).includes(match[1])) {
    // `match[0]` is the full `/xx/` or `/xx` (if end-of-string).
    // Preserve the trailing-slash vs no-slash for the base remainder so we
    // round-trip `/es/home` -> `/home` and `/es/home/` -> `/home/` exactly.
    const consumed = match[0].endsWith('/')
      ? match[0].slice(0, -1).length
      : match[0].length;
    const base = pathname.slice(consumed) || '/';
    return { base, locale: match[1] as SupportedLocale };
  }
  return { base: pathname || '/', locale: 'en' };
}

/** Build the absolute URL for a (base, locale) pair. English has no prefix. */
function urlFor(base: string, locale: SupportedLocale): string {
  if (locale === 'en') return `${BASE_URL}${base}`;
  return `${BASE_URL}/${locale}${base}`;
}

/**
 * Emits hreflang alternates + og:locale + og:locale:alternate for the
 * current route. All URLs are path-based (not `?lng=xx` query strings),
 * matching the route structure in `App.tsx`.
 *
 * x-default always points at `/` (the flag picker), which is the
 * language-agnostic entry point for new visitors.
 *
 * Note: react-helmet-async handles multiple `<meta>` tags with the same
 * `property` attribute correctly (this was the motivating bug for the
 * async fork of react-helmet). og:locale:alternate may repeat.
 */
export function HreflangTags() {
  const { pathname } = useLocation();
  const { base, locale: current } = splitLocale(pathname);

  return (
    <Helmet>
      {/* Current page locale (one entry) + alternates (all others). */}
      <meta property="og:locale" content={OG_LOCALE[current]} />
      {SUPPORTED_LOCALES.filter((l) => l !== current).map((l) => (
        <meta
          key={`og-alt-${l}`}
          property="og:locale:alternate"
          content={OG_LOCALE[l]}
        />
      ))}

      {/* Path-based hreflang — one link per supported locale + x-default. */}
      {SUPPORTED_LOCALES.map((l) => (
        <link
          key={`hreflang-${l}`}
          rel="alternate"
          hrefLang={l}
          href={urlFor(base, l)}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}/`} />
    </Helmet>
  );
}
