/**
 * The client's audit gate (R517.2).
 *
 * ME-OPS-001 §13.1 blocks on every high or critical npm advisory. This gate
 * keeps that block, with one exception: an advisory listed in
 * `audit-allowlist.json`, which must ship in nothing (it is absent from
 * `npm audit --omit=dev`) and have no fixed release (the package's published
 * versions are exactly the list its entry recorded, so the day any release
 * appears the gate fails and the entry is reviewed). Moderate and low
 * advisories pass, as `npm audit --audit-level=high` lets them pass.
 *
 * It reads `npm audit`'s JSON, never its exit status: `npm audit` exits
 * non-zero whenever any advisory exists, whatever its severity (SR2).
 *
 * npm runs under settings the gate controls (R524.2): an environment with no
 * `npm_config_*` variable and no `NODE_ENV`, two empty config files, the
 * public registry named, and a temporary working folder that holds only a
 * `package.json` and a `package-lock.json`. A canary lockfile is audited
 * first (R524.3), so an audit that read nothing, read dev packages in the
 * shipped run or left them out of the full run fails the gate.
 *
 * Run from `client/`: `node scripts/audit-gate.js`.
 */

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** npm's severity levels; any other value is unreadable and fails. */
export const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];
export const BLOCKING = ['high', 'critical'];
export const ENTRY_FIELDS = ['url', 'package', 'versions', 'reason', 'debt'];
/** The entry fields that must each be a string with text. */
const TEXT_FIELDS = ['url', 'package', 'reason', 'debt'];

/** The registry every npm command names, whatever npm is configured to use. */
export const REGISTRY = 'https://registry.npmjs.org/';

/**
 * Each audit reads the lockfile alone and names every dependency type it
 * includes, so the full audit reports every advisory in the tree and the
 * shipped one every advisory outside dev packages. The gate also strips
 * npm's ambient settings before it runs either (`controlledEnv`,
 * `withConfigs`), and the canary proves what each read (R524.3).
 */
export const FULL_AUDIT_ARGS = [
  'audit',
  '--package-lock-only',
  '--json',
  '--include=dev',
  '--include=optional',
  '--include=peer',
];
export const SHIPPED_AUDIT_ARGS = [
  'audit',
  '--package-lock-only',
  '--json',
  '--omit=dev',
  '--include=optional',
  '--include=peer',
];

/**
 * The canary's advisories (R524.3), measured on 2026-11-18: `lodash` 4.17.15
 * is a dependency, `minimist` 0.0.8 a devDependency.
 */
export const CANARY_SHIPPED =
  'https://github.com/advisories/GHSA-35jh-r3h4-6jhm';
export const CANARY_DEV_ONLY =
  'https://github.com/advisories/GHSA-xvch-5gv4-984h';
/** The canary's files, under names no manifest reader takes for a manifest. */
export const CANARY_DIR = join('tests', 'fixtures', 'audit-canary');
export const CANARY_PACKAGE = 'canary-package.json';
export const CANARY_LOCK = 'canary-package-lock.json';

/**
 * The environment npm runs in: the gate's own, less every variable whose name
 * begins with `npm_config_` (in any case) and less `NODE_ENV`, so no ambient
 * `offline`, `omit`, `include` or production mode reaches npm (R524.2).
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string | undefined>}
 */
export function controlledEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([name]) => !/^npm_config_/i.test(name) && !/^node_env$/i.test(name),
    ),
  );
}

/**
 * An npm command's arguments with the gate's config files and registry.
 * @param {string[]} args
 * @param {{ user: string, global: string }} configs two distinct empty files
 * @returns {string[]}
 */
export function withConfigs(args, configs) {
  return [
    ...args,
    `--userconfig=${configs.user}`,
    `--globalconfig=${configs.global}`,
    `--registry=${REGISTRY}`,
  ];
}

