/**
 * The client's audit gate (R517.2). Every input is written here, but for the
 * Windows control, which runs the gate over the client folder's own files: no
 * test runs npm or sends a request off the machine (SR51).
 */
import { describe, expect, it } from 'vitest';

import { spawnSync } from 'node:child_process';

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  CANARY_DEV_ONLY,
  CANARY_SHIPPED,
  controlledEnv,
  evaluate,
  evaluateCanary,
  FULL_AUDIT_ARGS,
  isMain,
  packageManagerVersion,
  REGISTRY,
  runGate,
  SHIPPED_AUDIT_ARGS,
  WINDOWS_REFUSAL,
  withConfigs,
} from '../scripts/audit-gate.js';

const FULL = `npm ${FULL_AUDIT_ARGS.join(' ')}`;
/** The gate's module, for the test that runs it in a child Node. */
// Built from paths, not `new URL`, since the test environment's URL resolves
// against its own page rather than the file system.
const GATE_URL = pathToFileURL(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'scripts',
    'audit-gate.js',
  ),
).href;
/** How long the child's via walk may take before it counts as a loop. */
const VIA_WALK_LIMIT_MS = 10_000;
const SHIPPED = `npm ${SHIPPED_AUDIT_ARGS.join(' ')}`;

const PICO = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const OTHER = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';
const VERSIONS = ['4.0.6', '4.0.7'];

const picoAdvisory = {
  source: 1,
  name: 'picomatch',
  dependency: 'picomatch',
  title: 'ReDoS',
  url: PICO,
  severity: 'high',
  range: '<=4.0.7',
};

type Vulns = Record<string, { severity: string; via: unknown[] }>;

/** npm's report: `metadata.vulnerabilities` counts each package by severity. */
function audit(vulnerabilities: Vulns): string {
  const counts: Record<string, number> = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  for (const { severity } of Object.values(vulnerabilities)) {
    counts[severity] += 1;
    counts.total += 1;
  }
  return JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities,
    metadata: { vulnerabilities: counts },
  });
}

/** The totals the gate logs for an audit with these counts. */
function logged(high: number, critical = 0): string {
  return JSON.stringify({
    info: 0,
    low: 0,
    moderate: 0,
    high,
    critical,
    total: high + critical,
  });
}

const EMPTY = audit({});
const DEV_ONLY = audit({
  picomatch: { severity: 'high', via: [picoAdvisory] },
  tinyglobby: { severity: 'high', via: ['picomatch'] },
  vite: { severity: 'high', via: ['tinyglobby'] },
});

const entry = {
  url: PICO,
  package: 'picomatch',
  versions: VERSIONS,
  reason: 'dev-only; no fixed release',
  debt: 'docs/claude/debt.md: client audit allowlist',
};

function without<T extends object>(value: T, key: keyof T): Partial<T> {
  const copy: Partial<T> = { ...value };
  delete copy[key];
  return copy;
}

function run(over: Partial<Parameters<typeof evaluate>[0]> = {}): string[] {
  return evaluate({
    fullText: DEV_ONLY,
    prodText: EMPTY,
    allowlistText: JSON.stringify([entry]),
    viewVersions: () => JSON.stringify(VERSIONS),
    ...over,
  });
}

