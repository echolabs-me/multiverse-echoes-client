import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import en from './locales/en.json';

/**
 * Supported locale codes. Keep this in sync with `config/default.toml`
 * `[translation] supported_locales`, the locale mapping in
 * `services/translation/server.py`, and the `languages` array in
 * `LanguageSelectionPage.tsx`.
 *
 * Adding a new language requires:
 *   1. A new JSON file in `./locales/` (picked up automatically by
 *      the `import.meta.glob` backend below)
 *   2. An entry in this array
 *   3. A row in `config.translation.supported_locales` (Rust)
 *   4. A row in `LOCALE_TO_LANGUAGE` (Python sidecar)
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part B.
 */
export const SUPPORTED_LOCALES = [
  'en', 'zh-Hans', 'zh-Hant', 'hi', 'es', 'ar', 'fr',
  'bn', 'pt-BR', 'ru', 'ur', 'id', 'de',
  'ja', 'vi', 'tr', 'ko', 'tl', 'it', 'th', 'ms',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Locales that need right-to-left document direction. */
export const RTL_LOCALES: readonly SupportedLocale[] = ['ar', 'ur'];

/**
 * Match a leading locale segment in the URL pathname.
 * Matches 2-letter codes (en, es, fr, …) and script-qualified codes
 * (zh-Hans, zh-Hant, pt-BR, …). Exported for use by LocaleRoute + the
 * language switcher so every piece of path-locale logic uses one regex.
 */
export const LOCALE_PATH_PATTERN = /^\/([a-z]{2}(?:-[A-Za-z]+)?)(?:\/|$)/;

/**
 * Lazy loaders for every non-English locale bundle.
 *
 * English is imported statically above so first-paint for en users has
 * zero async gap (and the bundle includes it as the sync fallback).
 * Every other locale is split into its own chunk by Vite's dynamic-import
 * code-splitting and fetched over HTTP when the user (or prerender)
 * requests a non-English language for the first time.
 *
 * Net impact on main bundle: drops roughly 1.4 MB uncompressed / 300 KB
 * gzipped that was previously eager-loaded for every visitor regardless
 * of whether they'd ever switch languages. English visitors now pay only
 * for their own locale; each other locale loads on-demand in <200 ms on
 * a cold cache over a typical connection.
 */
const localeLoaders = import.meta.glob('./locales/*.json') as Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
>;

/**
 * Resolve the initial locale at bootstrap time. Priority:
 *   1. URL path prefix (`/es/home` -> `es`) — canonical for path-based i18n
 *   2. `?lng=xx` query string — legacy backward-compat for old links
 *   3. `localStorage.locale` — remembered choice from previous visit
 *   4. English fallback
 */
function resolveInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  const pathMatch = window.location.pathname.match(LOCALE_PATH_PATTERN);
  if (pathMatch && (SUPPORTED_LOCALES as readonly string[]).includes(pathMatch[1])) {
    // Persist so deep-link users don't re-enter the flag page on later visits.
    localStorage.setItem('locale', pathMatch[1]);
    localStorage.setItem('locale_selected', 'true');
    return pathMatch[1] as SupportedLocale;
  }
  const param = new URLSearchParams(window.location.search).get('lng');
  if (param && (SUPPORTED_LOCALES as readonly string[]).includes(param)) {
    localStorage.setItem('locale', param);
    return param as SupportedLocale;
  }
  const stored = localStorage.getItem('locale');
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as SupportedLocale;
  }
  return 'en';
}

/**
 * Apply document-level direction + lang attributes for the active locale.
 * Called at bootstrap and on every `languageChanged` event so `<html dir>`
 * and `<html lang>` always match what i18next is serving.
 *
 * Arabic and Urdu flip the page to RTL via `dir="rtl"`. CSS logical properties
 * (`margin-inline-start`, etc.) + Tailwind logical variants (`ms-*`, `me-*`,
 * `ps-*`, `pe-*`, `start-*`, `end-*`) automatically mirror for RTL without
 * any conditional classname logic. Reference: CC TASK 4 Part D Step 10.
 */
function applyDocumentDirection(locale: string): void {
  if (typeof document === 'undefined') return; // No-op under SSR (prerender).
  const html = document.documentElement;
  const isRtl = (RTL_LOCALES as readonly string[]).includes(locale);
  html.dir = isRtl ? 'rtl' : 'ltr';
  html.lang = locale;
}

void i18n
  // English stays in the eager `resources` map so `lng: 'en'` has content
  // available synchronously and English users see zero async locale load.
  // Non-English locales are fetched via the backend below on first use.
  .use(
    resourcesToBackend(async (language: string, namespace: string) => {
      if (namespace !== 'translation') return {};
      const key = `./locales/${language}.json`;
      const loader = localeLoaders[key];
      if (!loader) {
        throw new Error(`i18n: locale bundle not found at ${key}`);
      }
      const mod = await loader();
      return mod.default;
    }),
  )
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: resolveInitialLocale(),
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LOCALES],
    // Treat `en` as already-loaded so i18next doesn't try to call the
    // backend for it (the backend would succeed but it's wasted IO).
    partialBundledLanguages: true,
    // Load base language without region suffix — `zh-Hans` is treated as its
    // own key (Simplified vs Traditional is a script distinction, not a
    // region one).
    nonExplicitSupportedLngs: false,
    interpolation: {
      escapeValue: false,
    },
    // Suppress the "i18next is made possible by our own product, Locize..."
    // promotional banner that i18next prints to the console on every page load.
    // Verified as an official opt-out in i18next v25 source:
    //   node_modules/i18next/dist/esm/i18next.js:1790
    //     if (this.options.showSupportNotice !== false && ...)
    showSupportNotice: false,
  });

// Apply initial direction + lang immediately so the first paint is correct
// (not the default `<html lang="en">` from index.html).
applyDocumentDirection(i18n.language);

// Keep <html dir/lang> in sync whenever the user switches locale via the
// settings page, onboarding selector, or any other changeLanguage() call.
i18n.on('languageChanged', (newLocale: string) => {
  applyDocumentDirection(newLocale);
});

// Expose a locale-ready signal on the window so the Playwright prerender
// can `waitForFunction(() => window.__i18nLocaleReady === 'es')` before
// capturing HTML — guaranteeing the dynamic locale chunk has loaded and
// applied before the snapshot. No-ops under SSR.
if (typeof window !== 'undefined') {
  (window as unknown as { __i18nLocaleReady?: string }).__i18nLocaleReady =
    i18n.hasResourceBundle(i18n.language, 'translation') ? i18n.language : undefined;
  i18n.on('loaded', () => {
    const cur = i18n.language;
    if (i18n.hasResourceBundle(cur, 'translation')) {
      (window as unknown as { __i18nLocaleReady?: string }).__i18nLocaleReady = cur;
    }
  });
  i18n.on('languageChanged', (lng: string) => {
    if (i18n.hasResourceBundle(lng, 'translation')) {
      (window as unknown as { __i18nLocaleReady?: string }).__i18nLocaleReady = lng;
    }
  });
}

export default i18n;