/** A JSON object that is not null and not a list. */
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Parse one `npm audit --json` output, or say why it cannot be read.
 * @param {string} text
 * @param {string} label
 * @returns {{ report: any, failures: string[] }}
 */
export function parseAudit(text, label) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return { report: null, failures: [`${label}: output is not JSON`] };
  }
  if (!isObject(report)) {
    return {
      report: null,
      failures: [`${label}: output is not a JSON object`],
    };
  }
  if ('error' in report) {
    return {
      report: null,
      failures: [
        `${label}: npm reported an error: ${JSON.stringify(report.error)}`,
      ],
    };
  }
  const missing = ['vulnerabilities', 'metadata'].filter(
    (k) => !isObject(report[k]),
  );
  if (missing.length) {
    return {
      report: null,
      failures: [`${label}: output lacks ${missing.join(' and ')}`],
    };
  }
  const unreadable = Object.entries(report.vulnerabilities)
    .filter(
      ([, vuln]) =>
        !isObject(vuln) ||
        !LEVELS.includes(vuln.severity) ||
        !Array.isArray(vuln.via) ||
        vuln.via.some((via) => typeof via !== 'string' && !isObject(via)),
    )
    .map(
      ([pkg]) =>
        `${label}: ${pkg}'s record is not an object with one of npm's severities and a via list of names and advisories`,
    );
  if (unreadable.length) return { report: null, failures: unreadable };
  return { report, failures: [] };
}

/**
 * Parse the allowlist, or say why it cannot be used.
 * @param {string | null} text null when the file is missing
 * @returns {{ entries: any[], failures: string[] }}
 */
export function parseAllowlist(text) {
  if (text === null)
    return { entries: [], failures: ['audit-allowlist.json is missing'] };
  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    return { entries: [], failures: ['audit-allowlist.json is not JSON'] };
  }
  if (!Array.isArray(entries)) {
    return {
      entries: [],
      failures: ['audit-allowlist.json is not a JSON list'],
    };
  }
  const failures = [];
  const seen = new Set();
  entries.forEach((entry, i) => {
    if (!isObject(entry)) {
      failures.push(`audit-allowlist.json entry ${i} is not an object`);
      return;
    }
    const lacking = ENTRY_FIELDS.filter((f) => !(f in entry));
    const notText = TEXT_FIELDS.filter(
      (f) => f in entry && (typeof entry[f] !== 'string' || !entry[f].trim()),
    );
    if (lacking.length)
      failures.push(
        `audit-allowlist.json entry ${i} lacks ${lacking.join(', ')}`,
      );
    else if (notText.length)
      failures.push(
        `audit-allowlist.json entry ${i}: ${notText.join(', ')} not a string with text`,
      );
    else if (
      !Array.isArray(entry.versions) ||
      entry.versions.some((v) => typeof v !== 'string')
    ) {
      failures.push(
        `audit-allowlist.json entry ${i}: versions is not a list of version strings`,
      );
    }
    if ('url' in entry) {
      if (seen.has(entry.url))
        failures.push(`audit-allowlist.json lists ${entry.url} twice`);
      seen.add(entry.url);
    }
  });
  return { entries, failures };
}

/**
 * Every advisory object in a report, with the package it was found under.
 * @param {any} report
 * @returns {{ pkg: string, advisory: any }[]}
 */
function advisories(report) {
  const out = [];
  for (const [pkg, vuln] of Object.entries(report.vulnerabilities)) {
    for (const via of vuln.via) {
      if (isObject(via)) out.push({ pkg, advisory: via });
    }
  }
  return out;
}

/**
 * Whether an advisory object can be reached from a package through its
 * `via` chain (a `via` string names another package in the report).
 * @param {any} report
 * @param {string} start
 */
function reachesAdvisory(report, start) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    // A name the report does not hold has no record, so no advisory.
    for (const via of report.vulnerabilities[name]?.via ?? []) {
      if (isObject(via)) return true;
      queue.push(via);
    }
  }
  return false;
}