describe('audit gate', () => {
  it('passes a listed advisory that ships in nothing and has no fixed release', () => {
    expect(run()).toEqual([]);
  });

  it('passes a tree with no advisory and an empty list', () => {
    expect(run({ fullText: EMPTY, allowlistText: '[]' })).toEqual([]);
  });

  it('fails a high advisory that is not listed', () => {
    const failures = run({ allowlistText: '[]' });
    expect(failures).toContain(`picomatch: high advisory ${PICO} (ReDoS)`);
  });

  it('fails a critical advisory that is not listed', () => {
    const fullText = audit({
      x: {
        severity: 'critical',
        via: [{ ...picoAdvisory, name: 'x', url: OTHER, severity: 'critical' }],
      },
    });
    expect(run({ fullText })).toContain(
      `x: critical advisory ${OTHER} (ReDoS)`,
    );
  });

  it('passes moderate and low advisories that are not listed', () => {
    const fullText = audit({
      a: {
        severity: 'moderate',
        via: [{ ...picoAdvisory, name: 'a', url: OTHER, severity: 'moderate' }],
      },
      b: {
        severity: 'low',
        via: [
          { ...picoAdvisory, name: 'b', url: `${OTHER}-2`, severity: 'low' },
        ],
      },
    });
    expect(run({ fullText, allowlistText: '[]' })).toEqual([]);
  });

  it('fails a listed advisory that ships', () => {
    expect(run({ prodText: DEV_ONLY })).toContain(
      `${PICO} is listed, but ships: npm audit --omit=dev reports it`,
    );
  });

  it('fails a listed package that has published a release the entry did not record', () => {
    const failures = run({
      viewVersions: () => JSON.stringify([...VERSIONS, '4.0.8']),
    });
    expect(
      failures.some((f) =>
        f.startsWith(
          'picomatch has published versions its entry did not record',
        ),
      ),
    ).toBe(true);
  });

  it('fails when npm view fails or prints nothing', () => {
    expect(run({ viewVersions: () => null })).toContain(
      'npm view picomatch versions failed or printed nothing',
    );
    expect(run({ viewVersions: () => '  ' })).toContain(
      'npm view picomatch versions failed or printed nothing',
    );
  });

  it('fails when npm view prints something that is not JSON', () => {
    expect(run({ viewVersions: () => 'oops' })).toContain(
      'npm view picomatch versions printed something that is not JSON',
    );
  });

  it.each([
    ['not JSON', 'npm warn something', `${FULL}: output is not JSON`],
    ['a list', '[]', `${FULL}: output is not a JSON object`],
    [
      'an error',
      JSON.stringify({ error: { code: 'ENOLOCK' } }),
      `${FULL}: npm reported an error: {"code":"ENOLOCK"}`,
    ],
    [
      'no vulnerabilities',
      JSON.stringify({ metadata: {} }),
      `${FULL}: output lacks vulnerabilities`,
    ],
    [
      'no metadata',
      JSON.stringify({ vulnerabilities: {} }),
      `${FULL}: output lacks metadata`,
    ],
  ])('fails when the full audit output is %s', (_, fullText, message) => {
    expect(run({ fullText })).toEqual([message]);
  });

  it('fails when the --omit=dev output cannot be read', () => {
    expect(run({ prodText: 'not json' })).toEqual([
      `${SHIPPED}: output is not JSON`,
    ]);
  });

  it('fails an advisory with no url or no severity', () => {
    for (const advisory of [
      without(picoAdvisory, 'url'),
      without(picoAdvisory, 'severity'),
    ]) {
      const fullText = audit({
        picomatch: { severity: 'high', via: [advisory] },
      });
      const failures = run({ fullText, allowlistText: '[]' });
      expect(
        failures.some((f) =>
          f.startsWith(
            `${FULL}: picomatch: an advisory with no url or no severity`,
          ),
        ),
      ).toBe(true);
    }
  });

  it('fails a high package with no advisory reachable through its via chain', () => {
    const fullText = audit({
      orphan: { severity: 'high', via: ['missing-package'] },
    });
    expect(run({ fullText, allowlistText: '[]' })).toEqual([
      `${FULL}: orphan: high, with no advisory reachable through its via chain`,
    ]);
  });

  it('accepts a package whose advisory is two steps down its via chain', () => {
    expect(run().some((f) => f.includes('no advisory reachable'))).toBe(false);
  });

  it.each([
    ['missing', null, 'audit-allowlist.json is missing'],
    ['not JSON', '{', 'audit-allowlist.json is not JSON'],
    ['not a list', '{}', 'audit-allowlist.json is not a JSON list'],
  ])('fails when the allowlist is %s', (_, allowlistText, message) => {
    expect(run({ allowlistText })).toEqual([message]);
  });

  it('fails an entry that lacks a field', () => {
    expect(
      run({ allowlistText: JSON.stringify([without(entry, 'reason')]) }),
    ).toEqual(['audit-allowlist.json entry 0 lacks reason']);
  });

  it('fails an entry whose versions is not a list of strings', () => {
    expect(
      run({ allowlistText: JSON.stringify([{ ...entry, versions: '4.0.7' }]) }),
    ).toEqual([
      'audit-allowlist.json entry 0: versions is not a list of version strings',
    ]);
    expect(
      run({
        allowlistText: JSON.stringify([{ ...entry, versions: [4.0, '4.0.7'] }]),
      }),
    ).toEqual([
      'audit-allowlist.json entry 0: versions is not a list of version strings',
    ]);
  });

  it('fails a URL listed twice', () => {
    expect(run({ allowlistText: JSON.stringify([entry, entry]) })).toEqual([
      `audit-allowlist.json lists ${PICO} twice`,
    ]);
  });

  it('fails an entry that matches no advisory, so a fixed advisory leaves no stale entry', () => {
    expect(run({ fullText: EMPTY })).toEqual([
      `audit-allowlist.json lists ${PICO}, which no advisory in npm audit's output matches`,
    ]);
  });

  it('fails an entry that names another package than its advisory', () => {
    expect(
      run({
        allowlistText: JSON.stringify([{ ...entry, package: 'tinyglobby' }]),
      }),
    ).toContain(`${PICO} is in picomatch, but its entry names tinyglobby`);
  });
  it("compares each entry's recorded list, even when two entries share a package", () => {
    const second = { ...picoAdvisory, url: OTHER, title: 'Second' };
    const fullText = audit({
      picomatch: { severity: 'high', via: [picoAdvisory, second] },
    });
    const allowlistText = JSON.stringify([
      entry,
      { ...entry, url: OTHER, versions: ['4.0.6'] },
    ]);
    expect(run({ fullText, allowlistText })).toEqual([
      expect.stringContaining(`(${OTHER})`),
    ]);
  });

  it('reads the lockfile alone, naming every dependency type each audit includes', () => {
    expect(FULL_AUDIT_ARGS).toEqual([
      'audit',
      '--package-lock-only',
      '--json',
      '--include=dev',
      '--include=optional',
      '--include=peer',
    ]);
    expect(SHIPPED_AUDIT_ARGS).toEqual([
      'audit',
      '--package-lock-only',
      '--json',
      '--omit=dev',
      '--include=optional',
      '--include=peer',
    ]);
  });

  it('knows it is the program when started through a linked folder', () => {
    // The temporary folder's real path, since it may sit under a link itself
    // (macOS's tmpdir does), and a linked folder in place of a linked file,
    // which Windows makes as a junction with no privilege (R524.5).
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'audit-gate-')));
    try {
      const realDir = join(dir, 'real');
      mkdirSync(realDir);
      const real = join(realDir, 'gate.js');
      writeFileSync(real, '');
      const other = join(realDir, 'other.js');
      writeFileSync(other, '');
      const linkDir = join(dir, 'link');
      symlinkSync(
        realDir,
        linkDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const url = pathToFileURL(real).href;
      expect(isMain(join(linkDir, 'gate.js'), url)).toBe(true);
      expect(isMain(real, url)).toBe(true);
      expect(isMain(other, url)).toBe(false);
      expect(isMain(join(linkDir, 'other.js'), url)).toBe(false);
      expect(isMain(join(dir, 'missing.js'), url)).toBe(false);
      expect(isMain(undefined, url)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['vulnerabilities', { vulnerabilities: [], metadata: {} }],
    ['metadata', { vulnerabilities: {}, metadata: [] }],
  ])('fails when %s is a list, not an object', (field, report) => {
    expect(run({ fullText: JSON.stringify(report) })).toEqual([
      `${FULL}: output lacks ${field}`,
    ]);
  });

  it.each([
    [
      'an error',
      JSON.stringify({ error: { code: 'E500' } }),
      'npm reported an error: {"code":"E500"}',
    ],
    [
      'no vulnerabilities',
      JSON.stringify({ metadata: {} }),
      'output lacks vulnerabilities',
    ],
  ])('fails when the --omit=dev output is %s', (_, prodText, message) => {
    expect(run({ prodText })).toEqual([`${SHIPPED}: ${message}`]);
  });

  it('fails an entry that is not an object', () => {
    expect(run({ allowlistText: '[null]' })).toEqual([
      'audit-allowlist.json entry 0 is not an object',
    ]);
  });

  it.each([
    ['reason', ''],
    ['package', null],
    ['url', 5],
    ['debt', '   '],
  ])('fails an entry whose %s is not a string with text', (field, value) => {
    expect(
      run({ allowlistText: JSON.stringify([{ ...entry, [field]: value }]) }),
    ).toEqual([
      `audit-allowlist.json entry 0: ${field} not a string with text`,
    ]);
  });

  it.each([
    ['null', null],
    ['an empty object', {}],
    ['a number', 5],
    ['a record whose via is null', { severity: 'high', via: null }],
    ['a record whose via holds a number', { severity: 'high', via: [5] }],
    ['a record whose via holds null', { severity: 'high', via: [null] }],
    ['a record with an empty severity', { severity: '', via: [] }],
    [
      'a record with a severity npm never prints',
      { severity: 'High', via: [] },
    ],
  ])('fails a package record that is %s', (_, record) => {
    const fullText = JSON.stringify({
      vulnerabilities: { x: record },
      metadata: {},
    });
    expect(run({ fullText })).toEqual([
      `${FULL}: x's record is not an object with one of npm's severities and a via list of names and advisories`,
    ]);
  });

  it('accepts a record whose via holds an advisory object and a package name', () => {
    const fullText = audit({
      picomatch: { severity: 'high', via: [picoAdvisory, 'tinyglobby'] },
      tinyglobby: { severity: 'high', via: ['picomatch'] },
    });
    expect(run({ fullText })).toEqual([]);
  });

  it.each([
    ['an empty url', { ...picoAdvisory, url: '' }],
    ['a url that is a number', { ...picoAdvisory, url: 5 }],
    ['a severity that is a number', { ...picoAdvisory, severity: 5 }],
  ])('fails an advisory with %s', (_, advisory) => {
    const fullText = audit({
      picomatch: { severity: 'high', via: [advisory] },
    });
    const failures = run({ fullText, allowlistText: '[]' });
    expect(
      failures.some((f) =>
        f.startsWith(
          `${FULL}: picomatch: an advisory with no url or no severity`,
        ),
      ),
    ).toBe(true);
  });

  it.each(['High', ''])(
    'fails an advisory whose severity %j is not one of npm levels',
    (severity) => {
      const fullText = audit({
        picomatch: { severity: 'high', via: [{ ...picoAdvisory, severity }] },
      });
      expect(run({ fullText, allowlistText: '[]' })).toContain(
        `${FULL}: picomatch: advisory ${PICO} has severity ${JSON.stringify(severity)}, which is not one of npm's levels`,
      );
    },
  );

  it(
    'ends a via chain that loops back on itself',
    () => {
      // A walk that loops is synchronous and never yields, so vitest's own
      // per-test timeout cannot stop it (measured: the run hangs). The walk runs
      // in a child Node with a time limit instead, so a loop fails the test with
      // a message rather than hanging the run (R520.2(5)).
      const fullText = audit({
        a: { severity: 'high', via: ['b'] },
        b: { severity: 'high', via: ['a'] },
      });
      const script = [
        `import { evaluate } from ${JSON.stringify(GATE_URL)};`,
        'const failures = evaluate({',
        `  fullText: ${JSON.stringify(fullText)},`,
        `  prodText: ${JSON.stringify(EMPTY)},`,
        "  allowlistText: '[]',",
        '  viewVersions: () => null,',
        '});',
        'process.stdout.write(JSON.stringify(failures));',
      ].join('\n');
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        { encoding: 'utf8', timeout: VIA_WALK_LIMIT_MS },
      );
      expect(
        result.signal,
        `the via walk did not end within ${VIA_WALK_LIMIT_MS} ms`,
      ).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual([
        `${FULL}: a: high, with no advisory reachable through its via chain`,
        `${FULL}: b: high, with no advisory reachable through its via chain`,
      ]);
      // vitest's own limit sits above the child's, so the child's is the one
      // that reports a loop (R524.5).
    },
    2 * VIA_WALK_LIMIT_MS,
  );
});

