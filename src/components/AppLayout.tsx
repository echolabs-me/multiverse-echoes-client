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
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { trackEvent } from '../lib/analytics.ts';
import { OracleSidebar } from './OracleSidebar.tsx';

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileOracleOpen, setMobileOracleOpen] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

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
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <Sparkles size={24} className="text-accent" aria-hidden="true" />
          <span className="text-lg font-semibold text-text-primary">
            {t('app.title')}
          </span>
        </div>

        {/* Mobile-only hamburger */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary md:hidden"
          aria-label={t('nav.menu', 'Menu')}
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
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

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Right Oracle sidebar — desktop only */}
        <div
          className={`hidden md:flex h-full flex-col border-l border-border bg-canvas transition-[width] duration-[var(--duration-slow)] ${
            oracleCollapsed ? 'w-12' : 'w-80 lg:w-96'
          }`}
        >
          {oracleCollapsed ? (
            <button
              onClick={() => setOracleCollapsed(false)}
              className="flex h-full flex-col items-center pt-4 text-text-muted hover:text-accent"
              aria-label={t('oracle.expand', 'Expand Oracle')}
              title={t('oracle.title')}
            >
              <Sparkles size={20} />
              <span
                className="mt-2 text-[10px] font-medium"
                style={{ writingMode: 'vertical-rl' }}
              >
                {t('oracle.title')}
              </span>
            </button>
          ) : (
            <OracleSidebar onCollapse={() => setOracleCollapsed(true)} />
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

      {/* Mobile Oracle overlay */}
      {mobileOracleOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas md:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('oracle.title')}
              </h2>
            </div>
            <button
              onClick={() => setMobileOracleOpen(false)}
              className="rounded-md p-1.5 text-text-muted hover:bg-surface hover:text-text-secondary"
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
    </div>
  );
}
