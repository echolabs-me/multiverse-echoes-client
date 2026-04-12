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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.8);
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

  const navLinks = (
    <>
      <button
        onClick={() => scrollToSection('features')}
        className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        {t('website.nav.features')}
      </button>
      <button
        onClick={() => scrollToSection('pricing')}
        className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        {t('website.nav.pricing')}
      </button>
      <Link
        to="/about"
        onClick={() => setMenuOpen(false)}
        className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        {t('website.nav.about')}
      </Link>
    </>
  );

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? 'border-b border-[var(--border)] bg-[var(--canvas)]'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2">
          <img src="/logo.png" alt="Multiverse Echoes" className="h-8 w-8 rounded-md object-contain" />
          <span className="hidden text-sm font-semibold tracking-wider text-[var(--text-primary)] sm:inline">
            ME
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks}
          <Link
            to={isAuthenticated ? '/dashboard' : '/login'}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--canvas)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            {isAuthenticated ? t('website.nav.dashboard') : t('website.nav.enter')}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-[var(--text-primary)] md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--canvas)] px-4 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks}
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]"
            >
              <Globe size={16} />
              {t('website.nav.features').length > 0 ? 'Language' : 'Language'}
            </button>
            {langOpen && <LanguageSwitcher onSelect={() => setLangOpen(false)} />}
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="mt-2 rounded-md bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--canvas)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              {isAuthenticated ? t('website.nav.dashboard') : t('website.nav.enter')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
