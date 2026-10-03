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
import { Button, Spinner, EmptyState } from '../components/index.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useInFlight } from '../hooks/useInFlight.ts';
import { markers } from '../lib/inFlightMarkers.ts';
import { trackEvent } from '../lib/analytics.ts';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';
import { useToastStore } from '../stores/useToastStore.ts';
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
  if (
    notification.category === 'echo_life_event' ||
    notification.category === 'echo_diary'
  ) {
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

  const addToast = useToastStore((s) => s.addToast);

  const inFlight = useInFlight();

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const showFailure = (err: unknown) =>
    addToast(translateCaughtError(err), 'danger', {
      platformLink: isPlatformError(err),
    });

  // Opening a row and "mark all read" send the same write, so both hold the
  // row's `markers.markRead` marker. A row whose read is in flight is
  // skipped, and one already read, by the store as it is now, is not sent
  // (R285.2).
  const isReadNow = (id: string) =>
    useNotificationStore
      .getState()
      .notifications.some((n) => n.notification_id === id && n.read);

  const readOnce = (id: string) =>
    inFlight.run(markers.markRead(id), async () => {
      if (!isReadNow(id)) await markRead(id);
    });

  const handleMarkAllRead = async () => {
    await inFlight.run(markers.markAllRead(), async () => {
      const unread = notifications.filter((n) => !n.read);
      trackEvent('notification.dismissed', { count: unread.length });
      try {
        for (const n of unread) {
          await readOnce(n.notification_id);
        }
      } catch (err) {
        showFailure(err);
      }
    });
  };

  const handleClick = async (notification: Notification) => {
    await inFlight.run(
      markers.markRead(notification.notification_id),
      async () => {
        trackEvent('notification.clicked', { category: notification.category });
        try {
          if (!isReadNow(notification.notification_id)) {
            await markRead(notification.notification_id);
          }
        } catch (err) {
          showFailure(err);
          return;
        }
        const target = getNavigationTarget(notification);
        if (target) {
          navigate(target);
        }
      },
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <div className="mbe-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">
            {t('notifications.title')}
          </h1>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              disabled={inFlight.isHeld(markers.markAllRead())}
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
          className="mbe-6 flex items-center gap-1 text-sm text-accent hover:text-accent/80"
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
                disabled={inFlight.isHeld(
                  markers.markRead(notification.notification_id),
                )}
                onClick={() => void handleClick(notification)}
                className={`w-full rounded-lg border text-start transition-colors ${
                  notification.read
                    ? 'border-border bg-surface'
                    : 'border-accent/30 bg-accent-subtle'
                } p-4 hover:border-accent`}
              >
                <div className="flex items-start gap-3">
                  <div className="mbs-0.5">
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
                    <p className="mbs-0.5 text-sm text-text-secondary">
                      {notification.body}
                    </p>
                    <span className="mbs-1 text-xs text-text-muted">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  {!notification.read && (
                    <div className="mbs-1 size-2 shrink-0 rounded-full bg-accent" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
