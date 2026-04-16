/**
 * Post-build pre-rendering script.
 *
 * Serves dist/ with a minimal Node HTTP server (no Vite dependency),
 * crawls public routes with Playwright, and overwrites the HTML files
 * in dist/ with the fully rendered content.
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

const ROUTES_WITH_LOCALE = ['/home', '/about', '/terms', '/privacy', '/waitlist', '/contact', '/accessibility', '/plans'];

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

      // If path has no extension, try as directory/index.html, then SPA fallback
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

    // Pre-render / (flag page) WITHOUT locale
    {
      console.log('Pre-rendering / (flag page)...');
      const page = await browser.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForSelector('#root > *', { timeout: 5000 });
      await page.waitForTimeout(1000);
      const html = await page.content();
      await page.close();

      const outFile = join(DIST, 'index.html');
      writeFileSync(outFile, html, 'utf-8');
      const size = Buffer.byteLength(html, 'utf-8');
      const hasContent = html.includes('MULTIVERSE ECHOES') || html.includes('language');
      console.log(`  ${size} bytes, content: ${hasContent ? 'YES' : 'NO'}`);
    }

    // Pre-render other routes WITH locale set
    for (const route of ROUTES_WITH_LOCALE) {
      console.log(`Pre-rendering ${route}...`);
      const page = await browser.newPage();

      await page.addInitScript(() => {
        localStorage.setItem('locale_selected', 'true');
        localStorage.setItem('locale', 'en');
      });

      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForSelector('#root > *', { timeout: 5000 });
        await page.waitForTimeout(1000);
        const html = await page.content();
        await page.close();

        const outDir = join(DIST, route);
        mkdirSync(outDir, { recursive: true });
        const outFile = join(outDir, 'index.html');
        writeFileSync(outFile, html, 'utf-8');

        const size = Buffer.byteLength(html, 'utf-8');
        const hasContent = html.includes('Multiverse Echoes') || html.includes('website.hero');
        console.log(`  ${size} bytes, content: ${hasContent ? 'YES' : 'NO'}`);
      } catch (err) {
        await page.close();
        console.warn(`  SKIP: ${route} (${err.name}) — will use client-side rendering`);
      }
    }

    await browser.close();
    console.log('Pre-rendering complete.');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