/**
 * Each advisory object's own checks, made alike on both audits' outputs
 * (R524.4): every advisory has a url and one of npm's severities, and every
 * package at high or critical reaches an advisory through its `via` chain.
 * @param {any} report
 * @param {string} label
 * @returns {{ valid: { pkg: string, advisory: any }[], failures: string[] }}
 */
function checkAdvisories(report, label) {
  const valid = [];
  const failures = [];
  for (const { pkg, advisory } of advisories(report)) {
    if (
      typeof advisory.url !== 'string' ||
      !advisory.url ||
      typeof advisory.severity !== 'string'
    ) {
      failures.push(
        `${label}: ${pkg}: an advisory with no url or no severity: ${JSON.stringify(advisory)}`,
      );
    } else if (!LEVELS.includes(advisory.severity)) {
      failures.push(
        `${label}: ${pkg}: advisory ${advisory.url} has severity ${JSON.stringify(advisory.severity)}, which is not one of npm's levels`,
      );
    } else {
      valid.push({ pkg, advisory });
    }
  }
  for (const [pkg, vuln] of Object.entries(report.vulnerabilities)) {
    if (BLOCKING.includes(vuln.severity) && !reachesAdvisory(report, pkg)) {
      failures.push(
        `${label}: ${pkg}: ${vuln.severity}, with no advisory reachable through its via chain`,
      );
    }
  }
  return { valid, failures };
}

/**
 * The gate's verdict on the client's two audits.
 * @param {object} input
 * @param {string} input.fullText the output of `npm` with FULL_AUDIT_ARGS
 * @param {string} input.prodText the output of `npm` with SHIPPED_AUDIT_ARGS
 * @param {string | null} input.allowlistText
 * @param {(pkg: string) => string | null} input.viewVersions `npm view <pkg> versions --json`'s
 *   output, or null when the command failed
 * @returns {string[]} the failures it found, one line each for the log; an
 *   empty list means the gate passes. When either output or the allowlist
 *   cannot be read, the list holds only those reasons and nothing further is
 *   checked; otherwise each advisory, entry and package that fails gives its
 *   first failing check's line, and the checks after it are not reported.
 */
