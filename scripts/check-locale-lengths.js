#!/usr/bin/env node
/**
 * Per-locale length-ratio sanity floor — ME-ACC-001 §7.6 v1.1.
 *
 * For every translation key, warn when a non-en locale's string exceeds the
 * en.json equivalent by more than 50% characters. This catches gross
 * translation explosion (a sanity floor). Visual layout verification at the
 * 40% UI-expansion threshold is delegated to translator review per spec
 * §7.6 v1.1.
 *
 * Run from `client/` (it reads `src/locales`), as the step "Per-locale
 * string-length sanity check" in `client/.github/workflows/ci.yml` runs it.
 * It only warns: it exits 0 whatever it finds, and non-zero only when a
 * locale file cannot be read or parsed. This was that step's `node -e`
 * block, moved here so the workflow check's named form for `node` can hold
 * the step (R665).
 */
import fs from 'node:fs';
import path from 'node:path';

const localesDir = 'src/locales';
const en = JSON.parse(
  fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'),
);
const flatten = (obj, prefix = '') => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v ?? '');
    }
  }
  return out;
};
const enFlat = flatten(en);
const violations = [];
for (const file of fs.readdirSync(localesDir)) {
  if (!file.endsWith('.json') || file === 'en.json') continue;
  const locale = file.replace(/\.json$/, '');
  const data = flatten(
    JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8')),
  );
  for (const [key, val] of Object.entries(data)) {
    const enVal = enFlat[key];
    if (!enVal || !val) continue;
    if (val.length > enVal.length * 1.5 && enVal.length > 4) {
      violations.push(
        locale +
          ' ' +
          key +
          ' length=' +
          val.length +
          ' > en×1.5=' +
          enVal.length * 1.5,
      );
    }
  }
}
if (violations.length > 0) {
  console.log(
    '::warning::' +
      violations.length +
      ' translation keys exceed en×1.5 length floor (sanity check on translation explosion):',
  );
  for (const v of violations.slice(0, 50)) console.log('::warning::' + v);
  if (violations.length > 50)
    console.log('::warning::... and ' + (violations.length - 50) + ' more');
} else {
  console.log(
    'Per-locale length-ratio sanity check passed: no key exceeds en×1.5.',
  );
}
