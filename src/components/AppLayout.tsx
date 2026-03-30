import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Compass,
  Search,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

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
import { useCommunitySidebarUnread } from '../hooks/useCommunitySidebarUnread.ts';

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

function NavSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const items: NavItem[] = [
    {
      id: 'dashboard',
      labelKey: 'nav.dashboard',
      icon: <LayoutDashboard size={20} />,
      path: '/dashboard',
    },
    {
      id: 'shards',
      labelKey: 'nav.browseShards',
      icon: <Compass size={20} />,
      path: '/shards/browse',
    },
    {
      id: 'search',
      labelKey: 'common.search',
      icon: <Search size={20} />,
      path: '/search',
    },
    {
      id: 'notifications',
      labelKey: 'nav.notifications',
      icon: <Bell size={20} />,
      path: '/notifications',
      badge: unreadCount,
    },
    {
      id: 'settings',
      labelKey: 'nav.settings',
      icon: <Settings size={20} />,
      path: '/settings',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={`hidden md:flex h-full flex-col border-r border-border bg-surface transition-[width] duration-[var(--duration-slow)] ${
        collapsed ? 'w-16' : 'w-56'
      }`}
      aria-label={t('common.sidebar', 'Sidebar navigation')}
    >
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(item.path)}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive(item.path)
                    ? 'bg-accent-subtle text-accent font-medium'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                } ${collapsed ? 'justify-center' : ''}`}
                aria-current={isActive(item.path) ? 'page' : undefined}
                title={collapsed ? t(item.labelKey, item.id) : undefined}
              >
                {item.icon}
                {!collapsed && (
                  <span>{t(item.labelKey, item.id)}</span>
                )}
                {item.badge != null && item.badge > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-canvas ${
                      collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border">
        <button
          onClick={() => {
            void useAuthStore.getState().logout();
            navigate('/login');
          }}
          className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-text-muted hover:bg-surface-raised hover:text-danger transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? t('auth.logout') : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span>{t('auth.logout')}</span>}
        </button>
      </div>
      <button
        onClick={onToggle}
        className="flex items-center justify-center border-t border-border p-3 text-text-muted hover:text-text-primary"
        aria-label={
          collapsed
            ? t('common.expandSidebar', 'Expand sidebar')
            : t('common.collapseSidebar', 'Collapse sidebar')
        }
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [oracleCollapsed, setOracleCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'oracle' | 'community'>(
    () => (localStorage.getItem('sidebar_tab') as 'oracle' | 'community') ?? 'oracle',
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileOracleOpen, setMobileOracleOpen] = useState(false);
  const communityHasUnread = useCommunitySidebarUnread();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const switchSidebarTab = (tab: 'oracle' | 'community') => {
    setSidebarTab(tab);
    localStorage.setItem('sidebar_tab', tab);
    if (tab === 'community') {
      window.dispatchEvent(new Event('community-sidebar-opened'));
    }
  };

  // Track page views on route changes (ME-UXF-001 §16.5)
  useEffect(() => {
    const pageName = location.pathname.split('/')[1] || 'dashboard';
    trackEvent('page.viewed', { page_name: pageName, path: location.pathname });
  }, [location.pathname]);

  // Auth guard — redirect to login if not authenticated.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const mobileNavItems: NavItem[] = [
    {
      id: 'dashboard',
      labelKey: 'nav.dashboard',
      icon: <LayoutDashboard size={20} />,
      path: '/dashboard',
    },
    {
      id: 'search',
      labelKey: 'common.search',
      icon: <Search size={20} />,
      path: '/search',
    },
    {
      id: 'notifications',
      labelKey: 'nav.notifications',
      icon: <Bell size={20} />,
      path: '/notifications',
      badge: unreadCount,
    },
    {
      id: 'oracle',
      labelKey: 'oracle.title',
      icon: <Sparkles size={20} />,
      path: '',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top bar — logo + mobile hamburger */}
      <header className="relative flex h-14 items-center border-b border-border bg-surface px-4 overflow-hidden">
        {/* Left — logo */}
        <div className="flex items-center gap-2 min-w-0 z-10">
          <Sparkles size={22} className="flex-shrink-0 text-accent" aria-hidden="true" />
          <span className="hidden md:inline text-base font-semibold text-text-primary truncate">
            {t('app.title')}
          </span>
        </div>

        {/* Center — tick timer digits + full-width ambient bar */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <TickTimer />
          </div>
        </div>

        {/* Right — mobile hamburger */}
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
                    onClick={() => {
                      navigate(item.path);
                      setMobileNavOpen(false);
                    }}
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav sidebar — desktop only */}
        <NavSidebar
          collapsed={navCollapsed}
          onToggle={() => setNavCollapsed(!navCollapsed)}
        />

        {/* Echo list sidebar — shown on dashboard and echo detail routes */}
        {(location.pathname === '/dashboard' || location.pathname.startsWith('/echoes/')) && (
          <EchoSidebar />
        )}

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Right sidebar — Oracle / Community tabs — desktop only */}
        <div
          className={`hidden md:flex h-full flex-col border-l border-border bg-canvas transition-[width] duration-[var(--duration-slow)] ${
            oracleCollapsed ? 'w-12' : 'w-80 lg:w-96'
          }`}
        >
          {oracleCollapsed ? (
            <div className="flex h-full flex-col items-center gap-4 pt-4">
              <button
                onClick={() => { setOracleCollapsed(false); switchSidebarTab('oracle'); }}
                className="text-text-muted hover:text-accent"
                aria-label={t('oracle.expand', 'Expand Oracle')}
                title={t('oracle.title')}
              >
                <Sparkles size={20} />
              </button>
              <button
                onClick={() => { setOracleCollapsed(false); switchSidebarTab('community'); }}
                className="relative text-text-muted hover:text-[#5865F2]"
                aria-label={t('communitySidebar.expand')}
                title={t('communitySidebar.title')}
              >
                <DiscordIcon size={20} />
                {communityHasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#5865F2]" />
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => switchSidebarTab('oracle')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    sidebarTab === 'oracle'
                      ? 'border-b-2 border-accent text-accent'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Sparkles size={14} />
                  {t('oracle.title')}
                </button>
                <button
                  onClick={() => switchSidebarTab('community')}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    sidebarTab === 'community'
                      ? 'border-b-2 border-[#5865F2] text-[#5865F2]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <DiscordIcon size={14} />
                  {t('communitySidebar.title')}
                  {communityHasUnread && sidebarTab !== 'community' && (
                    <span className="absolute top-1.5 right-4 h-2 w-2 rounded-full bg-[#5865F2]" />
                  )}
                </button>
              </div>
              {/* Tab content */}
              {sidebarTab === 'oracle' ? (
                <OracleSidebar onCollapse={() => setOracleCollapsed(true)} />
              ) : (
                <CommunitySidebar onCollapse={() => setOracleCollapsed(true)} />
              )}
            </>
          )}
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
            aria-current={
              item.path && isActive(item.path) ? 'page' : undefined
            }
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

      {/* Mobile Oracle/Community overlay */}
      {mobileOracleOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas md:hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            <button
              onClick={() => switchSidebarTab('oracle')}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                sidebarTab === 'oracle'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-muted'
              }`}
            >
              <Sparkles size={16} />
              {t('oracle.title')}
            </button>
            <button
              onClick={() => switchSidebarTab('community')}
              className={`relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                sidebarTab === 'community'
                  ? 'border-b-2 border-[#5865F2] text-[#5865F2]'
                  : 'text-text-muted'
              }`}
            >
              <DiscordIcon size={16} />
              {t('communitySidebar.title')}
              {communityHasUnread && sidebarTab !== 'community' && (
                <span className="absolute top-2 right-6 h-2 w-2 rounded-full bg-[#5865F2]" />
              )}
            </button>
            <button
              onClick={() => setMobileOracleOpen(false)}
              className="px-3 text-text-muted hover:text-text-secondary"
              aria-label={t('common.close')}
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'oracle' ? (
              <OracleSidebar onCollapse={() => setMobileOracleOpen(false)} />
            ) : (
              <CommunitySidebar onCollapse={() => setMobileOracleOpen(false)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
