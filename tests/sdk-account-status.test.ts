/**
 * The hand-kept SDK's AccountStatus carries every value the server returns
 * (R153).
 *
 * `packages/sdk` is mirrored to the public client repository, and nothing
 * else CI runs checks it: `tsconfig.app.json` includes only `src`, and vitest
 * does not typecheck. So this test reads both files' source and compares the
 * members of the two unions.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const GENERATED = path.resolve(__dirname, '../src/types/generated.ts');
const SDK = path.resolve(__dirname, '../packages/sdk/src/types.ts');

const LITERAL = /(["'])(.*?)\1/g;

/**
 * The string-literal members of `export type <name> = ...;` in a source file,
 * sorted. Block comments inside the union are dropped first: generated.ts puts
 * a variant's doc comment between its `|` and its literal. Throws when the
 * declaration is missing, has no members, or holds anything but string
 * literals joined by `|`, so an empty or partial parse cannot pass.
 */
function unionMembers(file: string, name: string): string[] {
  const source = fs.readFileSync(file, 'utf-8');
  const head = `export type ${name} =`;
  const start = source.indexOf(head);
  if (start < 0) {
    throw new Error(`no \`${head}\` in ${file}`);
  }
  const body = source
    .slice(start + head.length)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')[0];
  const members = [...body.matchAll(LITERAL)].map((m) => m[2]);
  const rest = body.replace(LITERAL, '').replace(/\|/g, '').trim();
  if (members.length === 0 || rest !== '') {
    throw new Error(`${name} in ${file} is not a union of string literals: ${body.trim()}`);
  }
  return members.sort();
}

describe('SDK AccountStatus', () => {
  it('reads the doc-commented member of the generated union', () => {
    // "Purging" is the member generated.ts places after a doc comment.
    expect(unionMembers(GENERATED, 'AccountStatus')).toContain('Purging');
  });

  it('lists exactly the values of the generated AccountStatus', () => {
    expect(unionMembers(SDK, 'AccountStatus')).toEqual(unionMembers(GENERATED, 'AccountStatus'));
  });
});
