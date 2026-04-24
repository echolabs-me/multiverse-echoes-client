import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/_middleware.ts';

/**
 * Regression guards for the Cloudflare Pages middleware that 301s legacy
 * `?lng=xx` URLs to the canonical path-based locale form.
 *
 * Two bugs are being locked in by these tests:
 *
 *   1. ORIGIN LEAK — previously the middleware built the Location header via
 *      `Response.redirect(new URL(newPath, url.origin).toString(), 301)`,
 *      where `url.origin` in the Pages Functions runtime resolves to
 *      `https://echolabsme.pages.dev` (the internal staging host), not the
 *      user-visible `echolabsme.com`. The leaked Location header created
 *      duplicate content indexed at a second hostname and likely contributed
 *      to the GSC "Crawled – currently not indexed" bucket.
 *
 *   2. NO-SLASH TARGET — the old redirect target was `/ja/home` (no slash),
 *      which then 308-redirected to `/ja/home/` at CF's static-serving layer,
 *      creating a 301→308 chain Googlebot has to follow.
 *
 * Fix: path-only Location header, trailing-slash target.
 */

async function redirectFor(incomingUrl: string): Promise<Response> {
  return onRequest({
    request: new Request(incomingUrl),
    next: async () => new Response('next'),
  });
}

describe('Pages middleware — ?lng= legacy redirect', () => {
  it('returns a 301 with a path-only Location (no hostname)', async () => {
    const res = await redirectFor('https://echolabsme.com/home?lng=ja');
    expect(res.status).toBe(301);
    const loc = res.headers.get('Location');
    expect(loc).toBe('/ja/home/');
    // Path-only: must not begin with `http://` or `https://`.
    expect(loc!.startsWith('http')).toBe(false);
  });

  it('does NOT leak echolabsme.pages.dev even when the request arrives with pages.dev host', async () => {
    // Simulate the Pages Functions runtime where request.url carries the
    // internal `*.pages.dev` hostname (this was the source of the leak).
    const res = await redirectFor('https://echolabsme.pages.dev/home?lng=ja');
    const loc = res.headers.get('Location')!;
    expect(loc).toBe('/ja/home/');
    expect(loc).not.toContain('pages.dev');
    expect(loc).not.toContain('echolabsme.com');
  });

  it('target carries a trailing slash (no 301 -> 308 chain)', async () => {
    const res = await redirectFor('https://echolabsme.com/plans?lng=es');
    expect(res.headers.get('Location')).toBe('/es/plans/');
  });

  it('English strips the locale segment but still trailing-slashes', async () => {
    const res = await redirectFor('https://echolabsme.com/about?lng=en');
    expect(res.headers.get('Location')).toBe('/about/');
  });

  it('root with ?lng=xx redirects to the locale home (trailing slash)', async () => {
    const res = await redirectFor('https://echolabsme.com/?lng=ja');
    expect(res.headers.get('Location')).toBe('/ja/home/');
  });

  it('root with ?lng=en redirects to /home/ (trailing slash, no locale prefix)', async () => {
    const res = await redirectFor('https://echolabsme.com/?lng=en');
    expect(res.headers.get('Location')).toBe('/home/');
  });

  it('preserves other query params while stripping lng', async () => {
    const res = await redirectFor(
      'https://echolabsme.com/home?lng=es&ref=twitter',
    );
    expect(res.headers.get('Location')).toBe('/es/home/?ref=twitter');
  });

  it('redirects when the incoming pathname already has a trailing slash (/home/?lng=es)', async () => {
    // Locked in after Copilot review of PR #35. Trailing-slash is now the
    // canonical served form, so real users reaching the middleware will
    // carry `/home/?lng=es` — the exact class of input the redirect was
    // built for. Without pathname normalization before the PUBLIC_ROUTES
    // lookup, `/home/` misses the `/home` entry and next() is called,
    // defeating the entire SEO fix for its intended audience.
    const res = await redirectFor('https://echolabsme.com/home/?lng=es');
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('/es/home/');
  });

  it('passes through when lng is missing (no redirect)', async () => {
    const res = await redirectFor('https://echolabsme.com/home');
    // Assertion on res.status rather than `Location` — the passed-through
    // next() response has no Location header at all.
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('next');
  });

  it('passes through when lng is unknown', async () => {
    const res = await redirectFor('https://echolabsme.com/home?lng=klingon');
    expect(res.status).toBe(200);
  });

  it('passes through for non-public paths (auth/app routes)', async () => {
    const res = await redirectFor('https://echolabsme.com/dashboard?lng=es');
    expect(res.status).toBe(200);
  });
});
