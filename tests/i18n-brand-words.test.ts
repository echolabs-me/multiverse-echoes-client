import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  brandWordFailures,
  compareToBaseline,
  describeEntry,
  parseDoNotTranslate,
  readDoNotTranslate,
} from '../scripts/i18n-brand-words.js';
import { localeCodes } from '../scripts/i18n-locales.js';
import { SUPPORTED_LOCALES } from '../src/i18n.ts';

const WORDS = ['Echoes', 'Echo', 'Tick'];
const SCRIPTS = join(__dirname, '../scripts');
const FIXTURES = join(SCRIPTS, 'fixtures/do-not-translate');

/** What a reader does with a word-list file: refuse it, or read these words. */
type Verdict = 'refuse' | string[];

/** The fixtures both readers' suites share, with each reader's verdict (R266.4). */
const VERDICTS = JSON.parse(
  readFileSync(join(FIXTURES, 'verdicts.json'), 'utf8'),
) as {
  real: string[];
  fixtures: Record<
    string,
    { shape: string; check: Verdict; translate: Verdict }
  >;
};

/** A verdict with its words as a sorted set, so verdicts compare by words. */
function asSet(verdict: Verdict): Verdict {
  return verdict === 'refuse' ? verdict : [...new Set(verdict)].sort();
}

/** What the check does with a fixture. A refusal names the file; any other
 * error, such as a missing file, is not a verdict and fails the test. */
function checkReads(file: string): Verdict {
  try {
    return readDoNotTranslate(join(FIXTURES, file));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith(file)) return 'refuse';
    throw err;
  }
}

/** The check as `npm run check-i18n` runs it, on one English key. */
function check(english: string, french: string, baseline: string[] = []) {
  return compareToBaseline(
    brandWordFailures(WORDS, { k: english }, { fr: { k: french } }),
    baseline,
  );
}

