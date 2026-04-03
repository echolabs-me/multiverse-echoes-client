import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { TabletPaneScroller } from './TabletPaneScroller';

function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5a.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.2v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1A58.7 58.7 0 0071 45.3v-.1C72.4 30 68.4 16.8 60.1 5a.2.2 0 00-.1 0zM23.7 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1z" fill="currentColor"/>
    </svg>
  );
}
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
import { useCommunitySidebarUnread } from '../hooks/useCommunitySidebarUnread.ts';

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
function NavSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const items: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { id: 'shards', labelKey: 'nav.browseShards', icon: <Compass size={20} />, path: '/shards/browse' },
    { id: 'search', labelKey: 'common.search', icon: <Search size={20} />, path: '/search' },
    { id: 'notifications', labelKey: 'nav.notifications', icon: <Bell size={20} />, path: '/notifications', badge: unreadCount },
    { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className="hidden md:flex h-full w-[76px] flex-shrink-0 flex-col border-r border-border bg-surface"
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
                  <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-canvas">
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
    <div className="relative flex flex-1 overflow-hidden">
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
      {children}
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
  const [mobileCommunityOpen, setMobileCommunityOpen] = useState(false);
  const communityHasUnread = useCommunitySidebarUnread();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

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

  // Tablet panes — memoized to avoid re-creating on every render.
  // Must be before auth guard (React hooks must be called unconditionally).
  const tabletPanes = useMemo(() => [
    {
      id: 'community-pulse',
      label: t('communityFeed.title'),
      content: (
        <div className="h-full overflow-y-auto px-2 pb-2">
          <CommunityPulseCard />
        </div>
      ),
    },
    {
      id: 'echoes',
      label: t('echoSidebar.title'),
      content: <EchoSidebar forceVisible />,
    },
    {
      id: 'detail',
      label: t('nav.dashboard'),
      content: <div className="h-full overflow-y-auto"><Outlet /></div>,
    },
    {
      id: 'oracle',
      label: t('oracle.title'),
      content: <OracleSidebar onCollapse={() => {}} />,
    },
    {
      id: 'community',
      label: t('communitySidebar.title'),
      content: <CommunitySidebar />,
    },
  ], [t]);

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
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top bar — logo + mobile hamburger */}
      <header className="relative flex h-14 items-center border-b border-border bg-surface px-4 overflow-hidden">
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
        <div className="ml-auto z-10">
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
        <NavSidebar />

        {/* ═══ TABLET LAYOUT (md to min-[1440px]) — swipeable pane scroller ═══ */}
        {showEchoPanes && (
          <div className="hidden md:flex xl:hidden flex-1 min-w-0">
            <TabletPaneScroller
              initialPane={2}
              panes={tabletPanes}
            />
          </div>
        )}

        {/* Non-echo pages on tablet (settings, search, etc.) */}
        {!showEchoPanes && (
          <main className="hidden md:flex xl:hidden flex-1 overflow-y-auto">
            <div className="flex-1 overflow-y-auto"><Outlet /></div>
          </main>
        )}

        {/* ═══ PHONE LAYOUT (<md) — single pane, full width ═══ */}
        <main className="flex-1 overflow-y-auto md:hidden">
          <Outlet />
        </main>

        {/* ═══ DESKTOP LAYOUT (1440px+) — all panes in flex row ═══ */}
        <div className="hidden xl:flex flex-1 overflow-hidden">
          <MoodAtmosphereWrapper show={showEchoPanes}>
            {/* Community Pulse — 1920px+ only */}
            {showEchoPanes && (
              <aside className="hidden min-[1920px]:flex h-full w-[311px] flex-shrink-0 flex-col border-r border-border/50 overflow-y-auto">
                <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t('communityFeed.title')}
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  <CommunityPulseCard />
                </div>
              </aside>
            )}

            {showEchoPanes && <EchoSidebar />}

            <main id="main-content" className="flex-1 overflow-y-auto">
              <Outlet />
            </main>

            <aside className="flex h-full w-[260px] min-[1920px]:w-[280px] flex-shrink-0 flex-col border-l border-border/50">
              <OracleSidebar onCollapse={() => {}} />
            </aside>

            {/* Community pane — 1920px+ */}
            <aside className="hidden min-[1920px]:flex h-full w-[240px] flex-shrink-0 flex-col border-l border-border/50">
              <CommunitySidebar />
            </aside>
          </MoodAtmosphereWrapper>

          {/* Community FAB for 1440-1920 range */}
          <button
            onClick={() => setMobileCommunityOpen(true)}
            className="hidden xl:flex min-[1920px]:hidden fixed bottom-4 right-4 z-40 items-center justify-center rounded-full bg-[#5865F2] p-3 text-white shadow-lg hover:bg-[#4752c4] transition-colors"
            aria-label={t('communitySidebar.title')}
            title={t('communitySidebar.title')}
          >
            <DiscordIcon size={20} />
            {communityHasUnread && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas bg-danger" />
            )}
          </button>
        </div>
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
              <span className="absolute -top-1 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-canvas">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Oracle overlay — phone only (tablets use pane scroller, desktop has pane) */}
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
            <OracleSidebar onCollapse={() => setMobileOracleOpen(false)} />
          </div>
        </div>
      )}

      {/* Community overlay — phone + desktop 1440-1920 (tablets use pane scroller) */}
      {mobileCommunityOpen && (
        <>
          <button className="hidden xl:block min-[1920px]:hidden fixed inset-0 z-40 bg-black/30 cursor-default" onClick={() => setMobileCommunityOpen(false)} aria-label={t('common.close')} tabIndex={-1} />
          <div className="fixed inset-0 xl:inset-y-0 xl:left-auto xl:right-0 xl:w-[380px] z-50 flex flex-col bg-canvas xl:border-l xl:border-border xl:shadow-xl min-[1920px]:hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <DiscordIcon size={16} />
                <span className="text-sm font-semibold">{t('communitySidebar.title')}</span>
              </div>
              <button
                onClick={() => setMobileCommunityOpen(false)}
                className="rounded-md p-1.5 text-text-muted hover:text-text-secondary"
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CommunitySidebar />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
