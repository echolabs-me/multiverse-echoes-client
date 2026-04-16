/**
 * Post-build pre-rendering script.
 *
 * Starts Vite's preview server, crawls public routes with Playwright,
 * and saves the rendered HTML into dist/ so search engines see full content
 * instead of an empty root div.
 *
 * Usage: node scripts/prerender.js
 * Runs automatically via: npm run build (see package.json postbuild)
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4175; // Vite preview default
const BASE = `http://localhost:${PORT}`;

// Routes to pre-render. '/' is the flag page (no locale cookie set).
// All other routes need locale set so they don't redirect.
const ROUTES_WITH_LOCALE = ['/home', '/about', '/terms', '/privacy', '/waitlist', '/contact', '/accessibility', '/plans'];

async function main() {
  // Verify dist exists
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
  }

  // Start Vite preview server
  console.log('Starting preview server...');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: join(__dirname, '..'),
    stdio: 'pipe',
    shell: true,
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview server timeout')), 15000);
    server.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Local:') || msg.includes(String(PORT))) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', (data) => {
      // Vite sometimes logs to stderr
      const msg = data.toString();
      if (msg.includes('Local:') || msg.includes(String(PORT))) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  console.log('Preview server ready.');

  try {
    // Import Playwright
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });

    // Pre-render / (flag page) WITHOUT locale — so crawlers see the language selection
    {
      console.log('Pre-rendering / (flag page)...');
      const page = await browser.newPage();
      // Do NOT set locale_selected — the flag page renders when no locale is set
      await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2000);
      const html = await page.content();
      await page.close();

      // Overwrite dist/index.html with pre-rendered flag page
      const outFile = join(DIST, 'index.html');
      writeFileSync(outFile, html, 'utf-8');
      const hasContent = html.includes('MULTIVERSE ECHOES') || html.includes('language');
      const size = Buffer.byteLength(html, 'utf-8');
      console.log(`  Saved ${outFile} (${size} bytes, content: ${hasContent ? 'YES' : 'NO'})`);
    }

    // Pre-render other routes WITH locale set
    for (const route of ROUTES_WITH_LOCALE) {
      console.log(`Pre-rendering ${route}...`);
      const page = await browser.newPage();

      // Set localStorage so routes render directly without redirect
      await page.addInitScript(() => {
        localStorage.setItem('locale_selected', 'true');
        localStorage.setItem('locale', 'en');
      });

      await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 30000 });

      // Wait for React to hydrate and render content.
      // 'load' fires earlier than 'networkidle' but avoids timeouts
      // on pages with third-party widgets (e.g. Turnstile on /contact).
      await page.waitForTimeout(2000);

      const html = await page.content();
      await page.close();

      // Write the HTML to the appropriate path in dist/
      const outDir = join(DIST, route);
      mkdirSync(outDir, { recursive: true });
      const outFile = join(outDir, 'index.html');
      writeFileSync(outFile, html, 'utf-8');

      // Verify it has content (not just empty root div)
      const hasContent = html.includes('Multiverse Echoes') || html.includes('website.hero');
      const size = Buffer.byteLength(html, 'utf-8');
      console.log(`  Saved ${outFile} (${size} bytes, content: ${hasContent ? 'YES' : 'NO'})`);
    }

    await browser.close();
    console.log('Pre-rendering complete.');
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
