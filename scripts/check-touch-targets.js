#!/usr/bin/env node
/**
 * Touch-target CSS enforcement — ME-ACC-001 §4.3 v1.1.1.
 *
 * Mechanical CI guard for the WCAG-recommended 44×44px touch-target floor.
 * Two assertions:
 *
 *   1. `client/src/styles/tokens.css` declares
 *      `--ui-touch-target-min: 44px;`. The CSS variable is the contract;
 *      every interactive element with explicit min-height/min-width
 *      either references `var(--ui-touch-target-min)` or sets a value
 *      ≥ 44px. The variable existing at the canonical 44px value is
 *      what makes downstream `var(...)` references safe.
 *
 *   2. No CSS file under `client/src/` declares
 *      `(min-)?height` or `(min-)?width` with a hardcoded value
 *      < 44px inside a rule whose selector targets an interactive
 *      element (`button`, anchor with `href`, `input` of an
 *      interactive type, `[role="button"]`, `[role="link"]`,
 *      `[role="menuitem"]`, etc.). The check is conservative:
 *      a rule with a comma-separated selector list fires if ANY
 *      selector in the list is interactive. Values referencing
 *      `var(--ui-touch-target-min)` always pass regardless of any
 *      computed value, because the variable is asserted at #1.
 *
 * Exit code 1 if any violation found. The CI workflow at
 * `client/.github/workflows/ci.yml` and the private monorepo's
 * `.github/workflows/ci-client.yml` both invoke this via
 * `npm run check-touch-targets`.
 *
 * Reference: ME-ACC-001 §4.3 v1.1.1, Lane S audit row Req 6.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const TOUCH_TARGET_MIN_PX = 44;
const TOUCH_TARGET_VAR = '--ui-touch-target-min';

// Walk a directory tree and collect every file with one of the given
// extensions. Skips node_modules, dist, build, etc.
function* walk(dir, exts) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.next' ||
        entry.name === 'coverage' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }
      yield* walk(full, exts);
      continue;
    }
    if (exts.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

// Assertion 1: tokens.css declares --ui-touch-target-min: 44px.
const tokensPath = join(ROOT, 'src', 'styles', 'tokens.css');
let tokensSrc;
try {
  tokensSrc = readFileSync(tokensPath, 'utf8');
} catch (err) {
  console.error(`::error::Cannot read ${tokensPath}: ${err.message}`);
  process.exit(1);
}

const tokenDeclRe = new RegExp(
  `${TOUCH_TARGET_VAR}\\s*:\\s*${TOUCH_TARGET_MIN_PX}px`,
);
if (!tokenDeclRe.test(tokensSrc)) {
  console.error(
    `::error file=${relative(ROOT, tokensPath)}::Missing canonical declaration ` +
      `${TOUCH_TARGET_VAR}: ${TOUCH_TARGET_MIN_PX}px. ` +
      `ME-ACC-001 §4.3 v1.1.1 requires the variable to be declared at ` +
      `${TOUCH_TARGET_MIN_PX}px in tokens.css; downstream var() references ` +
      `derive their compliance from this canonical declaration.`,
  );
  process.exit(1);
}

// Assertion 2: scan CSS files for hardcoded sub-44px on interactive selectors.
//
// CSS rule shape: `selectorList { declarations }`. We tokenise lightly:
// walk character-by-character, track brace depth, and capture the
// selector string preceding each `{`. Inside the rule body, scan for
// declarations matching `(min-)?(height|width):value;` — if value is a
// hardcoded `<number>px` and < 44px and doesn't reference
// var(--ui-touch-target-min), record a violation.
//
// Selectors are considered "interactive" when they contain any of the
// patterns below at a top-level (non-attribute-selector) position.

const INTERACTIVE_SELECTOR_PATTERNS = [
  // Bare element selectors with word boundaries.
  /(?:^|[\s,>+~])button(?=[\s.:,>+~{[]|$)/,
  /(?:^|[\s,>+~])a(?=[\s.:,>+~{[]|$)/,
  /(?:^|[\s,>+~])input(?=[\s.:,>+~{[]|$)/,
  /(?:^|[\s,>+~])textarea(?=[\s.:,>+~{[]|$)/,
  /(?:^|[\s,>+~])select(?=[\s.:,>+~{[]|$)/,
  /(?:^|[\s,>+~])summary(?=[\s.:,>+~{[]|$)/,
  // ARIA role attribute selectors.
  /\[role\s*[*~|^$]?=\s*["'](?:button|link|menuitem|menuitemcheckbox|menuitemradio|tab|option|switch|checkbox|radio)["']\]/,
];

function selectorIsInteractive(selectorList) {
  // Comma-separate the selector list; if ANY one is interactive, the
  // rule is treated as interactive (the strictest interpretation of
  // "this rule applies to interactive elements").
  for (const sel of selectorList.split(',')) {
    const trimmed = sel.trim();
    if (!trimmed) continue;
    for (const pattern of INTERACTIVE_SELECTOR_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }
  }
  return false;
}

// Strip /* ... */ comments from a CSS chunk (line offsets preserved by
// replacing comment bodies with blanks of equal length).
function stripCssComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const closeIdx = end === -1 ? src.length : end + 2;
      // Replace comment with same-length whitespace, preserving newlines.
      for (let j = i; j < closeIdx; j++) {
        out += src[j] === '\n' ? '\n' : ' ';
      }
      i = closeIdx;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const declRe =
  /(?:^|[\s;{])((?:min-)?(?:height|width))\s*:\s*([^;}\n]+)/g;
const pxValueRe = /(-?\d+(?:\.\d+)?)\s*px/g;

const violations = [];
const cssFiles = [...walk(join(ROOT, 'src'), ['.css'])];

for (const file of cssFiles) {
  const raw = readFileSync(file, 'utf8');
  const src = stripCssComments(raw);
  // Walk character-by-character to track brace depth + accumulate
  // each rule's selector list and body.
  let depth = 0;
  let selectorBuf = '';
  let bodyStart = -1;
  let currentSelector = null;
  // Lines for error reporting — index into `raw` (pre-strip), but
  // strip preserves newline positions so line numbers map 1:1.
  let lineNumber = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') lineNumber += 1;
    if (c === '{') {
      depth += 1;
      if (depth === 1) {
        currentSelector = selectorBuf.trim();
        bodyStart = i + 1;
        selectorBuf = '';
      } else {
        // Nested at-rule (e.g. @media); selector text lives one level out.
      }
      continue;
    }
    if (c === '}') {
      if (depth === 1 && currentSelector !== null && bodyStart !== -1) {
        const body = src.slice(bodyStart, i);
        if (selectorIsInteractive(currentSelector)) {
          declRe.lastIndex = 0;
          let m;
          while ((m = declRe.exec(body)) !== null) {
            const propName = m[1];
            const value = m[2].trim();
            if (value.includes(TOUCH_TARGET_VAR)) continue;
            // Find every px value in the declaration; flag if any is < 44.
            pxValueRe.lastIndex = 0;
            let pm;
            while ((pm = pxValueRe.exec(value)) !== null) {
              const v = parseFloat(pm[1]);
              if (Number.isFinite(v) && v < TOUCH_TARGET_MIN_PX) {
                // Compute approximate line within file.
                const before = body.slice(0, m.index);
                const declLine =
                  bodyStart === -1
                    ? lineNumber
                    : (raw.slice(0, bodyStart).match(/\n/g) || []).length +
                      1 +
                      (before.match(/\n/g) || []).length;
                violations.push({
                  file: relative(ROOT, file),
                  line: declLine,
                  selector: currentSelector,
                  declaration: `${propName}: ${value}`,
                });
                break;
              }
            }
          }
        }
        currentSelector = null;
        bodyStart = -1;
      }
      depth -= 1;
      continue;
    }
    if (depth === 0) {
      selectorBuf += c;
    }
  }
}

// Report.
if (violations.length > 0) {
  console.error(
    `::error::Touch-target enforcement (ME-ACC-001 §4.3 v1.1.1): ${violations.length} violation(s).`,
  );
  for (const v of violations) {
    console.error(
      `::error file=${v.file},line=${v.line}::Selector \`${v.selector}\` declares ${v.declaration} on an interactive element below the ${TOUCH_TARGET_MIN_PX}px floor and does not reference var(${TOUCH_TARGET_VAR}). Either bump the value to ${TOUCH_TARGET_MIN_PX}px+, replace it with var(${TOUCH_TARGET_VAR}), or move the size to a non-interactive child element wrapped by interactive padding ≥ 44px effective hit area.`,
    );
  }
  process.exit(1);
}

console.log(
  `Touch-target check passed: tokens.css declares ${TOUCH_TARGET_VAR}: ${TOUCH_TARGET_MIN_PX}px; ${cssFiles.length} CSS file(s) scanned, no interactive selector declares (min-)height/(min-)width below ${TOUCH_TARGET_MIN_PX}px without var(${TOUCH_TARGET_VAR}).`,
);
