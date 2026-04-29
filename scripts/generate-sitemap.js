/**
 * Sitemap generator (locale-aware).
 *
 * Produces `public/sitemap.xml` with one `<url>` entry per (locale, route)
 * pair, each entry carrying a full XHTML-namespaced `<xhtml:link>` hreflang
 * block listing every other locale variant + x-default.
 *
 * Sitemap-embedded hreflang is redundant with the in-HTML `<link rel="alternate">`
 * tags emitted by `HreflangTags.tsx`, but it's the format Google recommends
 * and is strictly more robust: it's parsed once when Googlebot fetches the
 * sitemap, independent of whether any individual page HTML renders correctly.
 *
 * Wired into `npm run build` as a prebuild step so every production build
 * ships a fresh sitemap reflecting the current locale/route matrix.
 *
 * Usage: node scripts/generate-sitemap.js
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Single source of truth for routes + locales. See public-routes.json
// header comment for the cross-reference contract with prerender.js +
// worker.js's ROUTE_OG.
const MANIFEST = JSON.parse(
  readFileSync(join(__dirname, 'public-routes.json'), 'utf-8'),
);

export const BASE = MANIFEST.base;
const OUT = join(__dirname, '..', 'public', 'sitemap.xml');
const LOCALES = MANIFEST.locales;
const ROUTES = MANIFEST.routes;

/** Absolute URL for a (locale, route) pair. English lives at the unprefixed
 *  root; every other locale lives at `/{locale}{route}`. Trailing slash is
 *  always appended for non-root routes because CF Pages 308-redirects the
 *  no-slash form to the slash form (matches `dist/<loc>/<route>/index.html`).
 *  Declaring the slash form as canonical removes the redirect chain. */
function urlFor(locale, routePath) {
  const prefix = locale === 'en'
    ? `${BASE}${routePath}`
    : `${BASE}/${locale}${routePath}`;
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

/** XHTML-namespaced hreflang block covering all 21 locales + x-default for a
 *  single base route. Identical across every locale variant of that route. */
function alternatesBlock(routePath) {
  const links = LOCALES.map((l) =>
    `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l, routePath)}"/>`,
  );
  links.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/"/>`,
  );
  return links.join('\n');
}

function urlEntry({ url, changefreq, priority, alternates }) {
  return [
    '  <url>',
    `    <loc>${url}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alternates,
    '  </url>',
  ].join('\n');
}

/** Build the full sitemap XML string. Pure function so tests can import and
 *  inspect the output without triggering the filesystem write in main(). */
export function buildSitemapXml() {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  // 1. The flag page at the root. Declares x-default only (it's a language
  //    picker, not a localized content page — hence no per-locale alternates).
  lines.push(
    urlEntry({
      url: `${BASE}/`,
      changefreq: 'monthly',
      priority: '0.5',
      alternates: `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/"/>`,
    }),
  );

  // 2. The locale-route matrix: every (locale, route) pair is its own
  //    canonical URL with a full hreflang block.
  for (const locale of LOCALES) {
    for (const { path: routePath, changefreq, priority } of ROUTES) {
      lines.push(
        urlEntry({
          url: urlFor(locale, routePath),
          changefreq,
          priority,
          alternates: alternatesBlock(routePath),
        }),
      );
    }
  }

  lines.push('</urlset>');
  lines.push('');

  return lines.join('\n');
}

export { urlFor, LOCALES, ROUTES };

function main() {
  const xml = buildSitemapXml();
  writeFileSync(OUT, xml, { encoding: 'utf-8' });
  const total = 1 + LOCALES.length * ROUTES.length;
  console.log(`Generated ${OUT} — ${total} URLs, ${xml.length.toLocaleString()} bytes`);
}

// Only run the writer when invoked directly (`node scripts/generate-sitemap.js`).
// When vitest imports this module, we want the pure helpers but no side effects.
const invokedAsCli =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  main();
}
