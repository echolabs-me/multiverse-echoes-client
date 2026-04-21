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
      className="hidden h-full w-[76px] shrink-0 flex-col border-e border-border bg-surface md:flex"
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
                <span className="text-[9px] leading-tight font-medium">{t(item.labelKey, item.id)}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute inset-e-0.5 inset-bs-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-canvas">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-bs border-border px-1.5 py-2">
        <button
          onClick={() => {
            void useAuthStore.getState().logout();
            navigate('/login');
          }}
          className="flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-text-muted transition-colors hover:bg-surface-raised hover:text-danger"
        >
          <LogOut size={20} />
          <span className="text-[9px] leading-tight font-medium">{t('auth.logout')}</span>
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
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {show && palette && (
        <>
          <div
            ref={(el) => {
              if (el) {
                el.style.setProperty('--me-bg-gradient-from', palette.gradientFrom);
                el.style.setProperty('--me-bg-gradient-to', palette.gradientTo);
              }
            }}
            className="me-mood-gradient pointer-events-none absolute inset-0 z-0 transition-[background] duration-300 ease-in-out"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 z-0">
            <MoodParticles palette={palette} />
          </div>
        </>
      )}
      <div className="flex min-h-0 flex-1">
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
      if (document.visibilityState === 'visible') {
        void useNotificationStore.getState().fetchNotifications();
      }
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
      <header className="relative flex h-14 shrink-0 items-center justify-between gap-2 overflow-hidden border-be border-border bg-surface px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <img src="/logo.png" alt="" aria-hidden="true" className="size-8 shrink-0 rounded-sm" />
          <span className="hidden truncate text-lg font-bold text-accent md:inline">
            {t('app.title')}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          <TickTimer />
        </div>
        <div className="flex shrink-0 items-center justify-end">
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
        <div className="absolute inset-x-0 inset-bs-14 z-30 border-be border-border bg-surface p-4 shadow-lg md:hidden">
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
                        ? 'bg-accent-subtle font-medium text-accent'
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

        {/* We use a single layout tree to prevent `<Outlet />` unmounting on resize. */}
        <div className="flex flex-1 overflow-hidden">
          <MoodAtmosphereWrapper show={!isMobileViewport && showEchoPanes}>
            
            {/* ═══ TABLET LEFT PANES ═══ */}
            {!isMobileViewport && isTablet && showEchoPanes && (
              <>
                <aside className="flex w-[260px] shrink-0 flex-col border-e border-border/50 bg-canvas">
                  <EchoSidebar forceVisible />
                </aside>
                <aside className="flex w-[260px] shrink-0 flex-col border-e border-border/50 bg-canvas">
                  <div className="shrink-0 border-be border-border/50 p-3">
                    <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                      {t('communityFeed.title')}
                    </span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <CommunityPulseCard />
                  </div>
                </aside>
              </>
            )}

            {/* ═══ DESKTOP LEFT PANES ═══ */}
            {!isMobileViewport && !isTablet && showEchoPanes && (
              <>
                <aside className="hidden max-w-[311px] min-w-[220px] flex-1 flex-col overflow-y-auto border-e border-border/50 min-[1920px]:flex">
                  <div className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                    {t('communityFeed.title')}
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pbe-2">
                    <CommunityPulseCard />
                  </div>
                </aside>
                <div className="flex shrink-0 flex-col border-e border-border/50">
                  <div className="min-[1920px]:hidden">
                    <DesktopPulseSection />
                  </div>
                  <EchoSidebar />
                </div>
              </>
            )}

            <main id="main-content" className="flex-1 overflow-y-auto">
              <Outlet />
            </main>

            {/* ═══ TABLET RIGHT PANES ═══ */}
            {!isMobileViewport && isTablet && showEchoPanes && (
              <TabletRightSidebar />
            )}

            {/* ═══ DESKTOP RIGHT PANES ═══ */}
            {!isMobileViewport && !isTablet && (
              <>
                <aside className="flex w-[260px] shrink-0 flex-col border-s border-border/50 min-[1920px]:w-[280px]">
                  <OracleSidebar />
                </aside>
                <aside className="hidden max-w-[280px] min-w-[200px] flex-1 flex-col border-s border-border/50 min-[1920px]:flex">
                  <CommunitySidebar />
                </aside>
              </>
            )}
          </MoodAtmosphereWrapper>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <nav
        className="flex h-14 items-center justify-around border-bs border-border bg-surface md:hidden"
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
              <span className="absolute inset-e-0 -inset-bs-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-canvas">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Oracle overlay — phone only (tablets use TabletLayout overlay, desktop has pane) */}
      {mobileOracleOpen && (
        <dialog
          className="fixed inset-0 z-50 m-0 flex size-full max-w-none flex-col border-none bg-canvas p-0 shadow-none backdrop:bg-black/50 open:animate-modal-in md:hidden"
          open
          aria-modal="true"
          aria-label={t('oracle.title')}
          ref={(el) => {
            if (el && !el.open) el.showModal();
          }}
          onClose={() => setMobileOracleOpen(false)}
        >
          <div className="flex items-center justify-between border-be border-border px-4 py-3">
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
        </dialog>
      )}


    </div>
  );
}

function TabletRightSidebar() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'oracle' | 'community'>('oracle');

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-s border-border/50 bg-canvas">
      <div className="flex shrink-0 border-be border-border/50" role="tablist">
        <div
          onClick={() => setActiveTab('oracle')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('oracle'); } }}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wider uppercase transition-colors ${
            activeTab === 'oracle'
              ? 'border-be-2 border-accent text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          aria-selected={activeTab === 'oracle'}
          role="tab"
          tabIndex={0}
        >
          <Sparkles size={14} />
          {t('oracle.title')}
        </div>
        <div
          onClick={() => setActiveTab('community')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('community'); } }}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wider uppercase transition-colors ${
            activeTab === 'community'
              ? 'border-be-2 border-accent text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          aria-selected={activeTab === 'community'}
          role="tab"
          tabIndex={0}
        >
          <DiscordIcon size={14} />
          {t('communitySidebar.title')}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'oracle' ? <OracleSidebar /> : <CommunitySidebar />}
      </div>
    </aside>
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
    <div className="shrink-0 border-be-2 border-border bg-surface-raised/30">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-1.5 text-start transition-colors hover:bg-surface-raised"
      >
        <span className="text-[11px] font-semibold tracking-wider text-accent/70 uppercase">
          {t('communityFeed.title')}
        </span>
        {open
          ? <ChevronDown size={12} className="text-text-muted" />
          : <ChevronRight size={12} className="text-text-muted" />
        }
      </button>
      {open && (
        <div className="max-h-[200px] overflow-y-auto px-2 pbe-2">
          <CommunityPulseCard />
        </div>
      )}
    </div>
  );
}
