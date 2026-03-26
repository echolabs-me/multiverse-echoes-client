import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Tooltip } from '../components/index.ts';
import { trackEvent } from '../lib/analytics.ts';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  available: boolean;
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', available: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', available: false },
  { code: 'fr', name: 'French', nativeName: 'Français', available: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', available: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', available: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', available: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', available: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', available: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', available: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', available: false },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', available: false },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', available: false },
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
      {/* Globe icon */}
      <div className="relative mb-12 flex items-center justify-center" aria-hidden="true">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
          <Globe size={40} className="text-accent" strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-text-primary">
        Choose your language
      </h1>
      <p className="mb-10 text-sm text-text-secondary">
        More languages coming soon
      </p>

      {/* Language grid */}
      <div
        className="grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3"
        role="listbox"
        aria-label="Language selection"
      >
        {languages.map((lang) =>
          lang.available ? (
            <button
              key={lang.code}
              role="option"
              aria-selected={false}
              onClick={() => selectLanguage(lang.code)}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface px-4 py-4 text-center transition-colors hover:border-accent hover:bg-surface-raised"
            >
              <span className="text-base font-medium text-text-primary">
                {lang.nativeName}
              </span>
              <span className="text-xs text-text-muted">{lang.name}</span>
            </button>
          ) : (
            <Tooltip key={lang.code} content="Coming soon" position="top">
              <div
                role="option"
                aria-selected={false}
                aria-disabled="true"
                className="flex w-full flex-col items-center gap-1 rounded-lg border border-border/50 bg-surface/50 px-4 py-4 text-center opacity-40"
              >
                <span className="text-base font-medium text-text-primary">
                  {lang.nativeName}
                </span>
                <span className="text-xs text-text-muted">{lang.name}</span>
              </div>
            </Tooltip>
          ),
        )}
      </div>
    </div>
  );
}
