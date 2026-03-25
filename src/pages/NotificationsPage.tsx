import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BookOpen,
  Zap,
  MessageSquare,
  UserPlus,
  Bell,
  MapPin,
  Sparkles,
  Settings,
  CheckCheck,
} from 'lucide-react';
import {
  TopBar,
  Button,
  Spinner,
  EmptyState,
} from '../components/index.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import type { Notification } from '../types/api.ts';

const categoryIcons: Record<string, typeof Bell> = {
  echo_life_event: Zap,
  echo_diary: BookOpen,
  community_message: MessageSquare,
  follow: UserPlus,
  system: Bell,
  travel: MapPin,
  influence: Sparkles,
  DailyDigest: BookOpen,
};

function getCategoryIcon(category: string) {
  const Icon = categoryIcons[category] ?? Bell;
  return <Icon size={16} className="text-accent" aria-hidden="true" />;
}

function getNavigationTarget(notification: Notification): string | null {
  // Parse notification body or category to determine navigation target
  if (notification.category === 'echo_life_event' || notification.category === 'echo_diary') {
    return '/dashboard';
  }
  if (notification.category === 'community_message') {
    return '/community';
  }
  if (notification.category === 'follow') {
    return '/feeds/social';
  }
  if (notification.category === 'travel') {
    return '/dashboard';
  }
  return null;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markRead,
  } = useNotificationStore();

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      await markRead(n.notification_id);
    }
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.read) {
      await markRead(notification.notification_id);
    }
    const target = getNavigationTarget(notification);
    if (target) {
      navigate(target);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => {}}
        onProfileClick={() => navigate('/settings')}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-text-primary">
              {t('notifications.title')}
            </h1>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => void handleMarkAllRead()}
              >
                <CheckCheck size={16} />
                {t('common.markAllRead')}
              </Button>
            )}
          </div>

          {/* Link to preferences */}
          <button
            onClick={() => navigate('/settings')}
            className="mb-6 flex items-center gap-1 text-sm text-accent hover:text-accent/80"
          >
            <Settings size={14} />
            {t('notifications.preferencesLink')}
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              title={t('notifications.empty')}
              description={t('notifications.emptyDesc')}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map((notification) => (
                <button
                  key={notification.notification_id}
                  onClick={() => void handleClick(notification)}
                  className={`w-full rounded-lg border text-left transition-colors ${
                    notification.read
                      ? 'border-border bg-surface'
                      : 'border-accent/30 bg-accent-subtle'
                  } p-4 hover:border-accent`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getCategoryIcon(notification.category)}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          notification.read ? 'text-text-primary' : 'text-accent'
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-sm text-text-secondary">
                        {notification.body}
                      </p>
                      <span className="mt-1 text-xs text-text-muted">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>
                    {!notification.read && (
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