describe('audit gate: the shipped output is read as the full one is (R524.4)', () => {
  const shippedPico = audit({
    picomatch: { severity: 'high', via: [picoAdvisory] },
  });

  it('fails a high advisory in the shipped output that is not listed', () => {
    const otherAdvisory = { ...picoAdvisory, url: OTHER, name: 'other' };
    const both = audit({
      picomatch: { severity: 'high', via: [picoAdvisory] },
      other: { severity: 'high', via: [otherAdvisory] },
    });
    expect(
      run({
        fullText: both,
        prodText: audit({ other: { severity: 'high', via: [otherAdvisory] } }),
      }),
    ).toEqual([
      `other: high advisory ${OTHER} (ReDoS) ships: npm audit --omit=dev reports it`,
    ]);
  });

  it('fails a listed advisory in the shipped output, once', () => {
    expect(run({ prodText: shippedPico })).toEqual([
      `${PICO} is listed, but ships: npm audit --omit=dev reports it`,
    ]);
  });

  it('passes a moderate advisory in the shipped output', () => {
    const moderate = audit({
      picomatch: {
        severity: 'moderate',
        via: [{ ...picoAdvisory, url: OTHER, severity: 'moderate' }],
      },
    });
    expect(run({ prodText: moderate })).toEqual([]);
  });

  it.each([
    ['no url', without(picoAdvisory, 'url')],
    ['an empty url', { ...picoAdvisory, url: '' }],
    ['no severity', without(picoAdvisory, 'severity')],
  ])('fails an advisory in the shipped output with %s', (_, advisory) => {
    const prodText = audit({
      picomatch: { severity: 'high', via: [advisory] },
    });
    const failures = run({ prodText });
    expect(
      failures.some((f) =>
        f.startsWith(
          `${SHIPPED}: picomatch: an advisory with no url or no severity`,
        ),
      ),
    ).toBe(true);
  });

  it('fails an advisory in the shipped output whose severity is not a level', () => {
    const prodText = audit({
      picomatch: {
        severity: 'moderate',
        via: [{ ...picoAdvisory, severity: 'High' }],
      },
    });
    expect(run({ prodText })).toEqual([
      `${SHIPPED}: picomatch: advisory ${PICO} has severity "High", which is not one of npm's levels`,
    ]);
  });

  it('fails a high package in the shipped output with no advisory reachable', () => {
    const prodText = audit({
      orphan: { severity: 'high', via: ['missing-package'] },
    });
    expect(run({ prodText })).toEqual([
      `${SHIPPED}: orphan: high, with no advisory reachable through its via chain`,
    ]);
  });

  it('fails a listed advisory whose name is absent', () => {
    const fullText = audit({
      picomatch: { severity: 'high', via: [without(picoAdvisory, 'name')] },
    });
    expect(run({ fullText })).toEqual([
      `${PICO} is in no named package, but its entry names picomatch`,
    ]);
  });
});

