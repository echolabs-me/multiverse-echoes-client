import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../Button.tsx';
import { adminBilling } from '../../../lib/api/endpoints.ts';
import { useToastStore } from '../../../stores/useToastStore.ts';

interface Props {
  onInserted: () => void;
}

export function TriggerSnapshotButton({ onInserted }: Props) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await adminBilling.triggerRevenueSnapshot();
      if (res.outcome === 'inserted') {
        addToast(t('admin.billing.snapshot.insertedToast'), 'success');
        onInserted();
      } else {
        addToast(
          t('admin.billing.snapshot.alreadyExistsToast', {
            period: res.period_start.slice(0, 10),
          }),
          'info',
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`${t('admin.billing.snapshot.errorPrefix')}: ${msg}`, 'danger', {
        platformLink: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      disabled={busy}
      data-testid="admin-billing-trigger-snapshot-button"
    >
      {t('admin.billing.snapshot.triggerButton')}
    </Button>
  );
}
