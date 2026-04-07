import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';
import hi from './locales/hi.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import bn from './locales/bn.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import ur from './locales/ur.json';
import id from './locales/id.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import vi from './locales/vi.json';
import tr from './locales/tr.json';
import ko from './locales/ko.json';
import tl from './locales/tl.json';
import it from './locales/it.json';
import th from './locales/th.json';
import ms from './locales/ms.json';

/**
 * Supported locale codes. Keep this in sync with `config/default.toml`
 * `[translation] supported_locales`, the locale mapping in
 * `services/translation/server.py`, and the `languages` array in
 * `LanguageSelectionPage.tsx`.
 *
 * Adding a new language requires:
 *   1. A new JSON file in `./locales/`
 *   2. An entry here + the `resources` map below
 *   3. A row in `config.translation.supported_locales` (Rust)
 *   4. A row in `LOCALE_TO_LANGUAGE` (Python sidecar)
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part B.
 */
export const SUPPORTED_LOCALES = [
  'en', 'zh-Hans', 'hi', 'es', 'ar', 'fr',
  'bn', 'pt-BR', 'ru', 'ur', 'id', 'de',
  'ja', 'vi', 'tr', 'ko', 'tl', 'it', 'th', 'ms',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Locales that need right-to-left document direction. */
export const RTL_LOCALES: readonly SupportedLocale[] = ['ar', 'ur'];

/**
 * Resolve the initial locale from localStorage, falling back to English.
 * Guards against stale/invalid values left over from an earlier schema.
 */
function resolveInitialLocale(): SupportedLocale {
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
  const html = document.documentElement;
  const isRtl = (RTL_LOCALES as readonly string[]).includes(locale);
  html.dir = isRtl ? 'rtl' : 'ltr';
  html.lang = locale;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-Hans': { translation: zhHans },
    hi: { translation: hi },
    es: { translation: es },
    ar: { translation: ar },
    fr: { translation: fr },
    bn: { translation: bn },
    'pt-BR': { translation: ptBR },
    ru: { translation: ru },
    ur: { translation: ur },
    id: { translation: id },
    de: { translation: de },
    ja: { translation: ja },
    vi: { translation: vi },
    tr: { translation: tr },
    ko: { translation: ko },
    tl: { translation: tl },
    it: { translation: it },
    th: { translation: th },
    ms: { translation: ms },
  },
  lng: resolveInitialLocale(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LOCALES],
  // Load base language without region suffix — `zh-Hans` is treated as its own
  // key (Simplified vs Traditional is a script distinction, not a region one).
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

export default i18n;
