import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../components/index.ts';

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
      void i18n.changeLanguage(code);
      localStorage.setItem('locale', code);
      localStorage.setItem('locale_selected', 'true');
      navigate('/register');
    },
    [i18n, navigate],
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      {/* Echo silhouette — static 2D illustration */}
      <div className="relative mb-12 flex items-center justify-center" aria-hidden="true">
        <svg
          width="120"
          height="160"
          viewBox="0 0 120 160"
          className="text-accent opacity-30"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          {/* Stylised Echo silhouette with parallel lines motif */}
          <ellipse cx="60" cy="40" rx="28" ry="32" />
          <path d="M38 65 Q40 90 35 130 Q34 145 50 155 L70 155 Q86 145 85 130 Q80 90 82 65" />
          {/* Parallel lines motif */}
          <line x1="45" y1="80" x2="75" y2="80" strokeOpacity="0.5" />
          <line x1="43" y1="95" x2="77" y2="95" strokeOpacity="0.4" />
          <line x1="41" y1="110" x2="79" y2="110" strokeOpacity="0.3" />
          <line x1="43" y1="125" x2="77" y2="125" strokeOpacity="0.2" />
        </svg>
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