describe('the brand-word check (R256, R260)', () => {
  it('fails a new key whose locale value translates Echo', () => {
    expect(check('Your Echo is waiting', 'Votre Écho attend')).toEqual({
      unlisted: ['fr k Echo'],
      fixed: [],
    });
  });

  it('passes a new key whose locale value keeps Echo', () => {
    expect(check('Your Echo is waiting', 'Votre Echo attend')).toEqual({
      unlisted: [],
      fixed: [],
    });
  });

  it('passes a failure the baseline lists', () => {
    expect(
      check('Your Echo is waiting', 'Votre Écho attend', ['fr k Echo']),
    ).toEqual({ unlisted: [], fixed: [] });
  });

  it('fails a baseline entry that has been fixed and is still listed', () => {
    expect(
      check('Your Echo is waiting', 'Votre Echo attend', ['fr k Echo']),
    ).toEqual({ unlisted: [], fixed: ['fr k Echo'] });
  });

  it('asks only for the words the English value contains as whole words', () => {
    // "Ticket" contains "Tick" but is not the word.
    expect(check('Your Ticket is ready', 'Votre billet est prêt')).toEqual({
      unlisted: [],
      fixed: [],
    });
  });

  it('reads every word of i18n-do-not-translate.yaml, as the translation script does', () => {
    const words = readDoNotTranslate(
      join(SCRIPTS, 'i18n-do-not-translate.yaml'),
    );
    expect(words).toHaveLength(18);
    expect(asSet(words)).toEqual(asSet(VERDICTS.real));
  });

  it('refuses a line of i18n-do-not-translate.yaml it does not understand', () => {
    expect(() =>
      parseDoNotTranslate('product_nouns:\n  - "Echo"\n  - Shard\n'),
    ).toThrow('i18n-do-not-translate.yaml:3: unexpected line:   - Shard');
  });

  it('refuses an i18n-do-not-translate.yaml that lists no words', () => {
    expect(() => parseDoNotTranslate('# nothing\n')).toThrow(
      'i18n-do-not-translate.yaml: missing section product_nouns',
    );
  });

  it('refuses a missing section, naming it', () => {
    expect(() =>
      parseDoNotTranslate(
        'product_nouns:\n  - "Echo"\nbrand_technical_terms:\n  - "Rust"\n',
      ),
    ).toThrow('i18n-do-not-translate.yaml: missing section shard_proper_nouns');
  });

  it('refuses an item before any section header', () => {
    expect(() =>
      parseDoNotTranslate('  - "Echo"\nproduct_nouns:\n  - "Shard"\n'),
    ).toThrow(
      'i18n-do-not-translate.yaml:1: item before any section:   - "Echo"',
    );
  });

  it('refuses an empty section beside a full one', () => {
    expect(() =>
      parseDoNotTranslate(
        'product_nouns:\nbrand_technical_terms:\n  - "Rust"\n',
      ),
    ).toThrow(
      'i18n-do-not-translate.yaml:1: section product_nouns has no items',
    );
  });

  it('refuses an empty last section', () => {
    expect(() =>
      parseDoNotTranslate(
        'product_nouns:\n  - "Echo"\n# shards\nshard_proper_nouns:\n',
      ),
    ).toThrow(
      'i18n-do-not-translate.yaml:4: section shard_proper_nouns has no items',
    );
  });

  /** A word list whose product_nouns are these item lines. */
  const listOf = (...items: string[]) =>
    'product_nouns:\n' +
    items.map((item) => `  - "${item}"\n`).join('') +
    'brand_technical_terms:\n  - "Rust"\nshard_proper_nouns:\n  - "Nomad Australia"\n';

  it('refuses a word with whitespace before or after it, naming the line (R272.1)', () => {
    for (const word of [
      ' Echo',
      'Echo ',
      ' Echo ',
      ' Echo',
      '　Echo',
      'Echo\t',
    ]) {
      expect(() => parseDoNotTranslate(listOf('Shard', word))).toThrow(
        `i18n-do-not-translate.yaml:3: word starts or ends with whitespace: ${JSON.stringify(word)}`,
      );
    }
  });

  it('accepts a word with a space inside it (R272.1)', () => {
    expect(parseDoNotTranslate(listOf('Multiverse Echoes'))).toEqual([
      'Multiverse Echoes',
      'Rust',
      'Nomad Australia',
    ]);
  });

  it('refuses a word listed twice in one section, naming both lines (R272.2)', () => {
    expect(() =>
      parseDoNotTranslate(listOf('Echo', 'Shard', 'Echo')),
    ).toThrow('i18n-do-not-translate.yaml:4: word Echo repeated, first at line 2');
  });

  it('refuses a word listed again in another section, naming both lines (R272.2)', () => {
    expect(() =>
      parseDoNotTranslate(
        'product_nouns:\n  - "Echo"\nbrand_technical_terms:\n  - "Rust"\nshard_proper_nouns:\n  - "Echo"\n',
      ),
    ).toThrow('i18n-do-not-translate.yaml:6: word Echo repeated, first at line 2');
  });

  it('reports a word as lost where the locale has no value for the key (R272.4)', () => {
    expect(
      brandWordFailures(WORDS, { k: 'Your Echo is waiting' }, { fr: {} }),
    ).toEqual(['fr k Echo']);
  });

  it('reports a word as lost where the locale value is not a string (R272.4)', () => {
    for (const value of [null, 7, true, ['Your Echo is waiting']]) {
      expect(
        brandWordFailures(
          WORDS,
          { k: 'Your Echo is waiting' },
          { fr: { k: value } },
        ),
      ).toEqual(['fr k Echo']);
    }
  });

  it('refuses an English value that is not a string, naming its key (R272.4)', () => {
    expect(() =>
      brandWordFailures(
        WORDS,
        { a: { k: ['Your Echo is waiting'] } },
        { fr: { a: { k: 'Votre Echo attend' } } },
      ),
    ).toThrow('en.json a.k: not a string: ["Your Echo is waiting"]');
  });

  it('fails a second word lost from a value the baseline lists for one', () => {
    // The baseline lists the Echo that "Écho" lost; the value now loses Tick.
    expect(check('Echo Tick', 'Écho Tique', ['fr k Echo'])).toEqual({
      unlisted: ['fr k Tick'],
      fixed: [],
    });
  });

  it('reports the one word restored in a value the baseline lists for two', () => {
    expect(check('Echo Tick', 'Écho Tick', ['fr k Echo', 'fr k Tick'])).toEqual(
      { unlisted: [], fixed: ['fr k Tick'] },
    );
  });

  it('names the word in each entry, and refuses an entry with no word', () => {
    expect(describeEntry('fr k Multiverse Echoes')).toBe(
      '"Multiverse Echoes" in fr k',
    );
    expect(() => describeEntry('fr k')).toThrow(
      'not a "<locale> <key> <word>" entry: fr k',
    );
  });
});

