import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal.tsx';
import { Button } from '../../Button.tsx';
import { adminBilling } from '../../../lib/api/endpoints.ts';
import { useToastStore } from '../../../stores/useToastStore.ts';
import type {
  CryptoBillingProvider,
  DunningPhase,
} from '../../../types/generated.ts';

const ALL_PHASES: DunningPhase[] = [
  'active',
  'renewal_pending',
  'renewal_imminent',
  'grace_period',
  'lapsed',
];

const REASON_MAX = 500;

function dunningPhaseI18nKey(phase: DunningPhase): string {
  switch (phase) {
    case 'active':
      return 'active';
    case 'renewal_pending':
      return 'renewalPending';
    case 'renewal_imminent':
      return 'renewalImminent';
    case 'grace_period':
      return 'gracePeriod';
    case 'lapsed':
      return 'lapsed';
  }
}

interface Props {
  open: boolean;
  userId: string;
  provider: CryptoBillingProvider;
  currentPhase: DunningPhase;
  onClose: () => void;
  onSuccess: () => void;
}

export function OverrideDunningPhaseModal({
  open,
  userId,
  provider,
  currentPhase,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const targetPhases = ALL_PHASES.filter((p) => p !== currentPhase);
  const [targetPhase, setTargetPhase] = useState<DunningPhase>(targetPhases[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonValid = reason.length >= 1 && reason.length <= REASON_MAX;

  const handleSubmit = async () => {
    if (!reasonValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminBilling.overrideDunningState(userId, provider, {
        target_phase: targetPhase,
        override_reason: reason,
      });
      addToast(t('admin.billing.override.successToast'), 'success');
      setReason('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('admin.billing.override.title')}
    >
      <div
        className="space-y-4"
        data-testid="override-dunning-phase-modal-root"
      >
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          <span>{t('admin.billing.override.targetPhaseLabel')}</span>
          <select
            value={targetPhase}
            onChange={(e) => setTargetPhase(e.target.value as DunningPhase)}
            className="rounded-sm border border-border bg-canvas px-2 py-1 text-text-primary"
            data-testid="override-target-phase-select"
          >
            {targetPhases.map((p) => (
              <option key={p} value={p}>
                {t(`admin.billing.dunning.phase.${dunningPhaseI18nKey(p)}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          <span>{t('admin.billing.override.reasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.billing.override.reasonPlaceholder')}
            rows={4}
            maxLength={REASON_MAX}
            className="rounded-sm border border-border bg-canvas px-2 py-1 text-text-primary"
            data-testid="override-reason-textarea"
          />
          <span className="text-xs text-text-muted">
            {t('admin.billing.override.reasonCounter', {
              current: reason.length,
              max: REASON_MAX,
            })}
          </span>
        </label>

        {error && (
          <p
            className="text-sm text-danger"
            role="alert"
            data-testid="override-error-message"
          >
            {t('admin.billing.override.errorPrefix')}: {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            data-testid="override-cancel-button"
          >
            {t('admin.billing.override.cancelButton')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reasonValid || submitting}
            data-testid="override-submit-button"
          >
            {t('admin.billing.override.submitButton')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