describe('audit gate: npm runs under settings the gate controls (R524.2)', () => {
  it('drops every npm_config_ variable, in any case, and NODE_ENV', () => {
    expect(
      controlledEnv({
        npm_config_offline: 'true',
        NPM_CONFIG_OMIT: 'dev',
        Npm_Config_Include: 'dev',
        NODE_ENV: 'production',
        node_env: 'production',
        PATH: '/bin',
        HTTPS_PROXY: 'http://127.0.0.1:9',
        NPM_TOKEN: 'kept',
      }),
    ).toEqual({
      PATH: '/bin',
      HTTPS_PROXY: 'http://127.0.0.1:9',
      NPM_TOKEN: 'kept',
    });
  });

  it('names both config files and the registry on every command', () => {
    expect(
      withConfigs(['--version'], { user: '/t/u', global: '/t/g' }),
    ).toEqual([
      '--version',
      '--userconfig=/t/u',
      '--globalconfig=/t/g',
      `--registry=${REGISTRY}`,
    ]);
    expect(REGISTRY).toBe('https://registry.npmjs.org/');
  });

  it.each([
    ['npm@11.18.0', '11.18.0'],
    ['npm@11.18.0+sha512.abc', '11.18.0'],
    ['yarn@4.0.0', null],
    ['npm@', null],
    [undefined, null],
    [['npm@11.18.0'], null],
  ])('reads packageManager %j as npm %j', (value, version) => {
    expect(packageManagerVersion(value)).toBe(version);
  });
});

