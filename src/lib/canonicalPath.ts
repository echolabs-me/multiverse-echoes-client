/**
 * Canonical URL form for pages served by Cloudflare Pages.
 *
 * CF Pages 308-redirects `/foo` to `/foo/` whenever `/foo/index.html` exists —
 * which is every prerendered locale/route page. If our emitted canonical tag,
 * hreflang alternates, og:url, or sitemap entries use the no-slash form,
 * Googlebot crawls `/foo/`, sees it declare canonical `/foo`, fetches `/foo`,
 * receives 308 back to `/foo/`, and files the page as "Duplicate without
 * user-selected canonical" because the declared canonical URL is not stable.
 *
 * Normalizing every URL-emitting surface to the trailing-slash form matches
 * what CF Pages actually serves and removes the redirect chain.
 *
 * Root (`/`) is already canonical and returned unchanged.
 */
export function toCanonicalPath(pathname: string): string {
  if (!pathname) return '/';
  if (pathname === '/' || pathname.endsWith('/')) return pathname;
  return `${pathname}/`;
}
