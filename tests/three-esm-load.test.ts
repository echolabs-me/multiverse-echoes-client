// The 3D renderer loads three as an ES module under Vitest, as it does in the
// production build: its CommonJS build `require("three")`s, which three
// deprecates from 0.186 on (0.187 too) with a THREE_CJS_DEPRECATED warning (vitest.config.ts,
// `resolve.mainFields`).
import { afterEach, expect, it } from 'vitest';

const seen: string[] = [];
const listener = (warning: Error & { code?: string }) => {
  if (warning.code) seen.push(warning.code);
};

afterEach(() => {
  process.off('warning', listener);
});

it('loads the 3D renderer without requiring three through CommonJS', async () => {
  // Under --no-deprecation Node emits no deprecation warning at all, and this
  // test would pass without looking.
  expect(process.noDeprecation).not.toBe(true);
  process.on('warning', listener);
  const fiber = await import('@react-three/fiber');
  expect(typeof fiber.Canvas).toBe('function');
  // process.emitWarning delivers on the next tick.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(seen).not.toContain('THREE_CJS_DEPRECATED');
});
