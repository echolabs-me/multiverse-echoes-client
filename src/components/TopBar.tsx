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
      className={`flex h-14 items-center justify-between border-be border-border bg-surface px-4 ${className}`}
    >
      <button className="flex items-center gap-2.5" onClick={() => navigate('/dashboard')} aria-label={t('app.title')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="27" fill="none" viewBox="0 0 48 46" aria-hidden="true">
          <path fill="var(--accent)" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
        </svg>
        <span className="text-xl font-bold tracking-tight text-accent">
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
            <span className="absolute inset-e-1 inset-bs-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-canvas">
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
