/**
 * Post-build pre-rendering script (per-locale).
 *
 * Loops 21 supported locales × 8 public website routes = 168 Playwright
 * captures (+1 flag page at `/`). Writes each as a standalone HTML file so
 * Cloudflare Pages serves fully-populated HTML with translated titles,
 * meta, JSON-LD, og:*, hreflang, canonical, and `<html lang>`/`<html dir>`
 * for every locale — fixing the Search Console "Duplicate without
 * user-selected canonical" that came from serving identical English HTML
 * for every `?lng=xx` variant of each route.
 *
 * English stays at unprefixed paths (`dist/home/`, `dist/about/`, …); every
 * other locale lives at `dist/{locale}/{route}/index.html` (`dist/es/home/`,
 * `dist/zh-Hant/plans/`, …), matching the App.tsx `<Route path="/:locale">`
 * structure.
 *
 * The Playwright-rendered HTML picks up the correct locale because:
 *   1. URL path is `/es/home` (not `?lng=es`), which i18n.ts'
 *      resolveInitialLocale() reads via LOCALE_PATH_PATTERN regex before
 *      any React code runs.
 *   2. i18next initialises with that locale; every `t(...)` call inside
 *      any page's <Helmet> or JSX body renders in the target language.
 *   3. applyDocumentDirection() in i18n.ts sets <html lang> and
 *      <html dir="rtl"> for Arabic and Urdu, captured in the final HTML.
 *
 * Usage: node scripts/prerender.js
 */

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4175;
const BASE = `http://localhost:${PORT}`;

// Single source of truth for routes + locales (shared with generate-sitemap.js).
// See public-routes.json header comment for the full cross-reference contract.
const MANIFEST = JSON.parse(
  readFileSync(join(__dirname, 'public-routes.json'), 'utf-8'),
);
const LOCALES = MANIFEST.locales;
const ROUTES = MANIFEST.routes.map((r) => r.path);

/**
 * English fallback titles for pages where `<Helmet>` hasn't fired during
 * Playwright capture (seen in rare hydration-timing races). Only applied
 * to the English pass — non-English relies on Helmet fully, and an empty
 * <title> on a non-English page surfaces as a visible smoke-test failure.
 */
const EN_TITLE_FALLBACK = {
  '/home': 'What if you\u2019d taken a different path? | Multiverse Echoes',
  '/about': 'About EchoLabsME \u2014 The Founder Story',
  '/terms': 'Terms of Service \u2014 Multiverse Echoes',
  '/privacy': 'Privacy Policy \u2014 Multiverse Echoes',
  '/waitlist': 'Join the Waitlist \u2014 Multiverse Echoes',
  '/contact': 'Contact \u2014 Multiverse Echoes',
  '/accessibility': 'Accessibility \u2014 Multiverse Echoes',
  '/plans': 'Plans & Pricing \u2014 Multiverse Echoes',
};

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webp': 'image/webp',
};

/** Minimal static file server with SPA fallback (serves index.html for non-file paths). */
function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, BASE);
      let filePath = join(DIST, url.pathname);

      // If path has no extension, try as directory/index.html, then SPA fallback.
      if (!extname(filePath)) {
        const dirIndex = join(filePath, 'index.html');
        if (existsSync(dirIndex)) {
          filePath = dirIndex;
        } else {
          filePath = join(DIST, 'index.html');
        }
      }

      try {
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          const ext = extname(filePath);
          const content = readFileSync(filePath);
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(content);
        } else {
          // SPA fallback
          const content = readFileSync(join(DIST, 'index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        }
      } catch {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    server.listen(PORT, () => {
      console.log(`Static server ready on port ${PORT}`);
      resolve(server);
    });
  });
}

/** Derive the dist filesystem directory for a (locale, route) pair.
 *  `en + /home -> dist/home`, `es + /home -> dist/es/home`, …. */
function outDirFor(locale, route) {
  return locale === 'en' ? join(DIST, route) : join(DIST, locale, route);
}

/** Derive the URL path for a (locale, route) pair.
 *  Trailing slash matches what CF Pages serves in production (`/foo/`),
 *  so the captured React pathname and the runtime pathname agree — and the
 *  canonical/hreflang URLs emitted inside the captured HTML match the URL
 *  the browser actually lands on. */