describe('audit gate: the canary (R524.3)', () => {
  const lodash = {
    name: 'lodash',
    url: CANARY_SHIPPED,
    severity: 'high',
    title: 'Prototype Pollution',
  };
  const minimist = {
    name: 'minimist',
    url: CANARY_DEV_ONLY,
    severity: 'critical',
    title: 'Prototype Pollution',
  };
  const FULL_OK = audit({
    lodash: { severity: 'high', via: [lodash] },
    minimist: { severity: 'critical', via: [minimist] },
  });
  const SHIPPED_OK = audit({ lodash: { severity: 'high', via: [lodash] } });

  it('passes when the full audit reports both and the shipped audit lodash alone', () => {
    expect(evaluateCanary(FULL_OK, SHIPPED_OK)).toEqual([]);
  });

  it('fails when the full audit leaves out the dev-only advisory', () => {
    expect(evaluateCanary(SHIPPED_OK, SHIPPED_OK)).toEqual([
      `canary: the full audit does not report ${CANARY_DEV_ONLY}`,
    ]);
  });

  it('fails when the full audit leaves out the shipped advisory', () => {
    const devOnly = audit({
      minimist: { severity: 'critical', via: [minimist] },
    });
    expect(evaluateCanary(devOnly, SHIPPED_OK)).toEqual([
      `canary: the full audit does not report ${CANARY_SHIPPED}`,
    ]);
  });

  it('fails when the shipped audit leaves out the shipped advisory', () => {
    expect(evaluateCanary(FULL_OK, EMPTY)).toEqual([
      `canary: the shipped audit does not report ${CANARY_SHIPPED}`,
    ]);
  });

  it('fails when the shipped audit reports the dev-only advisory', () => {
    expect(evaluateCanary(FULL_OK, FULL_OK)).toEqual([
      `canary: the shipped audit reports ${CANARY_DEV_ONLY}, a dev-only advisory`,
    ]);
  });

  it('fails an audit that read nothing, as an offline npm prints', () => {
    expect(evaluateCanary(EMPTY, EMPTY)).toEqual([
      `canary: the full audit does not report ${CANARY_DEV_ONLY}`,
      `canary: the full audit does not report ${CANARY_SHIPPED}`,
      `canary: the shipped audit does not report ${CANARY_SHIPPED}`,
    ]);
  });

  it('fails output that cannot be read', () => {
    expect(evaluateCanary('nope', '{}')).toEqual([
      'canary: the full audit output cannot be read (npm audit: output is not JSON)',
      'canary: the shipped audit output cannot be read (npm audit: output lacks vulnerabilities and metadata)',
    ]);
  });
});

