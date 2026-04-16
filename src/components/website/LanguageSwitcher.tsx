import { useTranslation } from 'react-i18next';
import { trackEvent } from '../../lib/analytics.ts';

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh-Hans', name: '简体中文' },
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

  const selectLanguage = (code: string) => {
    const oldLocale = i18n.language;
    void i18n.changeLanguage(code);
    localStorage.setItem('locale', code);
    localStorage.setItem('locale_selected', 'true');
    setCookie('locale', code);
    trackEvent('account.locale_changed', { old_locale: oldLocale, new_locale: code });
    onSelect?.();
  };

  return (
    <div className="grid max-h-64 min-w-[11rem] grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => selectLanguage(lang.code)}
          className={`w-full rounded-md px-3 py-1.5 text-start text-xs transition-colors ${
            i18n.language === lang.code
              ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
          }`}
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
}