export function evaluate({ fullText, prodText, allowlistText, viewVersions }) {
  const fullLabel = `npm ${FULL_AUDIT_ARGS.join(' ')}`;
  const prodLabel = `npm ${SHIPPED_AUDIT_ARGS.join(' ')}`;
  const full = parseAudit(fullText, fullLabel);
  const prod = parseAudit(prodText, prodLabel);
  const allow = parseAllowlist(allowlistText);
  const failures = [...full.failures, ...prod.failures, ...allow.failures];
  if (!full.report || !prod.report || allow.failures.length) return failures;

  const fullChecked = checkAdvisories(full.report, fullLabel);
  const prodChecked = checkAdvisories(prod.report, prodLabel);
  failures.push(...fullChecked.failures, ...prodChecked.failures);

  const byUrl = new Map(allow.entries.map((e) => [e.url, e]));
  const matched = new Set();

  // Anything at high or critical that ships fails, listed or not: a listed
  // advisory must ship in nothing. Advisories match across outputs by URL.
  const shipped = new Set();
  for (const { pkg, advisory } of prodChecked.valid) {
    if (!BLOCKING.includes(advisory.severity)) continue;
    shipped.add(advisory.url);
    if (byUrl.has(advisory.url)) {
      matched.add(advisory.url);
      failures.push(
        `${advisory.url} is listed, but ships: npm audit --omit=dev reports it`,
      );
    } else {
      failures.push(
        `${pkg}: ${advisory.severity} advisory ${advisory.url} (${advisory.title ?? 'no title'}) ships: npm audit --omit=dev reports it`,
      );
    }
  }

  /** @type {Map<string, unknown>} each listed package's published versions, or undefined if unread */
  const published = new Map();
  const publishedVersions = (pkg) => {
    if (!published.has(pkg)) {
      const text = viewVersions(pkg);
      let versions;
      if (text === null || text.trim() === '') {
        failures.push(`npm view ${pkg} versions failed or printed nothing`);
      } else {
        try {
          versions = JSON.parse(text);
        } catch {
          failures.push(
            `npm view ${pkg} versions printed something that is not JSON`,
          );
        }
      }
      published.set(pkg, versions);
    }
    return published.get(pkg);
  };
  /** Each entry's recorded list is compared, even when two share a package. */
  const noFixedRelease = (entry) => {
    const versions = publishedVersions(entry.package);
    if (versions === undefined) return;
    if (JSON.stringify(versions) !== JSON.stringify(entry.versions)) {
      failures.push(
        `${entry.package} has published versions its entry did not record (${entry.url}); ` +
          'if a release fixes it, take the fix and remove the entry, else record the new list (R517.5)',
      );
    }
  };

  for (const { pkg, advisory } of fullChecked.valid) {
    if (!BLOCKING.includes(advisory.severity)) continue;
    // A shipped advisory has already failed above.
    if (shipped.has(advisory.url)) continue;
    const entry = byUrl.get(advisory.url);
    if (!entry) {
      failures.push(
        `${pkg}: ${advisory.severity} advisory ${advisory.url} (${advisory.title ?? 'no title'})`,
      );
      continue;
    }
    matched.add(advisory.url);
    if (advisory.name !== entry.package) {
      failures.push(
        `${advisory.url} is in ${advisory.name ?? 'no named package'}, but its entry names ${entry.package}`,
      );
      continue;
    }
    noFixedRelease(entry);
  }

  for (const entry of allow.entries) {
    if (!matched.has(entry.url)) {
      failures.push(
        `audit-allowlist.json lists ${entry.url}, which no advisory in npm audit's output matches`,
      );
    }
  }
  return failures;
}

/**
 * The URLs of every advisory object in an audit's output that can be read,
 * or null when the output cannot be read.
 * @param {string} text
 */
function advisoryUrls(text) {
  const { report, failures } = parseAudit(text, 'npm audit');
  if (!report) return { urls: null, reason: failures.join('; ') };
  return {
    urls: new Set(
      advisories(report)
        .map(({ advisory }) => advisory.url)
        .filter((url) => typeof url === 'string'),
    ),
    reason: '',
  };
}

/**
 * The canary's verdict (R524.3): the full audit reports both advisories, and
 * the shipped audit reports the shipped one and not the dev-only one.
 * @param {string} fullText the canary's output with FULL_AUDIT_ARGS
 * @param {string} prodText the canary's output with SHIPPED_AUDIT_ARGS
 * @returns {string[]} every expectation the canary missed; none means it
 *   proved both audits read the registry and the dependency types they name
 */
export function evaluateCanary(fullText, prodText) {
  const failures = [];
  const { urls: full, reason: fullReason } = advisoryUrls(fullText);
  const { urls: prod, reason: prodReason } = advisoryUrls(prodText);
  if (!full)
    failures.push(
      `canary: the full audit output cannot be read (${fullReason})`,
    );
  else {
    for (const url of [CANARY_DEV_ONLY, CANARY_SHIPPED]) {
      if (!full.has(url))
        failures.push(`canary: the full audit does not report ${url}`);
    }
  }
  if (!prod)
    failures.push(
      `canary: the shipped audit output cannot be read (${prodReason})`,
    );
  else {
    if (!prod.has(CANARY_SHIPPED))
      failures.push(
        `canary: the shipped audit does not report ${CANARY_SHIPPED}`,
      );
    if (prod.has(CANARY_DEV_ONLY))
      failures.push(
        `canary: the shipped audit reports ${CANARY_DEV_ONLY}, a dev-only advisory`,
      );
  }
  return failures;
}

