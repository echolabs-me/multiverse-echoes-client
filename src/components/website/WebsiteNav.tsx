import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Globe } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore.ts';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';

export function WebsiteNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // Read once — don't subscribe. Backend failures must not re-render public pages.
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = useCallback(
    (id: string) => {
      if (location.pathname !== '/home') {
        void navigate(`/home#${id}`);
        return;
      }
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      setMenuOpen(false);
    },
    [location.pathname, navigate],
  );

  const enterTo = isAuthenticated ? '/dashboard' : '/login';
  const enterLabel = isAuthenticated ? t('website.nav.dashboard') : t('website.nav.enter');

  const linkClass =
    'font-serif text-sm tracking-wider transition-colors ' +
    (scrolled
      ? 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
      : 'text-[rgba(232,224,216,0.7)] hover:text-[#E8E0D8]');

  return (
    <header
      style={{ isolation: 'isolate' }}
      className={`fixed top-0 right-0 left-0 z-[9999] transition-all duration-500 ${
        scrolled || menuOpen
          ? 'border-b border-[rgba(212,145,92,0.15)] bg-[#0A0F14]'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo — full mark + wordmark, not just a tiny icon */}
        <Link to="/home" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Multiverse Echoes"
            className="h-9 w-9 rounded-lg object-contain"
          />
          <span className="hidden font-serif text-base font-light tracking-[0.14em] text-[#E8E0D8] sm:inline">
            MULTIVERSE ECHOES
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <button onClick={() => scrollToSection('features')} className={linkClass}>
            {t('website.nav.features')}
          </button>
          <button onClick={() => scrollToSection('pricing')} className={linkClass}>
            {t('website.nav.pricing')}
          </button>
          <Link to="/about" className={linkClass}>
            {t('website.nav.about')}
          </Link>
          <Link
            to={enterTo}
            className="rounded-md bg-[var(--accent)] px-5 py-2 font-serif text-sm font-semibold tracking-wider text-[#0A0F14] transition-all hover:bg-[#e0a06a] hover:shadow-[0_0_20px_rgba(212,145,92,0.15)]"
          >
            {enterLabel} ▸
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-[#E8E0D8] md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="border-t border-[rgba(212,145,92,0.15)] bg-[#0A0F14] px-6 pb-8 pt-6 md:hidden">
          <div className="flex flex-col gap-5">
            <button
              onClick={() => scrollToSection('features')}
              className="text-start font-serif text-base tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              {t('website.nav.features')}
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-start font-serif text-base tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              {t('website.nav.pricing')}
            </button>
            <Link
              to="/about"
              onClick={() => setMenuOpen(false)}
              className="font-serif text-base tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              {t('website.nav.about')}
            </Link>

            <div className="my-1 border-t border-[rgba(212,145,92,0.1)]" />

            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <Globe size={14} />
              Language
            </button>
            {langOpen && <LanguageSwitcher onSelect={() => setLangOpen(false)} />}

            <Link
              to={enterTo}
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-md bg-[var(--accent)] py-3 text-center font-serif text-sm font-semibold tracking-wider text-[#0A0F14] transition-all hover:bg-[#e0a06a]"
            >
              {enterLabel} ▸
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
