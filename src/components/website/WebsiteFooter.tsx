import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { useState } from 'react';
import { Globe } from 'lucide-react';

export function WebsiteFooter() {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  const currentLangName =
    new Intl.DisplayNames([i18n.language], { type: 'language' }).of(i18n.language) ?? i18n.language;

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--canvas)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Multiverse Echoes" className="h-8 w-8 rounded-md object-contain" />
              <span className="text-sm font-semibold tracking-wider text-[var(--text-primary)]">
                Multiverse Echoes
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{t('website.footer.copyright')}</p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <Link to="/home#features" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t('website.nav.features')}
            </Link>
            <Link to="/home#pricing" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t('website.nav.pricing')}
            </Link>
            <Link to="/about" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t('website.nav.about')}
            </Link>
            <Link to="/contact" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Contact
            </Link>
            <Link to="/waitlist" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t('auth.joinWaitlist')}
            </Link>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-2">
            <Link to="/terms" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t('website.footer.terms')}
            </Link>
            <Link to="/privacy" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t('website.footer.privacy')}
            </Link>
          </div>

          {/* Social + Language */}
          <div className="flex flex-col gap-3">
            <a
              href="https://x.com/EchoLabsME"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @EchoLabsME
            </a>
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Globe size={14} />
                {currentLangName}
              </button>
              {langOpen && (
                <div className="absolute bottom-8 left-0 z-10">
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