/**
 * The npm version a `packageManager` value names, or null if it names no
 * npm release (`npm@<version>`, with or without a `+<hash>` suffix).
 * @param {unknown} value
 */
export function packageManagerVersion(value) {
  if (typeof value !== 'string') return null;
  const match = /^npm@([^+\s]+)(\+\S+)?$/.exec(value);
  return match ? match[1] : null;
}

/** Totals from an audit's `metadata.vulnerabilities`, for the log. */
function totals(text) {
  const { report } = parseAudit(text, 'totals');
  return report
    ? JSON.stringify(report.metadata.vulnerabilities ?? {})
    : '(unreadable)';
}

/**
 * Run the whole gate: the canary, then the client's audits, each in its own
 * temporary folder under controlled settings. The temporary folders are
 * removed whatever the verdict.
 * @param {object} input
 * @param {string} input.clientDir the folder holding the client's package.json
 * @param {(args: string[], options: { cwd: string, env: Record<string, string | undefined> }) => { stdout: string, ok: boolean }} input.run
 *   runs npm with these arguments and gives its stdout, whatever its exit status
 * @param {Record<string, string | undefined>} input.env the gate's environment
 * @param {string} [input.tmpBase] where the temporary folders are made
 * @returns {{ failures: string[], log: string[] }} the failures it found
 *   (an empty list means the gate passes) and the lines it reports either
 *   way. It stops at the first stage that fails, in this order: the client's
 *   package.json, the gate's folders, the npm versions, the canary, the
 *   client's audits; a failing stage's reasons are the only failures given.
 */
