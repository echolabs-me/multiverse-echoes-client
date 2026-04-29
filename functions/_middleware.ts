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

  // Normalize the incoming pathname BEFORE the PUBLIC_ROUTES check.
  // After the trailing-slash-canonical migration, legitimate visitor URLs
  // carry a trailing slash (`/home/?lng=es`). Without this normalization,
  // `PUBLIC_ROUTES.has('/home/')` misses the `/home` entry, the middleware
  // falls through to next(), and the intended 301 to `/es/home/` never
  // fires — defeating the whole purpose of the fix for the exact users it
  // was meant to serve. Root (`/`) is kept as-is; only non-root paths
  // have their trailing slash stripped for the lookup.
  const isRoot = url.pathname === '/';
  const lookupPath =
    !isRoot && url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;

  if (!isRoot && !PUBLIC_ROUTES.has(lookupPath)) {
    return next();
  }

  // Strip the `lng` query param (now encoded in the pathname). Other
  // query params are preserved via `url.searchParams.toString()` below.
  // URL fragments are not transmitted in HTTP requests — browser handles
  // fragment preservation on redirect client-side.
  url.searchParams.delete('lng');

  // Root redirects bypass the flag picker — the user already told us their
  // locale via the legacy query string, no need to ask again.
  const basePath = isRoot ? '/home' : lookupPath;
  const pathWithLocale = lng === 'en' ? basePath : `/${lng}${basePath}`;

  // Trailing slash is the canonical form (matches CF Pages' directory-index
  // serving). Emitting it directly avoids a 301 → 308 chain where the browser
  // hits `/ja/home`, then gets a second redirect to `/ja/home/`.
  const normalizedPath = pathWithLocale.endsWith('/')
    ? pathWithLocale
    : `${pathWithLocale}/`;

  const remaining = url.searchParams.toString();
  const location = `${normalizedPath}` + (remaining ? `?${remaining}` : '');

  // Emit a PATH-ONLY Location header (no scheme, no host). The browser
  // resolves it against the request's current origin, which is the
  // user-visible `echolabsme.com` — not the internal `*.pages.dev` hostname
  // that CF Pages' Function runtime sees via `request.url`. Using
  // `Response.redirect(new URL(...).toString(), 301)` here would bake in
  // whatever `url.origin` resolved to, and in Pages Functions that is
  // `https://echolabsme.pages.dev` — which leaks the staging hostname into
  // the Location header and duplicates content on a second hostname.
  return new Response(null, {
    status: 301,
    headers: { Location: location },
  });
};
