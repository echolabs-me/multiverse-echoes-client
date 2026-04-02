import { Bell, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar.tsx';
import { useAuthStore } from '../stores/useAuthStore.ts';

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
  userName,
  avatarSrc,
  notificationCount = 0,
  onSearchClick,
  onNotificationClick,
  onProfileClick,
  className = '',
}: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const displayName = userName ?? user?.display_name ?? 'User';
  const handleSearch = onSearchClick ?? (() => navigate('/search'));

  return (
    <header
      className={`flex h-14 items-center justify-between border-b border-border bg-surface px-4 ${className}`}
    >
      <button className="flex items-center gap-2.5" onClick={() => navigate('/dashboard')} aria-label={t('app.title')}>
        <img src="/favicon.svg" alt="" aria-hidden="true" className="h-7 w-7" />
        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-accent to-[#47bfff] bg-clip-text text-transparent">
          {t('app.title')}
        </span>
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSearch}
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
          <Avatar src={avatarSrc} alt={displayName} size="sm" />
        </button>
      </div>
    </header>
  );
}
