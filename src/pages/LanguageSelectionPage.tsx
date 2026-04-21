import { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../lib/analytics.ts';
import type { SupportedLocale } from '../i18n.ts';

/**
 * Apply the user's locale choice to a desired destination path.
 * English stays unprefixed (`/home`); every other supported locale gets a
 * leading `/{locale}` prefix (`/es/home`, `/zh-Hant/plans`, …).
 */
function applyLocalePrefix(path: string, locale: SupportedLocale): string {
  if (locale === 'en') return path;
  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
}

interface Language {
  code: string;
  /** ISO 3166-1 alpha-2 country code for flag image lookup */
  countryCode: string;
  nativeName: string;
}

// 20 live languages. `code` must match i18n.ts SUPPORTED_LOCALES,
// config.translation.supported_locales, and the sidecar's LOCALE_TO_LANGUAGE.
// `countryCode` maps to a local SVG at /flags/{cc}.svg. Flag assets were
// downloaded from flagcdn.com (CC0 Public Domain) so we ship them ourselves
// rather than depend on a third-party host — keeps img-src tight and
// removes a supply-chain surface.
const languages: Language[] = [
  { code: 'en', countryCode: 'gb', nativeName: 'English' },
  { code: 'zh-Hans', countryCode: 'cn', nativeName: '简体中文' },
  { code: 'zh-Hant', countryCode: 'hk', nativeName: '繁體中文' },
  { code: 'hi', countryCode: 'in', nativeName: 'हिन्दी' },
  { code: 'es', countryCode: 'es', nativeName: 'Español' },
  { code: 'ar', countryCode: 'sa', nativeName: 'العربية' },
  { code: 'fr', countryCode: 'fr', nativeName: 'Français' },
  { code: 'bn', countryCode: 'bd', nativeName: 'বাংলা' },
  { code: 'pt-BR', countryCode: 'br', nativeName: 'Português' },
  { code: 'ru', countryCode: 'ru', nativeName: 'Русский' },
  { code: 'ur', countryCode: 'pk', nativeName: 'اردو' },
  { code: 'id', countryCode: 'id', nativeName: 'Bahasa' },
  { code: 'de', countryCode: 'de', nativeName: 'Deutsch' },
  { code: 'ja', countryCode: 'jp', nativeName: '日本語' },
  { code: 'vi', countryCode: 'vn', nativeName: 'Tiếng Việt' },
  { code: 'tr', countryCode: 'tr', nativeName: 'Türkçe' },
  { code: 'ko', countryCode: 'kr', nativeName: '한국어' },
  { code: 'tl', countryCode: 'ph', nativeName: 'Tagalog' },
  { code: 'it', countryCode: 'it', nativeName: 'Italiano' },
  { code: 'th', countryCode: 'th', nativeName: 'ไทย' },
  { code: 'ms', countryCode: 'my', nativeName: 'Melayu' },
];

/** Check if user prefers reduced motion. */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function LanguageSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [useGrid, setUseGrid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect touch device and small screens
  useEffect(() => {
    const checkTouch = () => setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const checkSize = () => setUseGrid(window.innerWidth < 640);
    checkTouch();
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const selectLanguage = useCallback(
    (code: string) => {
      const oldLocale = i18n.language;
      void i18n.changeLanguage(code);
      localStorage.setItem('locale', code);
      localStorage.setItem('locale_selected', 'true');
      document.cookie = `locale=${code};path=/;max-age=31536000;SameSite=Lax`;
      trackEvent('account.locale_changed', { old_locale: oldLocale, new_locale: code });
      // Respect an explicit `?redirect=` (used by pass-through sign-in flows)
      // otherwise default to the locale-prefixed home: English stays at
      // `/home`, every other supported locale lives at `/{locale}/home`.
      const redirectParam = searchParams.get('redirect');
      const target = redirectParam ?? applyLocalePrefix('/home', code as SupportedLocale);
      navigate(target);
    },
    [i18n, navigate, searchParams],
  );

  const handleClick = useCallback(
    (code: string) => {
      if (isTouch) {
        // Touch: first tap expands, second tap confirms
        if (expandedCode === code) {
          selectLanguage(code);
        } else {
          setExpandedCode(code);
        }
      } else {
        selectLanguage(code);
      }
    },
    [isTouch, expandedCode, selectLanguage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, code: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectLanguage(code);
      }
    },
    [selectLanguage],
  );

  const reduced = prefersReducedMotion();

  const animClass = reduced ? 'me-anim-none' : '';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4">
      {/* Radial glow behind centre — matches hero-glow from landing page */}
      <div
        className={`me-hero-glow-soft pointer-events-none fixed inset-s-1/2 inset-bs-[40%] size-[600px] -translate-1/2 rounded-full ${animClass}`}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Centre text */}
        <h1
          className={`me-fade-up mbe-2 text-center font-serif text-4xl font-light tracking-[0.14em] text-[#E8E0D8] ${animClass}`}
        >
          MULTIVERSE ECHOES
        </h1>
        <p
          className={`me-fade-up mbe-8 text-center font-serif text-lg font-light tracking-wide text-[#9BA5AE] ${animClass}`}
          data-delay="150"
        >
          Choose your language&ensp;&middot;&ensp;选择语言&ensp;&middot;&ensp;भाषा चुनें
        </p>

        {/* Language tiles — circle on desktop/tablet, grid on phone */}
        {useGrid ? (
          <div
            className={`me-fade-up grid w-full max-w-lg grid-cols-4 gap-3 ${animClass}`}
            data-delay="300"
            role="listbox"
            aria-label={t('onboarding.languageSelectionLabel')}
          >
            {languages.map((lang) => (
              <LanguageTile
                key={lang.code}
                lang={lang}
                expanded={expandedCode === lang.code}
                reduced={reduced}
                isCircle={false}
                onClick={() => handleClick(lang.code)}
                onKeyDown={(e) => handleKeyDown(e, lang.code)}
                onMouseEnter={() => !isTouch && setExpandedCode(lang.code)}
                onMouseLeave={() => !isTouch && setExpandedCode(null)}
              />
            ))}
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`me-fade-up relative size-[640px] ${animClass}`}
            data-delay="300"
            role="listbox"
            aria-label={t('onboarding.languageSelectionLabel')}
          >
            {/* Centre logo */}
            <video
              src="/logo-loop-seamless.mp4"
              className="me-centered-absolute pointer-events-none absolute size-80 rounded-full object-cover opacity-80"
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              poster="/logo.png"
            />
            {languages.map((lang, i) => {
              // Position comes from precomputed `.me-circle-pos[data-idx="N"]`
              // rules in global.css — keeps the HTML free of any inline style
              // attribute so the prerendered flag page passes strict CSP.
              return (
                <div
                  key={lang.code}
                  data-idx={i}
                  className="me-circle-pos absolute"
                >
                  <div className={reduced ? '' : 'me-lang-float'} data-idx={i}>
                    <LanguageTile
                      lang={lang}
                      expanded={expandedCode === lang.code}
                      reduced={reduced}
                      isCircle
                      onClick={() => handleClick(lang.code)}
                      onKeyDown={(e) => handleKeyDown(e, lang.code)}
                      onMouseEnter={() => !isTouch && setExpandedCode(lang.code)}
                      onMouseLeave={() => !isTouch && setExpandedCode(null)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface LanguageTileProps {
  lang: Language;
  expanded: boolean;
  reduced: boolean;
  isCircle: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function LanguageTile({
  lang,
  expanded,
  reduced,
  isCircle,
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
}: LanguageTileProps) {
  // Visual state (border, scale, shadow, z-index) flows via data-expanded /
  // data-reduced attributes — see .me-lang-tile rules in global.css.
  return (
    <button
      role="option"
      aria-selected={false}
      aria-label={`Select ${lang.nativeName}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-expanded={expanded}
      data-reduced={reduced}
      className={`me-lang-tile group flex flex-col items-center gap-1.5 rounded-xl bg-[rgba(212,145,92,0.06)] text-center outline-none focus-visible:ring-2 focus-visible:ring-[#D4915C] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
        isCircle ? 'px-3 py-2.5' : 'px-2 py-3'
      }`}
    >
      <img
        src={`/flags/${lang.countryCode}.svg`}
        alt=""
        aria-hidden="true"
        className="size-9 rounded-full object-cover"
        draggable={false}
      />
      <span className="font-serif text-sm font-medium whitespace-nowrap text-[#E8E0D8]">
        {lang.nativeName}
      </span>
    </button>
  );
}
