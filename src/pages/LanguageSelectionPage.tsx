import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../lib/analytics.ts';

interface Language {
  code: string;
  flag: string;
  nativeName: string;
}

// The 6 live languages. `code` must match i18n.ts SUPPORTED_LOCALES,
// config.translation.supported_locales, and the sidecar's LOCALE_TO_LANGUAGE.
const languages: Language[] = [
  { code: 'en', flag: '🇬🇧', nativeName: 'English' },
  { code: 'zh-Hans', flag: '🇨🇳', nativeName: '简体中文' },
  { code: 'hi', flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'ar', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français' },
];

export function LanguageSelectionPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const selectLanguage = useCallback(
    (code: string) => {
      const oldLocale = i18n.language;
      void i18n.changeLanguage(code);
      localStorage.setItem('locale', code);
      localStorage.setItem('locale_selected', 'true');
      trackEvent('account.locale_changed', { old_locale: oldLocale, new_locale: code });
      navigate('/register');
    },
    [i18n, navigate],
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      {/* Welcome greeting in multiple languages — universally understood */}
      <h1 className="mb-2 text-center text-3xl font-bold text-text-primary">
        Welcome to Multiverse Echoes
      </h1>
      <p className="mb-12 text-center text-base text-text-secondary">
        Choose your language&ensp;·&ensp;选择语言&ensp;·&ensp;भाषा चुनें
      </p>

      {/* Language grid — large tappable cards with flags */}
      <div
        className="grid w-full max-w-xl grid-cols-2 gap-4 sm:grid-cols-3"
        role="listbox"
        aria-label="Language selection"
      >
        {languages.map((lang) => (
          <button
            key={lang.code}
            role="option"
            aria-selected={false}
            onClick={() => selectLanguage(lang.code)}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-6 text-center transition-all duration-200 hover:border-accent hover:bg-surface-raised hover:shadow-lg hover:shadow-accent/10 active:scale-[0.97]"
          >
            <span className="text-5xl leading-none transition-transform duration-200 group-hover:scale-110" role="img" aria-hidden="true">
              {lang.flag}
            </span>
            <span className="text-lg font-semibold text-text-primary">
              {lang.nativeName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
