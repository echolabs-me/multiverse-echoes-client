import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

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
