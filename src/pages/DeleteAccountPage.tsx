import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Card, Button, Input } from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { account as accountApi } from '../lib/api/endpoints.ts';
import { trackEvent } from '../lib/analytics.ts';
import { useInFlight } from '../hooks/useInFlight.ts';
import { markers } from '../lib/inFlightMarkers.ts';

export function DeleteAccountPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const inFlight = useInFlight();
  const addToast = useToastStore((s) => s.addToast);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await accountApi.deleteAccount();
      trackEvent('account.deletion_initiated', { tier: 'Free' });
      addToast(t('settings.deleteAccountGrace', { days: 30 }), 'info');
      // The sidebar's Log out sends the same write, so both hold one marker
      // (R288.5). If it is held, this page sends nothing and leaves the
      // navigation to the logout in flight (R294.3).
      await inFlight.run(markers.logout(), async () => {
        await logout();
        navigate('/login');
      });
    } catch (err) {
      addToast(translateCaughtError(err, t('common.error')), 'danger', {
        platformLink: isPlatformError(err),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    // Just go back to settings. The cancel-deletion API is only needed
    // if the account is already in PendingDeletion state (after DELETE
    // was confirmed). This button dismisses the page without action.
    navigate('/settings');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl p-6">
        <button
          onClick={() => navigate('/settings')}
          className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <Card>
          <div className="mbe-4 flex items-center gap-2 text-danger">
            <AlertTriangle size={20} />
            <h1 className="text-lg font-bold">{t('settings.deleteAccount')}</h1>
          </div>

          <p className="mbe-4 text-sm text-text-secondary">
            {t('settings.deleteAccountWarning')}
          </p>

          <div className="mbe-4">
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
              disabled={
                confirmText !== 'DELETE' ||
                isDeleting ||
                inFlight.isHeld(markers.logout())
              }
            >
              {t('settings.deleteAccount')}
            </Button>
            <Button variant="secondary" onClick={handleCancel}>
              {t('settings.cancelDeletion')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
