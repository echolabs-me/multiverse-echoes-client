#!/usr/bin/env node
/**
 * Hardcoded string detector — warns about English UI text not wrapped in t().
 * Runs as a CI warning (non-blocking). Catches obvious misses like
 * <button>Cancel Deletion</button> that should use t('settings.cancelDeletion').
 *
 * Usage: node scripts/check-hardcoded-strings.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

function collectFiles(dir, extensions) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      files.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Known false positives — brand names, technical strings, etc.
const ALLOWED_STRINGS = new Set([
  'Multiverse Echoes',
  'English',
  'Core+',
  'DELETE',
  'Bearer',
  'Content-Type',
  'Authorization',
]);

// Attributes that should NOT contain translatable text
const SKIP_ATTRS = new Set([
  'className', 'class', 'key', 'id', 'name', 'type', 'role', 'href', 'src',
  'data-testid', 'data-test', 'htmlFor', 'target', 'rel', 'method', 'action',
  'autoComplete', 'inputMode', 'pattern', 'accept', 'crossOrigin', 'as',
  'strokeWidth', 'viewBox', 'fill', 'stroke', 'xmlns', 'd', 'variant',
  'position', 'size', 'severity',
]);

const warnings = [];

const pages = collectFiles(join(ROOT, 'src/pages'), ['.tsx']);
const components = collectFiles(join(ROOT, 'src/components'), ['.tsx']);
const files = [...pages, ...components];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const relPath = relative(ROOT, file);
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip imports, comments, type annotations
    if (/^\s*(import|\/\/|\/\*|\*|type |interface )/.test(line)) continue;

    // Check for JSX text content: >English text here<
    const jsxTextMatches = line.matchAll(/>\s*([A-Z][a-z]+(?:\s+[a-zA-Z]+){2,})\s*</g);
    for (const m of jsxTextMatches) {
      const text = m[1].trim();
      if (ALLOWED_STRINGS.has(text)) continue;
      // Check it's not inside a {t(...)} expression
      if (!line.includes('{t(')) {
        warnings.push({ file: relPath, line: lineNum, text, kind: 'JSX text' });
      }
    }

    // Check string props: placeholder="...", title="...", alt="..."
    const propMatches = line.matchAll(/(\w+)="([A-Z][a-z]+(?:\s+[a-zA-Z]+)+)"/g);
    for (const m of propMatches) {
      const attr = m[1];
      const text = m[2];
      if (SKIP_ATTRS.has(attr)) continue;
      if (ALLOWED_STRINGS.has(text)) continue;
      warnings.push({ file: relPath, line: lineNum, text: `${attr}="${text}"`, kind: 'prop' });
    }
  }
}

if (warnings.length > 0) {
  console.log(`WARNING: ${warnings.length} potential hardcoded string(s) found:`);
  for (const { file, line, text, kind } of warnings) {
    console.log(`  ${file}:${line} [${kind}] ${text}`);
  }
  console.log('');
  console.log('These may be false positives. Review and either:');
  console.log('  - Replace with t() call and add key to en.json');
  console.log('  - Add to ALLOWED_STRINGS in this script if intentional');
} else {
  console.log('Hardcoded string check passed. No obvious untranslated UI text found.');
}

// Always exit 0 — this is a warning, not a blocker
