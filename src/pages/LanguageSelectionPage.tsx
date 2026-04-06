import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../lib/analytics.ts';

interface Language {
  code: string;
  /** ISO 3166-1 alpha-2 country code for flag image lookup */
  countryCode: string;
  nativeName: string;
}

// The 6 live languages. `code` must match i18n.ts SUPPORTED_LOCALES,
// config.translation.supported_locales, and the sidecar's LOCALE_TO_LANGUAGE.
// `countryCode` maps to flagcdn.com SVG flags (lowercase ISO 3166-1 alpha-2).
const languages: Language[] = [
  { code: 'en', countryCode: 'gb', nativeName: 'English' },
  { code: 'zh-Hans', countryCode: 'cn', nativeName: '简体中文' },
  { code: 'hi', countryCode: 'in', nativeName: 'हिन्दी' },
  { code: 'es', countryCode: 'es', nativeName: 'Español' },
  { code: 'ar', countryCode: 'sa', nativeName: 'العربية' },
  { code: 'fr', countryCode: 'fr', nativeName: 'Français' },
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4">
      {/* Radial glow behind grid — matches hero-glow from landing page */}
      <div
        className="pointer-events-none fixed top-[40%] left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(212,145,92,0.08) 0%, transparent 70%)',
          animation: 'me-hero-breathe 8s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <h1
          className="mb-2 text-center font-serif text-4xl font-light tracking-[0.14em] text-[#E8E0D8]"
          style={{ animation: 'me-fade-up 1.2s ease-out both' }}
        >
          MULTIVERSE ECHOES
        </h1>
        <p
          className="mb-12 text-center font-serif text-lg font-light tracking-wide text-[#9BA5AE]"
          style={{ animation: 'me-fade-up 1.2s ease-out 0.15s both' }}
        >
          Choose your language&ensp;&middot;&ensp;选择语言&ensp;&middot;&ensp;भाषा चुनें
        </p>

        {/* Language grid */}
        <div
          className="grid w-full max-w-xl grid-cols-2 gap-4 sm:grid-cols-3"
          role="listbox"
          aria-label="Language selection"
          style={{ animation: 'me-fade-up 1.2s ease-out 0.3s both' }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={false}
              onClick={() => selectLanguage(lang.code)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-[rgba(212,145,92,0.15)] bg-[rgba(212,145,92,0.08)] px-6 py-6 text-center transition-all duration-300 hover:border-[#D4915C] hover:shadow-[0_0_30px_rgba(212,145,92,0.12)] active:scale-[0.97]"
            >
              <img
                src={`https://flagcdn.com/${lang.countryCode}.svg`}
                alt=""
                aria-hidden="true"
                className="h-12 w-12 rounded-full object-cover transition-transform duration-200 group-hover:scale-110"
                draggable={false}
              />
              <span className="font-serif text-xl font-medium text-[#E8E0D8]">
                {lang.nativeName}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Breathe animation for the glow */}
      <style>{`
        @keyframes me-hero-breathe {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
