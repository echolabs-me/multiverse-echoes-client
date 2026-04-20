/**
 * Cloudflare Pages Function — middleware for legacy locale query strings.
 *
 * Historical URLs used a `?lng=xx` query parameter to signal the preferred
 * locale (e.g., `https://echolabsme.com/home?lng=es`). The site has since
 * moved to path-based locale prefixes (`https://echolabsme.com/es/home`) so
 * that Google sees a single canonical URL per (locale, route) pair and no
 * longer parks them as "Duplicate without user-selected canonical."
 *
 * This middleware issues a 301 redirect from every legacy `?lng=xx` URL to
 * its canonical locale-prefixed equivalent, transferring link equity
 * immediately instead of waiting weeks for Google's canonical consolidation
 * to catch up. It runs at the CF edge on every request.
 *
 * Behaviour:
 *   - `/home?lng=es`           → 301 → `/es/home`
 *   - `/plans?lng=zh-Hant`     → 301 → `/zh-Hant/plans`
 *   - `/about?lng=en`          → 301 → `/about`  (English stays unprefixed)
 *   - `/?lng=ja`               → 301 → `/ja/home` (bypasses flag picker)
 *   - `/?lng=en`               → 301 → `/home`
 *   - Other query params (e.g. `?lng=es&ref=twitter`) are preserved.
 *   - Unknown locale values   → pass through (no redirect, let React Router
 *                                decide; usually renders as flag page).
 *   - Non-public paths         → pass through (no app/auth pages are
 *                                indexable so ?lng= on them has no SEO
 *                                consequence worth redirecting for).
 */

const SUPPORTED_LOCALES: ReadonlySet<string> = new Set([
  'en',
  'zh-Hans',
  'zh-Hant',
  'hi',
  'es',
  'ar',
  'fr',
  'bn',
  'pt-BR',
  'ru',
  'ur',
  'id',
  'de',
  'ja',
  'vi',
  'tr',
  'ko',
  'tl',
  'it',
  'th',
  'ms',
]);

const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  '/home',
  '/about',
  '/plans',
  '/waitlist',
  '/contact',
  '/terms',
  '/privacy',
  '/accessibility',
  // `/` (flag picker) is handled specially below so `?lng=xx` on root
  // redirects the user directly into their chosen locale's home page.
]);

// Pages Functions runtime type. Declared inline so we don't need an extra
// @cloudflare/workers-types dep just for this file.
interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
}

export const onRequest = async ({ request, next }: PagesContext): Promise<Response> => {
  const url = new URL(request.url);
  const lng = url.searchParams.get('lng');

  if (!lng || !SUPPORTED_LOCALES.has(lng)) {
    return next();
  }

  const isRoot = url.pathname === '/';
  if (!isRoot && !PUBLIC_ROUTES.has(url.pathname)) {
    return next();
  }

  // Preserve other query params and the hash; only strip the `lng` param
  // since it's now encoded in the pathname.
  url.searchParams.delete('lng');

  // Root redirects bypass the flag picker — the user already told us their
  // locale via the legacy query string, no need to ask again.
  const basePath = isRoot ? '/home' : url.pathname;
  const newPath = lng === 'en' ? basePath : `/${lng}${basePath}`;

  const target = new URL(newPath, url.origin);
  const remaining = url.searchParams.toString();
  if (remaining) target.search = remaining;
  target.hash = url.hash;

  return Response.redirect(target.toString(), 301);
};
