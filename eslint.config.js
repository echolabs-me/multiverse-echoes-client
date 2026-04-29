import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Canonical-form enforcement level for the better-tailwindcss rules.
// Bumped from 'warn' to 'error' in the cleanup commit (2026-04-21)
// once `eslint --fix` brought the codebase to zero violations. Every
// rule below is in the plugin's `recommended` preset. Future
// canonical-form regressions now fail `npm run lint` at the hook.
const TAILWIND_LEVEL = 'error';

export default defineConfig([
  globalIgnores(['dist', 'src-tauri']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: {
      'better-tailwindcss': betterTailwind,
    },
    settings: {
      'better-tailwindcss': {
        // v4-native — the plugin walks the compiled Tailwind CSS file
        // to know which classes exist and which are canonical. Path is
        // resolved relative to each linted file.
        entryPoint: 'src/styles/global.css',
        // Required to make `enforce-canonical-classes` collapse
        // px-expressed arbitrary values into the spacing scale
        // (e.g. `max-h-[120px]` -> `max-h-30`). Without this, Tailwind's
        // canonicalizer only handles rem-expressed values and named
        // aliases (`h-[100vh]` -> `h-screen`), matching the gap we hit
        // against IntelliSense's suggestCanonicalClasses.
        rootFontSize: 16,
      },
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-console': 'error',

      // ── Tailwind canonical-form enforcement ─────────────────────
      'better-tailwindcss/enforce-canonical-classes': TAILWIND_LEVEL,
      'better-tailwindcss/enforce-consistent-class-order': TAILWIND_LEVEL,
      'better-tailwindcss/enforce-consistent-important-position': TAILWIND_LEVEL,
      'better-tailwindcss/enforce-consistent-variable-syntax': TAILWIND_LEVEL,
      'better-tailwindcss/enforce-consistent-variant-order': TAILWIND_LEVEL,
      'better-tailwindcss/enforce-logical-properties': TAILWIND_LEVEL,
      'better-tailwindcss/enforce-shorthand-classes': TAILWIND_LEVEL,
      'better-tailwindcss/no-conflicting-classes': TAILWIND_LEVEL,
      'better-tailwindcss/no-deprecated-classes': TAILWIND_LEVEL,
      'better-tailwindcss/no-duplicate-classes': TAILWIND_LEVEL,
      'better-tailwindcss/no-unnecessary-whitespace': TAILWIND_LEVEL,
      // `no-unknown-classes` is deliberately OFF — the project ships
      // custom helper classes in src/styles/global.css (see the
      // `no-restricted-syntax: style` comment below for context) that
      // the plugin's class-registry walk cannot see without a full
      // Tailwind compile. Turning it on today produces false positives
      // on every helper class. Revisit after a global.css audit.
      'better-tailwindcss/no-unknown-classes': 'off',

      // Inline `style={...}` attributes are forbidden: they (a) bake into
      // pre-rendered HTML and violate strict CSP `style-src` (no
      // 'unsafe-inline'), and (b) bypass the design-system tokens. Use
      // Tailwind utility classes, helper classes in client/src/styles/global.css,
      // or CSS custom properties set via callback refs for dynamic values.
      // See the Phase 6D cleanup commit 962bde7 for the conversion patterns.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            "Inline `style={...}` is forbidden (CSP style-src: no 'unsafe-inline'). Use a Tailwind class, a helper class in global.css, or a callback ref that calls element.style.setProperty for dynamic values.",
        },
      ],
    },
  },
  {
    // Playwright test harness runs under Node and uses console for test diagnostics.
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
]);
