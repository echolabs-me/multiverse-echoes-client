import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Globe } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore.ts';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';

export function WebsiteNav() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // Read once — don't subscribe. Backend failures must not re-render public pages.
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Click-outside closes the desktop language dropdown.
  useEffect(() => {
    if (!langOpen) return;
    function onDocClick(e: MouseEvent) {
      if (langWrapRef.current && !langWrapRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [langOpen]);

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

  // When the user is already on /home (no hash), clicking the Home link
  // wouldn't change the route, so WebsiteLayout's pathname/hash-driven
  // scroll-to-top effect never fires. Force the scroll here so the link
  // always feels responsive.
  const handleHomeClick = useCallback(() => {
    setMenuOpen(false);
    if (location.pathname === '/home' && !location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.hash]);

  const enterTo = isAuthenticated ? '/dashboard' : '/login';
  const enterLabel = isAuthenticated ? t('website.nav.dashboard') : t('website.nav.enter');
  const showWaitlistCta = !isAuthenticated;

  const currentLangName =
    new Intl.DisplayNames([i18n.language], { type: 'language' }).of(i18n.language) ??
    i18n.language;

  const linkClass =
    'font-serif text-sm tracking-wider transition-colors ' +
    (scrolled
      ? 'text-(--text-secondary) hover:text-(--accent)'
      : 'text-[rgba(232,224,216,0.7)] hover:text-[#E8E0D8]');

  // Accent-pill treatment so the language switcher reads as a single,
  // distinctive affordance in both header and footer. Small globe + the
  // current language name; tinted accent background + border that
  // intensifies on hover without clashing with the serif nav tone.
  const langButtonClass =
    'flex items-center gap-1.5 rounded-full border border-(--accent)/40 bg-(--accent)/10 px-3 py-1 font-serif text-xs tracking-wider text-(--accent) transition-all hover:border-(--accent) hover:bg-(--accent)/20';

  return (
    <header
      className={`isolate fixed top-0 right-0 left-0 z-[9999] transition-all duration-500 ${
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
        <div className="hidden items-center gap-6 md:flex lg:gap-8">
          <Link to="/home" onClick={handleHomeClick} className={linkClass}>
            {t('website.nav.home')}
          </Link>
          <button onClick={() => scrollToSection('features')} className={linkClass}>
            {t('website.nav.features')}
          </button>
          <button onClick={() => scrollToSection('pricing')} className={linkClass}>
            {t('website.nav.pricing')}
          </button>
          <Link to="/about" className={linkClass}>
            {t('website.nav.about')}
          </Link>
          <Link to="/contact" className={linkClass}>
            {t('website.nav.contact')}
          </Link>
          {showWaitlistCta ? (
            <Link
              to="/waitlist"
              className="rounded-md bg-(--accent) px-5 py-2 font-serif text-sm font-semibold tracking-wider text-[#0A0F14] transition-all hover:bg-[#e0a06a] hover:shadow-[0_0_20px_rgba(212,145,92,0.15)]"
            >
              {t('auth.joinWaitlist')} ▸
            </Link>
          ) : (
            <Link
              to={enterTo}
              className="rounded-md bg-(--accent) px-5 py-2 font-serif text-sm font-semibold tracking-wider text-[#0A0F14] transition-all hover:bg-[#e0a06a] hover:shadow-[0_0_20px_rgba(212,145,92,0.15)]"
            >
              {enterLabel} ▸
            </Link>
          )}

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
              <div className="absolute top-10 right-0 z-50">
                <LanguageSwitcher onSelect={() => setLangOpen(false)} />
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-[#E8E0D8] md:hidden"
          aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="border-t border-[rgba(212,145,92,0.15)] bg-[#0A0F14] px-6 pb-8 pt-6 md:hidden">
          <div className="flex flex-col gap-5">
            <Link
              to="/home"
              onClick={handleHomeClick}
              className="font-serif text-base tracking-wider text-(--text-secondary) hover:text-(--accent)"
            >
              {t('website.nav.home')}
            </Link>
            <button
              onClick={() => scrollToSection('features')}
              className="text-start font-serif text-base tracking-wider text-(--text-secondary) hover:text-(--accent)"
            >
              {t('website.nav.features')}
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-start font-serif text-base tracking-wider text-(--text-secondary) hover:text-(--accent)"
            >
              {t('website.nav.pricing')}
            </button>
            <Link
              to="/about"
              onClick={() => setMenuOpen(false)}
              className="font-serif text-base tracking-wider text-(--text-secondary) hover:text-(--accent)"
            >
              {t('website.nav.about')}
            </Link>
            <Link
              to="/contact"
              onClick={() => setMenuOpen(false)}
              className="font-serif text-base tracking-wider text-(--text-secondary) hover:text-(--accent)"
            >
              {t('website.nav.contact')}
            </Link>

            <div className="my-1 border-t border-[rgba(212,145,92,0.1)]" />

            {/* Language selector — same accent-pill treatment as desktop */}
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className={`${langButtonClass} w-fit`}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t('website.nav.language')}
            >
              <Globe size={13} />
              <span>{currentLangName}</span>
            </button>
            {langOpen && <LanguageSwitcher onSelect={() => setLangOpen(false)} />}

            <Link
              to={showWaitlistCta ? '/waitlist' : enterTo}
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-md bg-(--accent) py-3 text-center font-serif text-sm font-semibold tracking-wider text-[#0A0F14] transition-all hover:bg-[#e0a06a]"
            >
              {showWaitlistCta ? t('auth.joinWaitlist') : enterLabel} ▸
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
