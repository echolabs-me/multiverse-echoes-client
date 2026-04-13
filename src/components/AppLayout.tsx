import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Compass,
  Search,
  Bell,
  Settings,
  Sparkles,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { DiscordIcon } from './icons/DiscordIcon.tsx';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { trackEvent } from '../lib/analytics.ts';
import { OracleSidebar } from './OracleSidebar.tsx';
import { CommunitySidebar } from './CommunitySidebar.tsx';
import { TickTimer } from './TickTimer.tsx';
import { EchoSidebar } from './EchoSidebar.tsx';
import { CommunityPulseCard } from './CommunityPulseCard.tsx';
import { TabletLayout } from './TabletLayout.tsx';
import { MoodParticles } from './MoodParticles.tsx';
import { useMoodPaletteStore } from '../stores/useMoodPaletteStore.ts';
import { isTabletDevice } from '../lib/deviceDetect.ts';

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

/**
 * Left nav sidebar.
 * - xl+ (desktop 4-col): always icon-only (56px) with hover tooltips
 * - lg (3-col): icon-only (56px)
 * - md: icon-only (56px)
 * - sm: hidden (bottom nav used)
 */
function NavSidebar({ isTablet = false }: { isTablet?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const allItems: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { id: 'shards', labelKey: 'nav.browseShards', icon: <Compass size={20} />, path: '/shards/browse' },
    { id: 'community', labelKey: 'communitySidebar.title', icon: <DiscordIcon size={20} />, path: '/community' },
    { id: 'search', labelKey: 'common.search', icon: <Search size={20} />, path: '/search' },
    { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={20} />, path: '/notifications', badge: unreadCount },
    { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  // On tablet, Community lives in the right tab panel — remove from nav
  const items = isTablet ? allItems.filter((i) => i.id !== 'community') : allItems;

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className="hidden md:flex h-full w-[76px] flex-shrink-0 flex-col border-e border-border bg-surface"
      aria-label={t('common.sidebar', 'Sidebar navigation')}
    >
      <nav className="flex-1 overflow-y-auto px-1.5 py-2">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(item.path)}
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors ${
                  isActive(item.path)
                    ? 'bg-accent-subtle text-accent'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                }`}
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                {item.icon}
                <span className="text-[9px] font-medium leading-tight">{t(item.labelKey, item.id)}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute top-0.5 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-canvas">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border px-1.5 py-2">
        <button
          onClick={() => {
            void useAuthStore.getState().logout();
            navigate('/login');
          }}
          className="flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-text-muted hover:bg-surface-raised hover:text-danger transition-colors"
        >
          <LogOut size={20} />
          <span className="text-[9px] font-medium leading-tight">{t('auth.logout')}</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * Wraps children in the mood-reactive gradient + particle layer.
 */
function MoodAtmosphereWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
  const palette = useMoodPaletteStore((s) => s.palette);

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {show && palette && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 transition-[background] duration-300 ease-in-out"
            style={{
              background: `linear-gradient(180deg, ${palette.gradientFrom} 0%, ${palette.gradientTo} 100%)`,
            }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 z-0">
            <MoodParticles palette={palette} />
          </div>
        </>
      )}
      <div className="flex flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileOracleOpen, setMobileOracleOpen] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // App shell needs overflow:hidden on body for internal panel scrolling.
  // Public website routes need normal document scrolling, so this is scoped
  // to AppLayout mount/unmount rather than set globally in CSS.
  useEffect(() => {
    document.body.classList.add('app-shell');
    return () => document.body.classList.remove('app-shell');
  }, []);

  // Touch detection — JS-based since CSS pointer queries are unreliable on iPad Safari
  const [isTablet, setIsTablet] = useState(() => isTabletDevice());

  // Viewport width detection. Drives which layout block renders so only
  // ONE `<Outlet />` mounts. Previously both phone and desktop blocks
  // rendered with CSS-only `md:hidden` / `hidden md:flex` toggling, which
  // mounted every route component twice — doubling state, useEffect calls,
  // and API fetches. Matches the Tailwind `md` breakpoint (768px).
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  );

  useEffect(() => {
    const handler = () => setIsTablet(isTabletDevice());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Track page views on route changes (ME-UXF-001 §16.5)
  useEffect(() => {
    const pageName = location.pathname.split('/')[1] || 'dashboard';
    trackEvent('page.viewed', { page_name: pageName, path: location.pathname });
  }, [location.pathname]);

  // Poll notifications on mount + every 60s as fallback for missed WS events.
  useEffect(() => {
    void useNotificationStore.getState().fetchNotifications();
    const interval = setInterval(() => {
      void useNotificationStore.getState().fetchNotifications();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const showEchoPanes = location.pathname === '/dashboard' || location.pathname.startsWith('/echoes/');


  // Auth guard
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const mobileNavItems: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { id: 'search', labelKey: 'common.search', icon: <Search size={20} />, path: '/search' },
    { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={20} />, path: '/notifications', badge: unreadCount },
    { id: 'oracle', labelKey: 'oracle.title', icon: <Sparkles size={20} />, path: '' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Top bar — logo + mobile hamburger */}
      <header className="relative flex h-14 flex-shrink-0 items-center border-b border-border bg-surface px-4 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 z-10">
          <img src="/logo.png" alt="" aria-hidden="true" className="h-8 w-8 flex-shrink-0 rounded" />
          <span className="hidden md:inline text-lg font-bold text-accent truncate">
            {t('app.title')}
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <TickTimer />
          </div>
        </div>
        <div className="ms-auto z-10">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="rounded-md p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary md:hidden"
            aria-label={t('nav.menu', 'Menu')}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="absolute inset-x-0 top-14 z-30 border-b border-border bg-surface p-4 shadow-lg md:hidden">
          <nav>
            <ul className="flex flex-col gap-1">
              {[
                { labelKey: 'nav.dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
                { labelKey: 'nav.browseShards', path: '/shards/browse', icon: <Compass size={20} /> },
                { labelKey: 'common.search', path: '/search', icon: <Search size={20} /> },
                { labelKey: 'nav.notifications', path: '/notifications', icon: <Bell size={20} /> },
                { labelKey: 'nav.settings', path: '/settings', icon: <Settings size={20} /> },
              ].map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => { navigate(item.path); setMobileNavOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                      isActive(item.path)
                        ? 'bg-accent-subtle text-accent font-medium'
                        : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                    }`}
                  >
                    {item.icon}
                    <span>{t(item.labelKey)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      <div className="flex flex-1 overflow-y-hidden">
        {/* Left nav — icon-only, visible on md+ */}
        <NavSidebar isTablet={isTablet} />

        {/* Exactly ONE of phone / tablet / desktop renders — never both —
            so `<Outlet />` mounts a single copy of the current route. */}

        {/* ═══ PHONE LAYOUT (<md) — single pane, full width ═══ */}
        {isMobileViewport && (
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        )}

        {/* ═══ TABLET LAYOUT — JS touch detection, md+ viewport ═══ */}
        {!isMobileViewport && isTablet && (
          <div className="flex flex-1 min-w-0">
            <TabletLayout showEchoPanes={showEchoPanes} />
          </div>
        )}

        {/* ═══ DESKTOP LAYOUT — non-touch 768px+ ═══ */}
        {!isMobileViewport && !isTablet && (
          <div className="flex flex-1 overflow-hidden">
          <MoodAtmosphereWrapper show={showEchoPanes}>
            {/* Community Pulse — 1920px+ only */}
            {showEchoPanes && (
              <aside className="hidden min-[1920px]:flex w-[311px] flex-shrink-0 flex-col border-e border-border/50 overflow-y-auto">
                <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t('communityFeed.title')}
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  <CommunityPulseCard />
                </div>
              </aside>
            )}

            {showEchoPanes && (
              <div className="flex flex-shrink-0 flex-col border-e border-border/50">
                {/* Community Pulse — collapsible in sidebar for screens <1920px */}
                <div className="min-[1920px]:hidden">
                  <DesktopPulseSection />
                </div>
                <EchoSidebar />
              </div>
            )}

            <main id="main-content" className="flex-1 overflow-y-auto">
              <Outlet />
            </main>

            <aside className="flex w-[260px] min-[1920px]:w-[280px] flex-shrink-0 flex-col border-s border-border/50">
              <OracleSidebar />
            </aside>

            {/* Community pane — 1920px+ */}
            <aside className="hidden min-[1920px]:flex w-[240px] flex-shrink-0 flex-col border-s border-border/50">
              <CommunitySidebar />
            </aside>
          </MoodAtmosphereWrapper>

          </div>
        )}
      </div>

      {/* Mobile bottom bar */}
      <nav
        className="flex h-14 items-center justify-around border-t border-border bg-surface md:hidden"
        aria-label={t('common.mobileNav', 'Mobile navigation')}
      >
        {mobileNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'oracle') {
                setMobileOracleOpen(true);
              } else {
                navigate(item.path);
              }
            }}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
              item.id === 'oracle'
                ? 'text-accent'
                : isActive(item.path)
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-secondary'
            }`}
            aria-current={item.path && isActive(item.path) ? 'page' : undefined}
          >
            {item.icon}
            <span>{t(item.labelKey, item.id)}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -top-1 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-canvas">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Oracle overlay — phone only (tablets use TabletLayout overlay, desktop has pane) */}
      {mobileOracleOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas md:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="text-sm font-semibold">{t('oracle.title')}</span>
            </div>
            <button
              onClick={() => setMobileOracleOpen(false)}
              className="rounded-md p-1.5 text-text-muted hover:text-text-secondary"
              aria-label={t('common.close')}
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <OracleSidebar />
          </div>
        </div>
      )}


    </div>
  );
}

const DESKTOP_PULSE_KEY = 'desktop-pulse-open';

/**
 * Collapsible Community Pulse for the desktop echo sidebar (screens 1280-1919px).
 * Above 1920px, the full-width Pulse aside renders instead.
 */
function DesktopPulseSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(DESKTOP_PULSE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      localStorage.setItem(DESKTOP_PULSE_KEY, String(!prev));
      return !prev;
    });
  }, []);

  return (
    <div className="flex-shrink-0 border-b-2 border-border bg-surface-raised/30">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-1.5 text-start hover:bg-surface-raised transition-colors"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent/70">
          {t('communityFeed.title')}
        </span>
        {open
          ? <ChevronDown size={12} className="text-text-muted" />
          : <ChevronRight size={12} className="text-text-muted" />
        }
      </button>
      {open && (
        <div className="max-h-[200px] overflow-y-auto px-2 pb-2">
          <CommunityPulseCard />
        </div>
      )}
    </div>
  );
}
