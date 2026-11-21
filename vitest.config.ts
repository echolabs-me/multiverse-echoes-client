import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer a package's ES module build (`module`) over its CommonJS `main`,
    // as the production build does. The 3D renderer has no `exports` map, so
    // without this its CommonJS build loads and `require("three")`s, which
    // three deprecates from 0.186 on (THREE_CJS_DEPRECATED; 0.187 too).
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