describe('audit gate: the whole run, with npm stubbed (R524.2, R524.3)', () => {
  type Call = {
    args: string[];
    cwd: string;
    env: Record<string, string | undefined>;
    files: string[];
    packageJson: { packageManager?: string };
    configs: Record<string, string>;
  };

  const lodash = { name: 'lodash', url: CANARY_SHIPPED, severity: 'high' };
  const minimist = {
    name: 'minimist',
    url: CANARY_DEV_ONLY,
    severity: 'critical',
  };
  const CANARY_FULL = audit({
    lodash: { severity: 'high', via: [lodash] },
    minimist: { severity: 'critical', via: [minimist] },
  });
  const CANARY_SHIPPED_OUT = audit({
    lodash: { severity: 'high', via: [lodash] },
  });

  /** A client folder in a temporary folder, with the canary's files. */
  function makeClient(root: string, packageManager = 'npm@11.18.0'): string {
    const client = join(root, 'client');
    mkdirSync(join(client, 'tests', 'fixtures', 'audit-canary'), {
      recursive: true,
    });
    writeFileSync(
      join(client, 'package.json'),
      JSON.stringify({ name: 'c', packageManager }),
    );
    writeFileSync(join(client, 'package-lock.json'), '{"name":"c"}');
    writeFileSync(
      join(client, 'audit-allowlist.json'),
      JSON.stringify([entry]),
    );
    writeFileSync(
      join(client, 'tests', 'fixtures', 'audit-canary', 'canary-package.json'),
      JSON.stringify({ name: 'audit-canary' }),
    );
    writeFileSync(
      join(
        client,
        'tests',
        'fixtures',
        'audit-canary',
        'canary-package-lock.json',
      ),
      '{"name":"audit-canary"}',
    );
    return client;
  }

  /** A stub npm: answers by folder and command, and records each call. */
  function stub(
    over: {
      versions?: Record<string, string>;
      canaryFull?: string;
      canaryShipped?: string;
      versionOk?: boolean;
      viewOk?: boolean;
    } = {},
  ) {
    const calls: Call[] = [];
    const run = (
      args: string[],
      { cwd, env }: { cwd: string; env: Record<string, string | undefined> },
    ) => {
      const configs = Object.fromEntries(
        args
          .filter((a) => /^--(user|global)config=/.test(a))
          .map((a) => {
            const [flag, path] = a.split('=');
            return [flag, readFileSync(path, 'utf8')];
          }),
      );
      calls.push({
        args,
        cwd,
        env,
        files: readdirSync(cwd).sort(),
        packageJson: JSON.parse(
          readFileSync(join(cwd, 'package.json'), 'utf8'),
        ),
        configs,
      });
      const folder = cwd.endsWith('canary') ? 'canary' : 'client';
      if (args[0] === '--version')
        return {
          stdout: `${over.versions?.[folder] ?? '11.18.0'}\n`,
          ok: over.versionOk ?? true,
        };
      if (args[0] === 'view')
        return { stdout: JSON.stringify(VERSIONS), ok: over.viewOk ?? true };
      const full = args.includes('--include=dev');
      if (folder === 'canary')
        return {
          stdout: full
            ? (over.canaryFull ?? CANARY_FULL)
            : (over.canaryShipped ?? CANARY_SHIPPED_OUT),
          ok: false,
        };
      return { stdout: full ? DEV_ONLY : EMPTY, ok: false };
    };
    return { calls, run };
  }

  function gate(
    over: Parameters<typeof stub>[0] = {},
    packageManager?: string,
    prepare: (client: string) => void = () => {},
  ) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'audit-gate-test-')));
    const tmpBase = join(root, 'tmp');
    mkdirSync(tmpBase);
    const { calls, run } = stub(over);
    try {
      const clientDir = makeClient(root, packageManager);
      prepare(clientDir);
      const result = runGate({
        clientDir,
        run,
        env: {
          PATH: '/bin',
          npm_config_offline: 'true',
          NPM_CONFIG_OMIT: 'dev',
          NODE_ENV: 'production',
        },
        tmpBase,
      });
      return { ...result, calls, left: readdirSync(tmpBase) };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('passes, and runs every npm command under the controlled settings', () => {
    const { failures, calls, left, log } = gate();
    expect(failures).toEqual([]);
    const configs = (call: Call) => ({
      user: call.args
        .find((a) => a.startsWith('--userconfig='))!
        .slice('--userconfig='.length),
      global: call.args
        .find((a) => a.startsWith('--globalconfig='))!
        .slice('--globalconfig='.length),
    });
    expect(calls.map((c) => c.args)).toEqual(
      [
        ['--version'],
        ['--version'],
        FULL_AUDIT_ARGS,
        SHIPPED_AUDIT_ARGS,
        FULL_AUDIT_ARGS,
        SHIPPED_AUDIT_ARGS,
        ['view', 'picomatch', 'versions', '--json'],
      ].map((args, i) => withConfigs(args, configs(calls[i]))),
    );
    expect(log).toEqual([
      'npm --version in the canary folder: 11.18.0',
      'npm --version in the client folder: 11.18.0',
      `canary: full audit ${logged(1, 1)}; shipped audit ${logged(1)}`,
      `canary: the full audit reports ${CANARY_DEV_ONLY} and ${CANARY_SHIPPED}; the shipped audit reports ${CANARY_SHIPPED} and not ${CANARY_DEV_ONLY}`,
      `client: full audit ${logged(3)}`,
      `client: shipped audit ${logged(0)}`,
    ]);
    for (const call of calls) {
      expect(call.env).toEqual({ PATH: '/bin' });
      expect(call.files).toEqual(['package-lock.json', 'package.json']);
      expect(call.packageJson.packageManager).toBe('npm@11.18.0');
      expect(call.configs).toEqual({
        '--userconfig': '',
        '--globalconfig': '',
      });
      const user = call.args.find((a) => a.startsWith('--userconfig='));
      const global = call.args.find((a) => a.startsWith('--globalconfig='));
      expect(user?.split('=')[1]).not.toBe(global?.split('=')[1]);
      expect(call.args).toContain(`--registry=${REGISTRY}`);
    }
    expect(left).toEqual([]);
  });

  it('runs the canary in its own folder before the client', () => {
    const { calls } = gate();
    const audits = calls.filter((c) => c.args[0] === 'audit');
    expect(audits.map((c) => c.cwd.endsWith('canary'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(audits[0].cwd).not.toBe(audits[2].cwd);
  });

  it('fails, reading nothing further, when the canary misses', () => {
    const { failures, calls, left } = gate({
      canaryFull: EMPTY,
      canaryShipped: EMPTY,
    });
    expect(failures).toEqual([
      `canary: the full audit does not report ${CANARY_DEV_ONLY}`,
      `canary: the full audit does not report ${CANARY_SHIPPED}`,
      `canary: the shipped audit does not report ${CANARY_SHIPPED}`,
    ]);
    expect(calls.filter((c) => !c.cwd.endsWith('canary'))).toHaveLength(1);
    expect(left).toEqual([]);
  });

  it('fails when the folders run different npm versions', () => {
    const { failures, calls } = gate({ versions: { canary: '10.9.2' } });
    expect(failures).toEqual([
      'npm --version in the canary folder printed "10.9.2", but packageManager names 11.18.0',
    ]);
    expect(calls.every((c) => c.args[0] === '--version')).toBe(true);
  });

  it('fails when every folder runs an npm that packageManager does not name', () => {
    const { failures } = gate({
      versions: { canary: '10.9.2', client: '10.9.2' },
    });
    expect(failures).toHaveLength(2);
  });

  it('fails a packageManager that names no npm release', () => {
    const { failures, calls } = gate({}, 'yarn@4.0.0');
    expect(failures).toEqual([
      'client/package.json\'s packageManager "yarn@4.0.0" names no npm release',
    ]);
    expect(calls).toEqual([]);
  });

  it('fails a package.json that cannot be read, running no npm', () => {
    const { failures, calls } = gate({}, undefined, (client) =>
      writeFileSync(join(client, 'package.json'), '{'),
    );
    expect(failures).toEqual(['client/package.json cannot be read as JSON']);
    expect(calls).toEqual([]);
  });

  it('fails when the allowlist file is missing', () => {
    const { failures } = gate({}, undefined, (client) =>
      rmSync(join(client, 'audit-allowlist.json')),
    );
    expect(failures).toEqual(['audit-allowlist.json is missing']);
  });

  it.each([
    [
      'the canary package',
      join('tests', 'fixtures', 'audit-canary', 'canary-package.json'),
    ],
    [
      'the canary lockfile',
      join('tests', 'fixtures', 'audit-canary', 'canary-package-lock.json'),
    ],
    ['the lockfile', 'package-lock.json'],
  ])('fails, running no npm, when %s is missing', (_, file) => {
    const { failures, calls, left } = gate({}, undefined, (client) =>
      rmSync(join(client, file)),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^the gate's folders cannot be made from the client's files: /,
    );
    expect(calls).toEqual([]);
    expect(left).toEqual([]);
  });

  it('fails when npm --version exits non-zero, whatever it prints', () => {
    const { failures } = gate({ versionOk: false });
    expect(failures).toEqual([
      'npm --version in the canary folder failed (it printed "11.18.0")',
      'npm --version in the client folder failed (it printed "11.18.0")',
    ]);
  });

  it('fails when npm view exits non-zero', () => {
    const { failures } = gate({ viewOk: false });
    expect(failures).toEqual([
      'npm view picomatch versions failed or printed nothing',
    ]);
  });

  it('logs an npm --version that printed nothing as "(nothing)"', () => {
    const { log } = gate({ versions: { canary: '' } });
    expect(log).toEqual([
      'npm --version in the canary folder: (nothing)',
      'npm --version in the client folder: 11.18.0',
    ]);
  });

  it('logs an audit with no totals in its metadata as "{}"', () => {
    const shipped = JSON.parse(CANARY_SHIPPED_OUT);
    const { log } = gate({
      canaryShipped: JSON.stringify({ ...shipped, metadata: {} }),
    });
    expect(log).toContain(
      `canary: full audit ${logged(1, 1)}; shipped audit {}`,
    );
  });

  it('logs an audit it cannot read as "(unreadable)"', () => {
    const { log } = gate({ canaryFull: 'nope' });
    expect(log).toContain(
      `canary: full audit (unreadable); shipped audit ${logged(1)}`,
    );
  });

  it('removes its folders when the gate fails on the client', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'audit-gate-test-')));
    try {
      const tmpBase = join(root, 'tmp');
      mkdirSync(tmpBase);
      const client = makeClient(root);
      writeFileSync(join(client, 'audit-allowlist.json'), '[]');
      const { failures } = runGate({
        clientDir: client,
        run: stub().run,
        env: {},
        tmpBase,
      });
      expect(failures.length).toBeGreaterThan(0);
      expect(readdirSync(tmpBase)).toEqual([]);
      expect(existsSync(join(client, 'package.json'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe.skipIf(process.platform === 'win32')(
  'audit gate: the program, with a stub npm first on PATH (R524.7)',
  () => {
    // The program runs from a copy in a temporary client whose every file is
    // written here. `npm` there is a shell script (so Windows, which runs no
    // shell script, skips these) that hands its arguments to a Node stub; it
    // answers by command and folder, and nothing leaves the machine (SR51).
    const STUB = `const { basename } = require('node:path');
const args = process.argv.slice(2);
const mode = process.env.STUB_NPM_MODE;
const audit = (vulnerabilities) => {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const { severity } of Object.values(vulnerabilities)) { counts[severity] += 1; counts.total += 1; }
  return JSON.stringify({ vulnerabilities, metadata: { vulnerabilities: counts } });
};
const adv = (name, url, severity) => ({ name, url, severity, title: 't' });
if (args[0] === '--version') { process.stdout.write('11.18.0\\n'); process.exit(mode === 'versionexit' ? 1 : 0); }
if (args[0] === 'view') {
  if (mode === 'viewfail') process.exit(1);
  process.stdout.write(${JSON.stringify(JSON.stringify(VERSIONS))});
  process.exit(0);
}
const full = args.includes('--include=dev');
if (basename(process.cwd()) === 'canary') {
  const lodash = { lodash: { severity: 'high', via: [adv('lodash', ${JSON.stringify(CANARY_SHIPPED)}, 'high')] } };
  const minimist = { minimist: { severity: 'critical', via: [adv('minimist', ${JSON.stringify(CANARY_DEV_ONLY)}, 'critical')] } };
  process.stdout.write(audit(full ? { ...lodash, ...minimist } : lodash));
  process.exit(1);
}
const pico = { picomatch: { severity: 'high', via: [adv('picomatch', ${JSON.stringify(PICO)}, 'high')] } };
const other = mode === 'unlisted' ? { other: { severity: 'high', via: [adv('other', ${JSON.stringify(OTHER)}, 'high')] } } : {};
process.stdout.write(audit(full ? { ...pico, ...other } : {}));
process.exit(1);
`;
    const GATE_SOURCE = readFileSync(fileURLToPath(GATE_URL), 'utf8');
    const PROGRAM_LIMIT_MS = 10_000;

    /** Run a copy of the program in a temporary client; remove it after. */
    function program(mode: string) {
      const root = realpathSync(
        mkdtempSync(join(tmpdir(), 'audit-gate-program-')),
      );
      try {
        const client = join(root, 'client');
        const canary = join(client, 'tests', 'fixtures', 'audit-canary');
        const bin = join(root, 'bin');
        const tmp = join(root, 'tmp');
        mkdirSync(join(client, 'scripts'), { recursive: true });
        mkdirSync(canary, { recursive: true });
        mkdirSync(bin);
        mkdirSync(tmp);
        const files: [string, string][] = [
          [join(client, 'scripts', 'audit-gate.js'), GATE_SOURCE],
          [
            join(client, 'package.json'),
            JSON.stringify({ type: 'module', packageManager: 'npm@11.18.0' }),
          ],
          [join(client, 'package-lock.json'), '{"name":"c"}'],
          [join(client, 'audit-allowlist.json'), JSON.stringify([entry])],
          [join(canary, 'canary-package.json'), '{"name":"audit-canary"}'],
          [join(canary, 'canary-package-lock.json'), '{"name":"audit-canary"}'],
          [join(bin, 'stub.cjs'), STUB],
        ];
        for (const [path, text] of files) writeFileSync(path, text);
        writeFileSync(
          join(bin, 'npm'),
          '#!/bin/sh\nexec "$STUB_NODE" "$STUB_JS" "$@"\n',
          { mode: 0o755 },
        );
        const result = spawnSync(
          process.execPath,
          [join(client, 'scripts', 'audit-gate.js')],
          {
            encoding: 'utf8',
            timeout: PROGRAM_LIMIT_MS,
            env: {
              ...process.env,
              PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
              TMPDIR: tmp,
              STUB_NODE: process.execPath,
              STUB_JS: join(bin, 'stub.cjs'),
              STUB_NPM_MODE: mode,
            },
          },
        );
        expect(
          result.signal,
          `the program did not end within ${PROGRAM_LIMIT_MS} ms`,
        ).toBeNull();
        expect(readdirSync(tmp)).toEqual([]);
        return result;
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }

    it(
      'prints its log and passes, exiting 0',
      () => {
        const result = program('pass');
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toBe(
          [
            'npm --version in the canary folder: 11.18.0',
            'npm --version in the client folder: 11.18.0',
            `canary: full audit ${logged(1, 1)}; shipped audit ${logged(1)}`,
            `canary: the full audit reports ${CANARY_DEV_ONLY} and ${CANARY_SHIPPED}; the shipped audit reports ${CANARY_SHIPPED} and not ${CANARY_DEV_ONLY}`,
            `client: full audit ${logged(1)}`,
            `client: shipped audit ${logged(0)}`,
            'Audit gate passed: no high or critical advisory outside audit-allowlist.json, and none that ships (R517.2, R524)',
            '',
          ].join('\n'),
        );
      },
      2 * PROGRAM_LIMIT_MS,
    );

    it(
      'fails an unlisted advisory, exiting 1 with the reason',
      () => {
        const result = program('unlisted');
        expect(result.status).toBe(1);
        expect(result.stderr).toBe(
          `Audit gate FAILED (R517.2, R524):\n  - other: high advisory ${OTHER} (t)\n`,
        );
      },
      2 * PROGRAM_LIMIT_MS,
    );

    it(
      'fails when npm view exits non-zero, exiting 1',
      () => {
        const result = program('viewfail');
        expect(result.status).toBe(1);
        expect(result.stderr).toBe(
          'Audit gate FAILED (R517.2, R524):\n  - npm view picomatch versions failed or printed nothing\n',
        );
      },
      2 * PROGRAM_LIMIT_MS,
    );

    it(
      'fails when npm --version exits non-zero though it prints the right version',
      () => {
        const result = program('versionexit');
        expect(result.status).toBe(1);
        expect(result.stderr).toBe(
          'Audit gate FAILED (R517.2, R524):\n  - npm --version in the canary folder failed (it printed "11.18.0")\n  - npm --version in the client folder failed (it printed "11.18.0")\n',
        );
      },
      2 * PROGRAM_LIMIT_MS,
    );
  },
);

describe('audit gate: on Windows it stops first (R533.4)', () => {
  /** The child's limit; each test's own limit sits above it. */
  const GATE_LIMIT_MS = 60_000;

  /**
   * Runs the gate as its own program in a child Node whose `process.platform`
   * is stubbed before the gate loads, with a stub `npm` first on PATH that
   * records that it was started. No real npm runs and nothing leaves the
   * machine (SR51).
   */
  function runAs(platform: string) {
    const dir = mkdtempSync(join(tmpdir(), 'audit-gate-win-'));
    try {
      const marker = join(dir, 'npm-started');
      const npm = join(dir, 'npm');
      writeFileSync(npm, `#!/bin/sh\ntouch '${marker}'\nexit 1\n`);
      chmodSync(npm, 0o755);
      const stub = `data:text/javascript,Object.defineProperty(process,'platform',{value:${JSON.stringify(platform)}})`;
      const result = spawnSync(
        process.execPath,
        ['--import', stub, fileURLToPath(GATE_URL)],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${dir}${delimiter}${process.env.PATH ?? ''}`,
          },
          timeout: GATE_LIMIT_MS,
        },
      );
      expect(
        result.signal,
        `the gate did not end within ${GATE_LIMIT_MS} ms`,
      ).toBeNull();
      return { result, npmStarted: existsSync(marker) };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it(
    'exits non-zero with one line, before starting npm',
    () => {
      const { result, npmStarted } = runAs('win32');
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr.trim()).toBe(WINDOWS_REFUSAL);
      expect(result.stdout).toBe('');
      expect(npmStarted).toBe(false);
    },
    2 * GATE_LIMIT_MS,
  );

  // The stub npm is a shell script, which Windows cannot start, as the
  // stubbed-npm tests above skip there.
  it.skipIf(process.platform === 'win32')(
    'starts npm on Linux, so the stub would see a gate that ran (SR16)',
    () => {
      const { result, npmStarted } = runAs('linux');
      expect(result.stderr).not.toContain(WINDOWS_REFUSAL);
      expect(npmStarted).toBe(true);
    },
    2 * GATE_LIMIT_MS,
  );
});
