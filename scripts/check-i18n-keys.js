#!/usr/bin/env node
/**
 * i18n key sync checker.
 *
 * Verifies five things:
 *   1. Every `t('key')` call in the source tree resolves to a key in en.json
 *      (the primary check from CC-066).
 *   2. Every non-English locale bundle has the same flattened key set as
 *      en.json — no missing keys, no extra keys (added in CC TASK 4 Part B).
 *   3. Every leaf of en.json and of every other locale bundle is a string,
 *      not null, a number, a boolean or a list (R272.3).
 *   4. No such string is blank: empty, or white space only (R301).
 *   5. Every locale keeps the brand words of i18n-do-not-translate.yaml
 *      that each English value contains, outside the shrinking baseline in
 *      i18n-brand-baseline.json (R256, R260, see i18n-brand-words.js).
 *
 * Exit code 1 if any of the five fails.
 * Usage: node scripts/check-i18n-keys.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  blankLeaves,
  brandWordFailures,
  compareToBaseline,
  describeEntry,
  nonStringLeaves,
  readDoNotTranslate,
} from './i18n-brand-words.js';
import { localeCodes } from './i18n-locales.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// The locales to check: every .json file in src/locales/ other than en.json,
// the source, which the others must match (R266.5). A vitest test holds the
// folder to client/src/i18n.ts's SUPPORTED_LOCALES.
const NON_EN_LOCALES = localeCodes(join(ROOT, 'src/locales'));

// 1. Parse en.json — flatten to dot-notation keys
const enJson = JSON.parse(
  readFileSync(join(ROOT, 'src/locales/en.json'), 'utf8'),
);

function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const k of flattenKeys(value, fullKey)) keys.add(k);
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

const availableKeys = flattenKeys(enJson);

// 2. Scan .ts/.tsx files for t('...') calls
function collectFiles(dir, extensions) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (
      stat.isDirectory() &&
      !entry.startsWith('.') &&
      entry !== 'node_modules'
    ) {
      files.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

const srcFiles = collectFiles(join(ROOT, 'src'), ['.ts', '.tsx']);

// Regex to match t('key') or t("key") — captures the key string
const tCallRegex = /\bt\(\s*['"]([^'"]+)['"]/g;
// Regex to detect dynamic keys like t(`settings.${x}`)
const dynamicKeyRegex = /\bt\(\s*`[^`]*\$\{/g;

const missingKeys = [];
const dynamicKeys = [];

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf8');
  const relPath = relative(ROOT, file);
  let match;

  // Check for dynamic keys (skip these)
  while ((match = dynamicKeyRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    dynamicKeys.push({ file: relPath, line: lineNum });
  }

  // Check static t() calls
  while ((match = tCallRegex.exec(content)) !== null) {
    const key = match[1];
    // Skip keys that use the fallback overload: t('key', 'fallback')
    // These are intentionally using fallbacks for keys not yet in en.json
    if (!availableKeys.has(key)) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      // Check if this call has a fallback (second argument)
      const afterMatch = content.substring(match.index + match[0].length);
      const hasFallback = /^\s*,\s*['"]/.test(afterMatch);
      if (!hasFallback) {
        missingKeys.push({ file: relPath, line: lineNum, key });
      }
    }
  }
}

// 3. Report
if (dynamicKeys.length > 0) {
  console.log(
    `INFO: ${dynamicKeys.length} dynamic t() call(s) found (cannot statically check):`,
  );
  for (const { file, line } of dynamicKeys) {
    console.log(`  ${file}:${line}`);
  }
  console.log('');
}

if (missingKeys.length > 0) {
  console.error(`ERROR: ${missingKeys.length} missing i18n key(s):`);
  for (const { file, line, key } of missingKeys) {
    console.error(`  ${file}:${line} — t('${key}') not found in en.json`);
  }
  process.exit(1);
}

// 4. Multi-locale parity — every non-English bundle must have the same flattened
//    key set as en.json. Enforces that translations stay in lockstep as en.json
//    gains or loses keys. Reference: CC TASK 4 Part B Step 21.
let parityFailed = false;
const bundles = {};
for (const locale of NON_EN_LOCALES) {
  const path = join(ROOT, 'src/locales', `${locale}.json`);
  let json;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(
      `ERROR: failed to load locale bundle '${locale}': ${err.message}`,
    );
    parityFailed = true;
    continue;
  }
  bundles[locale] = json;
  const localeKeys = flattenKeys(json);

  const missing = [...availableKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !availableKeys.has(k));

  if (missing.length || extra.length) {
    parityFailed = true;
    console.error(
      `ERROR: locale '${locale}' is out of sync with en.json ` +
        `(${missing.length} missing, ${extra.length} extra):`,
    );
    for (const k of missing) console.error(`  MISSING in ${locale}: ${k}`);
    for (const k of extra) console.error(`  EXTRA   in ${locale}: ${k}`);
  } else {
    console.log(`  ${locale}: ${localeKeys.size} keys OK`);
  }
}

if (parityFailed) {
  console.error(
    'One or more locales are out of sync with en.json. Fix before committing.',
  );
  process.exit(1);
}

// 5. Every leaf is a string (R272.3) with text in it (R301), in en.json and
//    in every other locale, so the brand-word check below reads every value
//    and no reader is shown a blank.
let leavesFailed = false;
for (const [locale, bundle] of [['en', enJson], ...Object.entries(bundles)]) {
  for (const key of nonStringLeaves(bundle)) {
    leavesFailed = true;
    console.error(`ERROR: src/locales/${locale}.json: ${key} is not a string`);
  }
  for (const key of blankLeaves(bundle)) {
    leavesFailed = true;
    console.error(`ERROR: src/locales/${locale}.json: ${key} has no text`);
  }
}
if (leavesFailed) {
  console.error(
    'Every locale value must be a string with text in it. Fix before committing.',
  );
  process.exit(1);
}

// 6. Brand words (R256, R260): each word of i18n-do-not-translate.yaml that
//    a locale value loses, and its English value contains, fails unless the
//    baseline lists that locale, key and word; a baseline entry that no
//    longer fails fails too.
const words = readDoNotTranslate(join(__dirname, 'i18n-do-not-translate.yaml'));
const baseline = JSON.parse(
  readFileSync(join(__dirname, 'i18n-brand-baseline.json'), 'utf8'),
);
const { unlisted, fixed } = compareToBaseline(
  brandWordFailures(words, enJson, bundles),
  baseline,
);
if (unlisted.length || fixed.length) {
  for (const entry of unlisted) {
    console.error(
      `ERROR: brand word translated (keep it in English): ${describeEntry(entry)}`,
    );
  }
  for (const entry of fixed) {
    console.error(
      `ERROR: no longer fails, remove it from i18n-brand-baseline.json: ${describeEntry(entry)}`,
    );
  }
  process.exit(1);
}

console.log(
  `i18n key check passed. ${availableKeys.size} keys in en.json, all t() calls resolved, ` +
    `${NON_EN_LOCALES.length} non-en locales in sync, every value a string with text, ` +
    `brand words kept outside ${baseline.length} baseline entries.`,
);