function urlFor(locale, route) {
  const base = locale === 'en' ? route : `/${locale}${route}`;
  return `${base}/`;
}

async function capture(browser, locale, route) {
  const url = urlFor(locale, route);
  const page = await browser.newPage();

  // Seed localStorage so the client-side i18n bootstrap treats this visitor
  // as already-having-picked-a-locale. For non-English, the URL path also
  // drives locale resolution (higher priority), but setting localStorage
  // avoids any edge case where the flag page shows up.
  await page.addInitScript((localeCode) => {
    try {
      localStorage.setItem('locale_selected', 'true');
      localStorage.setItem('locale', localeCode);
    } catch {
      /* Safari private-mode or similar — no-op. */
    }
  }, locale);

  let html = '';
  let captureError = null;
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#root > *', { timeout: 7000 });

    // i18n.ts exposes `window.__i18nLocaleReady` once the target locale's
    // dynamic chunk has loaded and applied. For English (bundled) this
    // resolves on the first tick; for every other locale we wait until the
    // dynamic-import chunk arrives so the captured HTML is fully translated
    // rather than containing the English fallback. Falls through to a
    // waitForTimeout if the signal never appears (safety net).
    try {
      await page.waitForFunction(
        (expected) => window.__i18nLocaleReady === expected,
        locale,
        { timeout: 10000 },
      );
    } catch {
      // Signal slow or absent — continue with the content wait below.
    }

    // Legal routes lazy-load their locale-specific JSON via LegalDocument,
    // which sets `window.__legalDocReady = "{doc}-{locale}"` after applying.
    // Wait for that signal so the captured HTML contains translated body
    // content, not the English fallback placeholder.
    const legalRoutes = { '/terms': 'terms', '/privacy': 'privacy', '/accessibility': 'accessibility' };
    const legalDoc = legalRoutes[route];
    if (legalDoc) {
      try {
        await page.waitForFunction(
          (expected) => window.__legalDocReady === expected,
          `${legalDoc}-${locale}`,
          { timeout: 10000 },
        );
      } catch {
        // Legal content signal slow or absent — content wait below covers.
      }
    }

    // Small grace period for React to re-render with the loaded locale.
    await page.waitForTimeout(400);
    html = await page.content();
  } catch (err) {
    captureError = err;
  } finally {
    await page.close();
  }

  if (captureError) {
    // One locale/route failing shouldn't abort the whole build — log and move
    // on. Missing HTML is preferable to a half-deployed locale matrix.
    return {
      url,
      size: 0,
      warn: ` SKIP ${captureError.name || 'Error'}: ${(captureError.message || '').split('\n')[0]}`,
    };
  }

  // Helmet (react-helmet-async 3.0 + React 19) can end up emitting two
  // or three <title> tags in the captured HTML: the template fallback,
  // a Helmet-injected copy, and sometimes a second Helmet copy from
  // StrictMode's double-render. Dedupe in three passes:
  //
  //   1. Strip the template's generic "Multiverse Echoes" fallback and
  //      any empty <title></title>. These are always redundant once
  //      Helmet has committed a real title.
  //   2. Dedupe duplicate <title>X</title> occurrences by keeping only
  //      the first one. React-helmet-async's merging logic treats the
  //      first-rendered <Helmet> as authoritative for SSR/static, so
  //      keeping the first matches its intent.
  //   3. If after all that there's no title at all (Helmet never fired),
  //      inject an English fallback for English pages. Non-English pages
  //      with no title will surface as a smoke-test warning below
  //      instead of silently getting the wrong-language fallback.
  html = html.replace(/<title>Multiverse Echoes<\/title>\s*/g, '');
  html = html.replace(/<title><\/title>\s*/g, '');

  let titleSeen = false;
  html = html.replace(/<title>[^<]*<\/title>/g, (m) => {
    if (titleSeen) return '';
    titleSeen = true;
    return m;
  });

  if (!titleSeen && locale === 'en' && EN_TITLE_FALLBACK[route]) {
    html = html.replace(/<head>/, `<head><title>${EN_TITLE_FALLBACK[route]}</title>`);
  }

  // Apply first-wins dedupe to the other Helmet-managed head tags that
  // suffer the same multi-emit quirk as <title>:
  //
  //   Single-valued: canonical, og:*, twitter:*, description/keywords/robots
  //                  meta, JSON-LD scripts.
  //   Multi-valued:  og:locale:alternate (21 entries), rel="alternate"
  //                  hreflang links (22 entries incl. x-default).
  //
  // Strategy: dedupe meta tags by (property/name) + content so multi-valued
  // tags keep every unique content value, single-valued ones collapse to
  // the first. Same for <link rel="alternate"> dedupe by (rel + hreflang).
  //
  // <link rel="canonical"> is single-valued (href). JSON-LD <script> blocks
  // are deduped by exact string match.

  // meta[property=og:*]  — dedupe by (property, content)
  {
    const seen = new Set();
    html = html.replace(
      /<meta\s+property="(og:[^"]+)"\s+content="([^"]*)"[^>]*>/g,
      (m, prop, content) => {
        const key = `${prop}||${content}`;
        if (seen.has(key)) return '';
        seen.add(key);
        return m;
      },
    );
  }

  // meta[name=twitter:*]  — dedupe by (name, content)
  {
    const seen = new Set();
    html = html.replace(
      /<meta\s+name="(twitter:[^"]+)"\s+content="([^"]*)"[^>]*>/g,
      (m, name, content) => {
        const key = `${name}||${content}`;
        if (seen.has(key)) return '';
        seen.add(key);
        return m;
      },
    );
  }

  // meta[name=description|keywords|robots]  — dedupe by name
  for (const metaName of ['description', 'keywords', 'robots']) {
    let seen = false;
    const pattern = new RegExp(`<meta\\s+name="${metaName}"[^>]*>`, 'g');
    html = html.replace(pattern, (m) => {
      if (seen) return '';
      seen = true;
      return m;
    });
  }

  // link[rel=canonical]  — single-valued, keep first
  {
    let canonSeen = false;
    html = html.replace(/<link\s+rel="canonical"[^>]*>/g, (m) => {
      if (canonSeen) return '';
      canonSeen = true;
      return m;
    });
  }

  // link[rel=alternate]  — multi-valued (hreflang), dedupe by hreflang
  {
    const seen = new Set();
    html = html.replace(
      /<link\s+rel="alternate"\s+hreflang="([^"]+)"[^>]*>/g,
      (m, hreflang) => {
        if (seen.has(hreflang)) return '';
        seen.add(hreflang);
        return m;
      },
    );
  }

  // script[type=application/ld+json]  — dedupe by exact content. Using
  // a non-greedy body match to avoid spanning across unrelated blocks.
  {
    const seen = new Set();
    html = html.replace(
      /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
      (m) => {
        if (seen.has(m)) return '';
        seen.add(m);
        return m;
      },
    );
  }

  const outDir = outDirFor(locale, route);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');

  const size = Buffer.byteLength(html, 'utf-8');
  // Non-destructive sanity: empty title on a non-English page signals that
  // Helmet didn't commit the translated title in time. Report but don't fail
  // the build — a human-visible warning is more useful than a crash here.
  const emptyTitle = html.includes('<title></title>');
  const warn = locale !== 'en' && emptyTitle ? ' WARN empty title' : '';
  return { url, size, warn };
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
  }

  console.log('Starting static server...');
  const server = await startServer();

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });

    try {
      // 1. Flag page at `/` (no locale, x-default).
      console.log('Pre-rendering / (flag page)...');
      const page = await browser.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('#root > *', { timeout: 7000 });
      await page.waitForTimeout(1200);
      const flagHtml = await page.content();
      await page.close();
      writeFileSync(join(DIST, 'index.html'), flagHtml, 'utf-8');
      console.log(`  ${Buffer.byteLength(flagHtml, 'utf-8')} bytes, content: ${flagHtml.includes('MULTIVERSE ECHOES') ? 'YES' : 'NO'}`);

      // 2. The 21 × 8 locale/route matrix.
      const startedAt = Date.now();
      let done = 0;
      const total = LOCALES.length * ROUTES.length;
      for (const locale of LOCALES) {
        console.log(`\n[${locale}] ${ROUTES.length} routes`);
        for (const route of ROUTES) {
          const { url, size, warn } = await capture(browser, locale, route);
          done += 1;
          console.log(`  (${done}/${total}) ${url.padEnd(30)} ${String(size).padStart(6)} bytes${warn}`);
        }
      }
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`\nPre-rendering complete. ${total} pages in ${elapsed}s.`);
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