describe('the word-list fixtures both readers share (R266.4)', () => {
  it('lists every fixture file, and no other', () => {
    expect(
      readdirSync(FIXTURES)
        .filter((file) => file !== 'verdicts.json')
        .sort(),
    ).toEqual(Object.keys(VERDICTS.fixtures).sort());
  });

  for (const [file, verdict] of Object.entries(VERDICTS.fixtures)) {
    it(`the check's verdict on ${file}: ${verdict.shape}`, () => {
      expect(asSet(checkReads(file))).toEqual(asSet(verdict.check));
    });
  }

  it('every fixture the check accepts, the translation script accepts with the same words', () => {
    const disagree = Object.entries(VERDICTS.fixtures)
      .filter(([file, verdict]) => {
        const read = checkReads(file);
        return (
          read !== 'refuse' &&
          JSON.stringify(asSet(read)) !==
            JSON.stringify(asSet(verdict.translate))
        );
      })
      .map(([file]) => file);
    expect(disagree).toEqual([]);
  });
});

/** Runs the real check-i18n-keys.js over a locale folder of these bundles,
 * with an empty baseline and no source files. */
function runCheck(bundles: Record<string, Record<string, unknown>>) {
  const root = mkdtempSync(join(tmpdir(), 'check-i18n-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src/locales'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{ "type": "module" }');
    for (const file of [
      'check-i18n-keys.js',
      'i18n-brand-words.js',
      'i18n-locales.js',
      'i18n-do-not-translate.yaml',
    ]) {
      copyFileSync(join(SCRIPTS, file), join(root, 'scripts', file));
    }
    writeFileSync(join(root, 'scripts/i18n-brand-baseline.json'), '[]');
    for (const [code, bundle] of Object.entries(bundles)) {
      writeFileSync(
        join(root, 'src/locales', `${code}.json`),
        JSON.stringify(bundle),
      );
    }
    const run = spawnSync(
      process.execPath,
      [join(root, 'scripts/check-i18n-keys.js')],
      { encoding: 'utf8' },
    );
    return { status: run.status, output: run.stdout + run.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('the locales the check reads (R266.5)', () => {
  it("are the locale folder's files, which are SUPPORTED_LOCALES", () => {
    const folder = readdirSync(join(__dirname, '../src/locales'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.slice(0, -'.json'.length))
      .sort();
    expect(folder).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('are every .json file in the folder but en.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'locales-'));
    try {
      for (const file of ['en.json', 'fr.json', 'xx.json', 'notes.txt']) {
        writeFileSync(join(dir, file), '{}');
      }
      expect(localeCodes(dir)).toEqual(['fr', 'xx']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checks a locale file that is in the folder and named nowhere else', () => {
    const kept = runCheck({ en: { k: 'Your Echo' }, xx: { k: 'Your Echo' } });
    expect(kept.output).toContain('xx: 1 keys OK');
    expect(kept.status).toBe(0);

    const missing = runCheck({
      en: { k: 'Your Echo', j: 'Hello' },
      xx: { k: 'Your Echo' },
    });
    expect(missing.output).toContain('MISSING in xx: j');
    expect(missing.status).toBe(1);

    const translated = runCheck({
      en: { k: 'Your Echo' },
      xx: { k: 'Votre Écho' },
    });
    expect(translated.output).toContain(
      'brand word translated (keep it in English): "Echo" in xx k',
    );
    expect(translated.status).toBe(1);
  });

  it('fails when the folder holds no locale but en.json', () => {
    const run = runCheck({ en: { k: 'Your Echo' } });
    expect(run.output).toContain('holds no locale file other than en.json');
    expect(run.status).toBe(1);
  });
});

describe('every locale value is a string (R272.3)', () => {
  for (const [kind, value] of [
    ['null', null],
    ['a number', 7],
    ['a boolean', true],
    ['a list', ['Your Echo']],
  ] as const) {
    it(`fails on ${kind} in a locale file, naming the file and the key, before the brand words`, () => {
      const run = runCheck({
        en: { a: { k: 'Your Echo' }, j: 'Your Echo' },
        xx: { a: { k: value }, j: 'Votre Écho' },
      });
      expect(run.output).toContain('ERROR: src/locales/xx.json: a.k is not a string');
      expect(run.output).not.toContain('brand word translated');
      expect(run.status).toBe(1);
    });
  }

  it('fails on a value in en.json that is not a string, naming the file and the key', () => {
    const run = runCheck({
      en: { a: { k: ['Your Echo'] } },
      xx: { a: { k: ['Your Echo'] } },
    });
    expect(run.output).toContain('ERROR: src/locales/en.json: a.k is not a string');
    expect(run.output).toContain('ERROR: src/locales/xx.json: a.k is not a string');
    expect(run.status).toBe(1);
  });
});
