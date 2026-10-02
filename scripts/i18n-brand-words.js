/**
 * The brand-word check (R256).
 *
 * `i18n-do-not-translate.yaml` lists the words every locale keeps in
 * English. For each key, each listed word the English value contains must
 * appear unchanged in every locale's value. The words each locale value
 * loses today are listed in `i18n-brand-baseline.json`, one entry per
 * locale, key and word (R260.2); a failure outside it fails the check, and
 * so does an entry in it that no longer fails, so the baseline only shrinks.
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

/**
 * The sections of `i18n-do-not-translate.yaml`: the names the translation
 * script's `load_do_not_translate` requires, and the only ones it accepts.
 */
export const SECTIONS = [
  'product_nouns',
  'brand_technical_terms',
  'shard_proper_nouns',
];

/**
 * A character YAML reads other than as this check does: a control
 * character, which YAML refuses, or a line break other than `\n` and
 * `\r\n` (a lone `\r`, U+0085, U+2028, U+2029), which YAML ends a line at.
 */
const NOT_READ_ALIKE =
  /[^\t\x20-\x7E\xA0-\u2027\u202A-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

/**
 * The words in `i18n-do-not-translate.yaml`. The check accepts the file only
 * in a shape the translation script reads as the same words (R266), and
 * refuses any other, naming the file and the line:
 * - a blank line, or a comment line: spaces, then `#` and anything;
 * - a header: one of SECTIONS, then a colon, then nothing. Each section
 *   appears exactly once, and a missing one is an error naming it;
 * - an item: two spaces, `- "`, the word, `"`, then nothing or a comment.
 *   The word holds no backslash, so no escape can be read two ways. It
 *   starts and ends with a character that is not whitespace (`\s`), since a
 *   word with whitespace around it is never found in a value (R272.1), and
 *   it is listed once, in one section (R272.2).
 * No item comes before the first header, every section has an item, and
 * every character is one both readers read alike (NOT_READ_ALIKE).
 * @param {string} text
 * @param {string} [file] the file the errors name
 * @returns {string[]}
 */
export function parseDoNotTranslate(text, file = 'i18n-do-not-translate.yaml') {
  const words = [];
  /** @type {Map<string, number>} each section's header line */
  const headers = new Map();
  /** @type {Map<string, number>} each word's line */
  const listed = new Map();
  /** @type {{ name: string, line: number, items: number } | null} */
  let section = null;
  const closeSection = () => {
    if (section && section.items === 0) {
      throw new Error(
        `${file}:${section.line}: section ${section.name} has no items`,
      );
    }
  };
  text.split(/\r?\n/).forEach((line, index) => {
    const at = `${file}:${index + 1}`;
    const unread = NOT_READ_ALIKE.exec(line);
    if (unread) {
      const code = unread[0].codePointAt(0) ?? 0;
      throw new Error(
        `${at}: character U+${code.toString(16).toUpperCase().padStart(4, '0')} is not allowed`,
      );
    }
    if (/^ *(#.*)?$/.test(line)) return;
    const header = /^([a-z_]+):$/.exec(line);
    if (header) {
      const name = header[1];
      if (!SECTIONS.includes(name)) {
        throw new Error(
          `${at}: unknown section ${name}; the sections are ${SECTIONS.join(', ')}`,
        );
      }
      const first = headers.get(name);
      if (first !== undefined) {
        throw new Error(
          `${at}: section ${name} repeated, first at line ${first}`,
        );
      }
      closeSection();
      headers.set(name, index + 1);
      section = { name, line: index + 1, items: 0 };
      return;
    }
    const item = /^ {2}- "([^"]*)"( *#.*)?$/.exec(line);
    if (!item) {
      throw new Error(`${at}: unexpected line: ${line}`);
    }
    if (!section) {
      throw new Error(`${at}: item before any section: ${line}`);
    }
    if (item[1].includes('\\')) {
      throw new Error(`${at}: word holds a backslash: ${line}`);
    }
    const word = item[1];
    if (word === '') {
      throw new Error(`${at}: empty word: ${line}`);
    }
    if (/^\s|\s$/u.test(word)) {
      throw new Error(
        `${at}: word starts or ends with whitespace: ${JSON.stringify(word)}`,
      );
    }
    const first = listed.get(word);
    if (first !== undefined) {
      throw new Error(`${at}: word ${word} repeated, first at line ${first}`);
    }
    listed.set(word, index + 1);
    section.items += 1;
    words.push(word);
  });
  closeSection();
  for (const name of SECTIONS) {
    if (!headers.has(name)) {
      throw new Error(`${file}: missing section ${name}`);
    }
  }
  return words;
}

/**
 * Reads a word-list file and parses it. The bytes must be UTF-8: Node would
 * read a bad byte as U+FFFD where the translation script refuses the file.
 * @param {string} path
 * @returns {string[]}
 */
export function readDoNotTranslate(path) {
  const file = basename(path);
  const bytes = readFileSync(path);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${file}: not UTF-8`);
  }
  return parseDoNotTranslate(text, file);
}

/**
 * Flattens a locale bundle to `{ "a.b.c": value }`, one entry per leaf. An
 * object is followed into; any other value, a list included, is a leaf, as
 * `check-i18n-keys.js`'s parity check reads the bundle.
 * @param {Record<string, unknown>} bundle
 * @returns {Map<string, unknown>}
 */
export function flattenLeaves(bundle, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(bundle)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value))
      flattenLeaves(/** @type {Record<string, unknown>} */ (value), full, out);
    else out.set(full, value);
  }
  return out;
}

/**
 * The keys of a bundle whose leaf is not a string: `null`, a number, a
 * boolean or a list (R272.3). Every leaf of every locale file is a string.
 * @param {Record<string, unknown>} bundle
 * @returns {string[]}
 */
export function nonStringLeaves(bundle) {
  return [...flattenLeaves(bundle)]
    .filter(([, value]) => typeof value !== 'string')
    .map(([key]) => key);
}

/** Whether `text` contains `word` as a whole word: not inside a longer one.
 * @param {string} text
 * @param {string} word */
function containsWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    'u',
  ).test(text);
}

/**
 * Every word a locale value lost that its English value contains, one entry
 * per word, as `"<locale> <key> <word>"`, sorted. Locales and keys hold no
 * space, so the word is everything after the second one. A locale value that
 * is missing, or is not a string, has lost every word (R272.4). An English
 * value that is not a string is an error, naming its key.
 * @param {string[]} words
 * @param {Record<string, unknown>} en
 * @param {Record<string, Record<string, unknown>>} locales by locale code
 * @returns {string[]}
 */
export function brandWordFailures(words, en, locales) {
  const failures = [];
  const english = flattenLeaves(en);
  for (const [key, value] of english) {
    if (typeof value !== 'string') {
      throw new Error(`en.json ${key}: not a string: ${JSON.stringify(value)}`);
    }
  }
  for (const [locale, bundle] of Object.entries(locales)) {
    const values = flattenLeaves(bundle);
    for (const [key, value] of english) {
      const translated = values.get(key);
      for (const word of words) {
        if (
          containsWord(/** @type {string} */ (value), word) &&
          !(typeof translated === 'string' && translated.includes(word))
        ) {
          failures.push(`${locale} ${key} ${word}`);
        }
      }
    }
  }
  return failures.sort();
}

/**
 * A failure or baseline entry as a message: which word, in which value. An
 * entry of any other shape, such as a baseline line with no word, is an
 * error.
 * @param {string} entry `"<locale> <key> <word>"`
 */
export function describeEntry(entry) {
  const parts = /^(\S+) (\S+) (.+)$/.exec(entry);
  if (!parts) {
    throw new Error(`not a "<locale> <key> <word>" entry: ${entry}`);
  }
  return `"${parts[3]}" in ${parts[1]} ${parts[2]}`;
}

/**
 * Compares today's failures with the baseline: `unlisted` are failures the
 * baseline does not list, and `fixed` are baseline entries that no longer
 * fail. Either one fails the check.
 * @param {string[]} failures
 * @param {string[]} baseline
 */
export function compareToBaseline(failures, baseline) {
  const failing = new Set(failures);
  const listed = new Set(baseline);
  return {
    unlisted: failures.filter((f) => !listed.has(f)),
    fixed: baseline.filter((b) => !failing.has(b)),
  };
}
