import { describe, it, expect } from 'vitest';
import type { UseInfluenceRequest } from '../src/types/api.ts';

/**
 * Phase 6B Smoke Test Fix — B8: Nudge field name regression test.
 *
 * Verifies that UseInfluenceRequest uses 'suggestion' (matching the Rust
 * InfluenceRequest struct) rather than the old 'details' field name.
 */

describe('UseInfluenceRequest', () => {
  it('sends suggestion field matching server InfluenceRequest', () => {
    const request: UseInfluenceRequest = {
      influence_type: 'nudge',
      suggestion: 'Try talking to someone today.',
    };

    const body = JSON.stringify(request);
    const parsed = JSON.parse(body) as Record<string, unknown>;

    // Must have 'suggestion' key (matching Rust InfluenceRequest)
    expect(parsed).toHaveProperty('suggestion', 'Try talking to someone today.');
    expect(parsed).toHaveProperty('influence_type', 'nudge');

    // Must NOT have the old 'details' key
    expect(parsed).not.toHaveProperty('details');
  });

  it('serialises correctly for POST body', () => {
    const request: UseInfluenceRequest = {
      influence_type: 'suggest_activity',
      suggestion: 'Go explore the market district.',
    };

    const body = JSON.stringify(request);
    expect(body).toContain('"suggestion"');
    expect(body).not.toContain('"details"');
  });
});
