import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { TopBar, Card, Button, Input } from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { account as accountApi } from '../lib/api/endpoints.ts';

export function DeleteAccountPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((s) => s.addToast);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await accountApi.deleteAccount();
      addToast(t('settings.deleteAccountGrace', { days: 30 }), 'info');
      await logout();
      navigate('/login');
    } catch {
      addToast(t('common.error'), 'danger');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await accountApi.cancelDeletion();
      addToast(t('settings.deletionCancelled'), 'success');
      navigate('/settings');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => navigate('/notifications')}
        onProfileClick={() => navigate('/settings')}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl p-6">
          <button
            onClick={() => navigate('/settings')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <Card>
            <div className="mb-4 flex items-center gap-2 text-danger">
              <AlertTriangle size={20} />
              <h1 className="text-lg font-bold">{t('settings.deleteAccount')}</h1>
            </div>

            <p className="mb-4 text-sm text-text-secondary">
              {t('settings.deleteAccountWarning')}
            </p>

            <div className="mb-4">
              <Input
                label={t('settings.deleteAccountConfirm')}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={confirmText !== 'DELETE' || isDeleting}
              >
                {t('settings.deleteAccount')}
              </Button>
              <Button variant="secondary" onClick={() => void handleCancel()}>
                {t('settings.cancelDeletion')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
