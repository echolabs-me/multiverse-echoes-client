import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';

export function WebsiteFooter() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const langWrapRef = useRef<HTMLDivElement>(null);

  // Same-route Link clicks don't trigger WebsiteLayout's scroll effect
  // (pathname + hash haven't changed), so a Home click from the footer
  // while already on /home would do nothing visible. Force the scroll.
  const handleHomeClick = useCallback(() => {
    if (location.pathname === '/home' && !location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.hash]);

  const currentLangName =
    new Intl.DisplayNames([i18n.language], { type: 'language' }).of(
      i18n.language,
    ) ?? i18n.language;

  // Click-outside closes the language dropdown (matches the header's
  // behaviour so both affordances feel the same).
  useEffect(() => {
    if (!langOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        langWrapRef.current &&
        !langWrapRef.current.contains(e.target as Node)
      ) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [langOpen]);

  // Same accent-pill treatment as the header's language selector — single
  // visual language for "switch language" across the site.
  const langButtonClass =
    'flex items-center gap-1.5 rounded-full border border-(--accent)/40 bg-(--accent)/10 px-3 py-1 font-serif text-xs tracking-wider text-(--accent) transition-all hover:border-(--accent) hover:bg-(--accent)/20';

  return (
    <footer className="border-bs border-(--border) bg-(--canvas)">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Multiverse Echoes"
                className="size-8 rounded-md object-contain"
              />
              <span className="text-sm font-semibold tracking-wider text-(--text-primary)">
                Multiverse Echoes
              </span>
            </div>
            <p className="text-xs text-(--text-muted)">
              {t('website.footer.copyright')}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <Link
              to="/home"
              onClick={handleHomeClick}
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.nav.home')}
            </Link>
            <Link
              to="/home#features"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.nav.features')}
            </Link>
            <Link
              to="/home#pricing"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.nav.pricing')}
            </Link>
            <Link
              to="/about"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.nav.about')}
            </Link>
            <Link
              to="/contact"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.nav.contact')}
            </Link>
            <Link
              to="/waitlist"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('auth.joinWaitlist')}
            </Link>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-2">
            <Link
              to="/terms"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.footer.terms')}
            </Link>
            <Link
              to="/privacy"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.footer.privacy')}
            </Link>
            <Link
              to="/accessibility"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.footer.accessibility')}
            </Link>
            <a
              href="https://status.echolabsme.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              {t('website.footer.status')}
            </a>
          </div>

          {/* Social + Language */}
          <div className="flex flex-col items-start gap-3">
            <a
              href="https://x.com/EchoLabsME"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @EchoLabsME
            </a>
            <a
              href="https://discord.gg/dRcB4QxUmJ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
              </svg>
              Discord
            </a>
            <div
              ref={langWrapRef}
              className="relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setLangOpen(false);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className={langButtonClass}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={t('website.nav.language')}
              >
                <Globe size={13} />
                <span>{currentLangName}</span>
              </button>
              {langOpen && (
                <div className="absolute inset-s-0 inset-be-10 z-10">
                  <LanguageSwitcher onSelect={() => setLangOpen(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
