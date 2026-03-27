/**
 * Tier/Enum consistency tests.
 *
 * Ensures that runtime lookup objects keyed by SubscriptionTier values
 * stay in sync with the SubscriptionTier type. Catches the class of bug
 * where a tier is renamed in the type but not in all lookup objects
 * (health scan Fix 1: Basic/Pro/Enterprise vs Core/Creator/GodMode).
 *
 * Since the lookup objects (TIER_LIMITS, RATE_LIMITS) are not exported
 * from their component files, we read the source files and verify the
 * keys via regex. This is intentionally brittle — if the pattern changes,
 * the test fails and forces a review.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Canonical tier values — must match SubscriptionTier type in types/api.ts.
const SUBSCRIPTION_TIERS = ['Free', 'Core', 'Creator', 'GodMode'] as const;

/**
 * Extract top-level Record keys from a source file for a given variable name.
 * Looks for patterns like: `const NAME: Record<string, ...> = { Key1: ..., Key2: ... };`
 * Handles nested braces correctly by tracking brace depth.
 */
function extractRecordKeys(filePath: string, varName: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Find the start of the object literal.
  const startPattern = new RegExp(
    `const\\s+${varName}\\s*:\\s*Record<[^>]+>\\s*=\\s*\\{`,
  );
  const startMatch = startPattern.exec(content);
  if (!startMatch) {
    throw new Error(`Could not find ${varName} in ${filePath}`);
  }

  // Walk forward from the opening brace, tracking depth.
  const startIdx = startMatch.index + startMatch[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    i++;
  }
  const body = content.slice(startIdx, i - 1);

  // Extract only top-level keys (at depth 0 within the body).
  // Top-level keys appear at the start of lines or after commas at depth 0.
  const keys: string[] = [];
  let innerDepth = 0;
  const keyPattern = /(\w+)\s*:/g;
  let m;
  while ((m = keyPattern.exec(body)) !== null) {
    // Count braces before this match to determine depth.
    innerDepth = 0;
    for (let j = 0; j < m.index; j++) {
      if (body[j] === '{') innerDepth++;
      else if (body[j] === '}') innerDepth--;
    }
    if (innerDepth === 0) {
      keys.push(m[1]);
    }
  }
  return keys;
}

/** Verify the SubscriptionTier type in api.ts has exactly the expected values. */
function extractSubscriptionTierValues(): string[] {
  // Generated types are now the source of truth for enum definitions
  const generatedPath = path.resolve(__dirname, '../src/types/generated.ts');
  const content = fs.readFileSync(generatedPath, 'utf-8');

  // Match: export type SubscriptionTier = "Free" | "Core" | "Creator" | "GodMode";
  const match = content.match(
    /export\s+type\s+SubscriptionTier\s*=\s*([^;]+);/,
  );
  if (!match) {
    throw new Error('Could not find SubscriptionTier type definition');
  }

  // Extract the quoted values.
  const values: string[] = [];
  const valuePattern = /["'](\w+)["']/g;
  let m;
  while ((m = valuePattern.exec(match[1])) !== null) {
    values.push(m[1]);
  }
  return values;
}

describe('SubscriptionTier type definition', () => {
  it('has exactly the expected tier values', () => {
    const actual = extractSubscriptionTierValues();
    expect(actual).toEqual([...SUBSCRIPTION_TIERS]);
  });
});

describe('Tier-keyed lookup consistency', () => {
  const srcDir = path.resolve(__dirname, '../src');

  it('TIER_LIMITS in EchoConversationPage has all tier keys', () => {
    const filePath = path.join(srcDir, 'pages/EchoConversationPage.tsx');
    const keys = extractRecordKeys(filePath, 'TIER_LIMITS');
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(keys, `Missing tier key '${tier}' in TIER_LIMITS`).toContain(
        tier,
      );
    }
    // No extra keys allowed.
    for (const key of keys) {
      expect(
        (SUBSCRIPTION_TIERS as readonly string[]).includes(key),
        `Unknown tier key '${key}' in TIER_LIMITS`,
      ).toBe(true);
    }
  });

  it('RATE_LIMITS in OraclePanel has all tier keys', () => {
    const filePath = path.join(srcDir, 'components/OraclePanel.tsx');
    const keys = extractRecordKeys(filePath, 'RATE_LIMITS');
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(keys, `Missing tier key '${tier}' in RATE_LIMITS`).toContain(
        tier,
      );
    }
    for (const key of keys) {
      expect(
        (SUBSCRIPTION_TIERS as readonly string[]).includes(key),
        `Unknown tier key '${key}' in RATE_LIMITS`,
      ).toBe(true);
    }
  });

  it('RATE_LIMITS in OracleSidebar has all tier keys', () => {
    const filePath = path.join(srcDir, 'components/OracleSidebar.tsx');
    const keys = extractRecordKeys(filePath, 'RATE_LIMITS');
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(keys, `Missing tier key '${tier}' in RATE_LIMITS`).toContain(
        tier,
      );
    }
    for (const key of keys) {
      expect(
        (SUBSCRIPTION_TIERS as readonly string[]).includes(key),
        `Unknown tier key '${key}' in RATE_LIMITS`,
      ).toBe(true);
    }
  });
});
