import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  SUPPORTED_LOCALES,
  LOCALE_PATH_PATTERN,
  type SupportedLocale,
} from '../../i18n.ts';
import { trackEvent } from '../../lib/analytics.ts';

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

/** Strip a leading locale prefix from a pathname, returning the base route.
 *  `/es/home` -> `/home`; `/zh-Hant/plans/` -> `/plans/`; `/home` -> `/home`. */
function stripLocale(pathname: string): string {
  const m = pathname.match(LOCALE_PATH_PATTERN);
  if (m && (SUPPORTED_LOCALES as readonly string[]).includes(m[1])) {
    const consumed = m[0].endsWith('/')
      ? m[0].slice(0, -1).length
      : m[0].length;
    return pathname.slice(consumed) || '/';
  }
  return pathname || '/';
}

/** Build the locale-prefixed equivalent of a base path. English is unprefixed. */
function localizedPath(base: string, locale: SupportedLocale): string {
  if (locale === 'en') return base;
  return `/${locale}${base.startsWith('/') ? base : `/${base}`}`;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁體中文' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'es', name: 'Español' },
  { code: 'ar', name: 'العربية' },
  { code: 'fr', name: 'Français' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'pt-BR', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ur', name: 'اردو' },
  { code: 'id', name: 'Bahasa' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ko', name: '한국어' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'it', name: 'Italiano' },
  { code: 'th', name: 'ไทย' },
  { code: 'ms', name: 'Melayu' },
];

interface LanguageSwitcherProps {
  onSelect?: () => void;
}

export function LanguageSwitcher({ onSelect }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  const selectLanguage = (code: SupportedLocale) => {
    const oldLocale = i18n.language;
    localStorage.setItem('locale', code);
    localStorage.setItem('locale_selected', 'true');
    setCookie('locale', code);
    trackEvent('account.locale_changed', { old_locale: oldLocale, new_locale: code });

    // Change language BEFORE navigating so the destination paints in the new
    // language immediately (otherwise LocaleRoute's effect fires one render
    // later and flashes the previous locale).
    if (oldLocale !== code) {
      void i18n.changeLanguage(code);
    }

    const base = stripLocale(pathname);
    navigate(`${localizedPath(base, code)}${search}${hash}`);
    onSelect?.();
  };

  return (
    <div className="grid max-h-64 min-w-[11rem] grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-(--border) bg-(--surface) p-2 shadow-lg">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onPointerDown={(e) => { e.preventDefault(); selectLanguage(lang.code as SupportedLocale); }}
          className={`w-full rounded-md px-3 py-1.5 text-start text-xs transition-colors ${
            i18n.language === lang.code
              ? 'bg-(--accent-subtle) text-(--accent)'
              : 'text-(--text-secondary) hover:bg-(--surface-raised) hover:text-(--text-primary)'
          }`}
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
}
