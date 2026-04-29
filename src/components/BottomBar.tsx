import { LayoutDashboard, Newspaper, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface BottomBarItem {
  id: string;
  labelKey: string;
  icon: ReactNode;
}

interface BottomBarProps {
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

const items: BottomBarItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'feeds', labelKey: 'nav.feeds', icon: <Newspaper size={20} /> },
  { id: 'community', labelKey: 'nav.community', icon: <MessageSquare size={20} /> },
  { id: 'more', labelKey: 'nav.more', icon: <MoreHorizontal size={20} /> },
];

export function BottomBar({
  activeId,
  onSelect,
  className = '',
}: BottomBarProps) {
  const { t } = useTranslation();

  return (
    <nav
      className={`flex h-14 items-center justify-around border-bs border-border bg-surface md:hidden ${className}`}
      aria-label={t('common.mobileNav', 'Mobile navigation')}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
            activeId === item.id
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          aria-current={activeId === item.id ? 'page' : undefined}
        >
          {item.icon}
          <span>{t(item.labelKey, item.id)}</span>
        </button>
      ))}
    </nav>
  );
}
