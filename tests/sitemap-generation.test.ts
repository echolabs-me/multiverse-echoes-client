import { describe, it, expect } from 'vitest';
import {
  buildSitemapXml,
  urlFor,
  LOCALES,
  ROUTES,
  BASE,
} from '../scripts/generate-sitemap.js';

/**
 * GSC "Crawled – currently not indexed" / "Duplicate without user-selected
 * canonical" regression guard for the sitemap. Every URL the sitemap declares
 * must match the URL CF Pages actually serves (the trailing-slash form) so
 * Googlebot never follows a redirect chain from a sitemap-declared URL.
 */

describe('Sitemap generator — every non-root URL uses the trailing-slash canonical form', () => {
  it('urlFor appends / for non-root English URLs', () => {
    expect(urlFor('en', '/home')).toBe(`${BASE}/home/`);
    expect(urlFor('en', '/contact')).toBe(`${BASE}/contact/`);
  });

  it('urlFor appends / for locale-prefixed URLs', () => {
    expect(urlFor('bn', '/contact')).toBe(`${BASE}/bn/contact/`);
    expect(urlFor('zh-Hans', '/home')).toBe(`${BASE}/zh-Hans/home/`);
    expect(urlFor('pt-BR', '/plans')).toBe(`${BASE}/pt-BR/plans/`);
  });

  it('urlFor does not double-slash an already-slashed route', () => {
    expect(urlFor('ja', '/home/')).toBe(`${BASE}/ja/home/`);
  });

  it('every <loc> (except root) in the full XML ends with /', () => {
    const xml = buildSitemapXml();
    // Pull every <loc>...</loc> value; assert trailing slash on all non-root.
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
      (m) => m[1],
    );
    // Sanity: 1 root + 21 locales * 8 routes = 169.
    expect(locs.length).toBe(1 + LOCALES.length * ROUTES.length);
    for (const loc of locs) {
      expect(
        loc.endsWith('/'),
        `sitemap <loc> must end with /: got ${loc}`,
      ).toBe(true);
    }
  });

  it('every hreflang <xhtml:link> href (except x-default root) ends with /', () => {
    const xml = buildSitemapXml();
    const hrefs = Array.from(
      xml.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g),
    );
    // Count sanity-check: for each non-root <url>, the alternates block has
    // 21 locale entries + 1 x-default. 168 url blocks × 22 entries = 3696.
    // Plus the root <url> has 1 x-default. Total = 3697.
    expect(hrefs.length).toBe(LOCALES.length * ROUTES.length * 22 + 1);
    for (const [, hreflang, href] of hrefs) {
      // x-default points at the flag picker root (`https://echolabsme.com/`),
      // which is already trailing-slash. Skip it as it's trivially correct.
      if (hreflang === 'x-default') continue;
      expect(
        href.endsWith('/'),
        `hreflang=${hreflang} href=${href} must end with /`,
      ).toBe(true);
    }
  });

  it('sitemap contains no no-slash regressions for known GSC-flagged URLs', () => {
    // These exact URLs were flagged in GSC with "Duplicate without
    // user-selected canonical". Locking them in to prevent recurrence.
    const xml = buildSitemapXml();
    expect(xml).not.toContain('<loc>https://echolabsme.com/bn/contact</loc>');
    expect(xml).not.toContain('<loc>https://echolabsme.com/home</loc>');
    expect(xml).toContain('<loc>https://echolabsme.com/bn/contact/</loc>');
    expect(xml).toContain('<loc>https://echolabsme.com/home/</loc>');
  });
});
