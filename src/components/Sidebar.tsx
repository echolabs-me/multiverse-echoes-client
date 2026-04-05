import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  children: ReactNode;
  className?: string;
}

export function Sidebar({ children, className = '' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation();

  return (
    <aside
      className={`flex h-full flex-col border-e border-border bg-surface transition-[width] duration-[var(--duration-slow)] ${
        collapsed ? 'w-16' : 'w-64'
      } ${className}`}
      aria-label={t('common.sidebar', 'Sidebar navigation')}
    >
      <div className="flex-1 overflow-y-auto p-2">
        {!collapsed && children}
      </div>
      <button
        onClick={() => setCollapsed(!collapsed)}
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