export function runGate({ clientDir, run, env, tmpBase = tmpdir() }) {
  const log = [];
  let clientPackage;
  try {
    clientPackage = JSON.parse(
      readFileSync(join(clientDir, 'package.json'), 'utf8'),
    );
  } catch {
    return { failures: ['client/package.json cannot be read as JSON'], log };
  }
  const packageManager = clientPackage?.packageManager;
  const wanted = packageManagerVersion(packageManager);
  if (!wanted) {
    return {
      failures: [
        `client/package.json's packageManager ${JSON.stringify(packageManager)} names no npm release`,
      ],
      log,
    };
  }
  let allowlistText = null;
  try {
    allowlistText = readFileSync(
      join(clientDir, 'audit-allowlist.json'),
      'utf8',
    );
  } catch {
    allowlistText = null;
  }

  const root = mkdtempSync(join(tmpBase, 'audit-gate-'));
  try {
    const configDir = join(root, 'config');
    mkdirSync(configDir);
    const configs = {
      user: join(configDir, 'user-npmrc'),
      global: join(configDir, 'global-npmrc'),
    };
    writeFileSync(configs.user, '');
    writeFileSync(configs.global, '');
    const npmEnv = controlledEnv(env);

    /** A folder holding only a package.json (with packageManager) and its lockfile. */
    const folder = (name, packageText, lockText) => {
      const dir = join(root, name);
      mkdirSync(dir);
      const pkg = JSON.parse(packageText);
      pkg.packageManager = packageManager;
      writeFileSync(
        join(dir, 'package.json'),
        `${JSON.stringify(pkg, null, 2)}\n`,
      );
      writeFileSync(join(dir, 'package-lock.json'), lockText);
      return dir;
    };
    const npm = (dir, args) =>
      run(withConfigs(args, configs), { cwd: dir, env: npmEnv });

    let canaryDir;
    let auditDir;
    try {
      canaryDir = folder(
        'canary',
        readFileSync(join(clientDir, CANARY_DIR, CANARY_PACKAGE), 'utf8'),
        readFileSync(join(clientDir, CANARY_DIR, CANARY_LOCK), 'utf8'),
      );
      auditDir = folder(
        'client',
        readFileSync(join(clientDir, 'package.json'), 'utf8'),
        readFileSync(join(clientDir, 'package-lock.json'), 'utf8'),
      );
    } catch (error) {
      return {
        failures: [
          `the gate's folders cannot be made from the client's files: ${String(error)}`,
        ],
        log,
      };
    }

    // One npm runs in every folder: the one packageManager names.
    const versionFailures = [];
    for (const [name, dir] of [
      ['canary', canaryDir],
      ['client', auditDir],
    ]) {
      const { stdout, ok } = npm(dir, ['--version']);
      const version = stdout.trim();
      log.push(
        `npm --version in the ${name} folder: ${version || '(nothing)'}`,
      );
      if (!ok) {
        versionFailures.push(
          `npm --version in the ${name} folder failed (it printed ${JSON.stringify(version)})`,
        );
      } else if (version !== wanted) {
        versionFailures.push(
          `npm --version in the ${name} folder printed ${JSON.stringify(version)}, but packageManager names ${wanted}`,
        );
      }
    }
    if (versionFailures.length) return { failures: versionFailures, log };

    const canaryFull = npm(canaryDir, FULL_AUDIT_ARGS).stdout;
    const canaryProd = npm(canaryDir, SHIPPED_AUDIT_ARGS).stdout;
    const canaryFailures = evaluateCanary(canaryFull, canaryProd);
    log.push(
      `canary: full audit ${totals(canaryFull)}; shipped audit ${totals(canaryProd)}`,
    );
    if (canaryFailures.length) return { failures: canaryFailures, log };
    log.push(
      `canary: the full audit reports ${CANARY_DEV_ONLY} and ${CANARY_SHIPPED}; the shipped audit reports ${CANARY_SHIPPED} and not ${CANARY_DEV_ONLY}`,
    );

    const fullText = npm(auditDir, FULL_AUDIT_ARGS).stdout;
    const prodText = npm(auditDir, SHIPPED_AUDIT_ARGS).stdout;
    log.push(`client: full audit ${totals(fullText)}`);
    log.push(`client: shipped audit ${totals(prodText)}`);
    const failures = evaluate({
      fullText,
      prodText,
      allowlistText,
      viewVersions: (pkg) => {
        const { stdout, ok } = npm(auditDir, [
          'view',
          pkg,
          'versions',
          '--json',
        ]);
        return ok ? stdout : null;
      },
    });
    return { failures, log };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Run npm and give its stdout, whatever its exit status. */
function runNpm(args, { cwd, env }) {
  const result = spawnSync('npm', args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    stdout: result.stdout ?? '',
    ok: result.error === undefined && result.status === 0,
  };
}

/**
 * The gate starts npm by name, which Windows cannot do (npm is `npm.cmd`
 * there), so on Windows it stops before anything else, with one line saying
 * where it runs (R533.4).
 */
export const WINDOWS_REFUSAL =
  'audit-gate.js does not run on Windows: it runs in CI (Client checks) and in a Linux cloud session (R533.4)';

function main() {
  if (process.platform === 'win32') {
    console.error(WINDOWS_REFUSAL);
    process.exit(1);
  }
  const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { failures, log } = runGate({
    clientDir,
    run: runNpm,
    env: process.env,
  });
  for (const line of log) console.log(line);
  if (failures.length) {
    console.error('Audit gate FAILED (R517.2, R524):');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    'Audit gate passed: no high or critical advisory outside audit-allowlist.json, and none that ships (R517.2, R524)',
  );
}

/**
 * Whether this module is the program Node was started with. Node runs the
 * real path of its main module, so the path it was given is resolved the same
 * way; a path that cannot be resolved is not this module.
 * @param {string | undefined} argv1
 * @param {string} moduleUrl
 */
export function isMain(argv1, moduleUrl) {
  if (!argv1) return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === moduleUrl;
  } catch {
    return false;
  }
}

if (isMain(process.argv[1], import.meta.url)) main();
