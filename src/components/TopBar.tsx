import { Bell, Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './Avatar.tsx';

interface TopBarProps {
  userName?: string;
  avatarSrc?: string;
  notificationCount?: number;
  onSearchClick?: () => void;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  className?: string;
}

export function TopBar({
  userName = 'User',
  avatarSrc,
  notificationCount = 0,
  onSearchClick,
  onNotificationClick,
  onProfileClick,
  className = '',
}: TopBarProps) {
  const { t } = useTranslation();

  return (
    <header
      className={`flex h-14 items-center justify-between border-b border-border bg-surface px-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <Sparkles size={24} className="text-accent" aria-hidden="true" />
        <span className="text-lg font-semibold text-text-primary">
          {t('app.title')}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSearchClick}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          aria-label={t('common.search')}
        >
          <Search size={20} />
        </button>

        <button
          onClick={onNotificationClick}
          className="relative rounded-md p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          aria-label={t('common.notifications', 'Notifications')}
        >
          <Bell size={20} />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-canvas">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        <button
          onClick={onProfileClick}
          className="rounded-full"
          aria-label={t('common.profile', 'Profile')}
        >
          <Avatar src={avatarSrc} alt={userName} size="sm" />
        </button>
      </div>
    </header>
  );
}
