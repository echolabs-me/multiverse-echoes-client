/**
 * Canonical site origin used in `<link rel="canonical">`, `<meta og:url>`,
 * `hreflang` alternates, and JSON-LD `url` fields across the public website.
 *
 * Defined here so consumers don't hard-code the host string. Mirrors the
 * existing module-local constants in `WebsiteLayout.tsx` and `HreflangTags.tsx`
 * — those callers can be refactored to import from here in a future lane;
 * this file currently consolidates the constant for any new SEO-emitting
 * pages.
 */
export const CANONICAL_BASE_URL = 'https://echolabsme.com';
