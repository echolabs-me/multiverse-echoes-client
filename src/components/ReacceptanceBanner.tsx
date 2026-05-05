import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileWarning } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { account } from '../lib/api/endpoints.ts';

/**
 * Persistent app-shell banner that surfaces a stale ToS acceptance and
 * lets the user accept the current version inline. Mounted in
 * `AppLayout` above `<main>` next to `BillingBanner`. Renders nothing
 * unless `user.requires_tos_reacceptance === true` AND
 * `useAuthStore.currentTosVersion` is populated.
 *
 * Both signals come from the same response shapes: login populates
 * both, and `/account/me` (read at app boot via `initialize` and on
 * `fetchProfile` after acceptance) carries `current_tos_version`
 * alongside `requires_tos_reacceptance`. The null-check on the
 * version is defensive — under correct server config it is always
 * present, but suppressing rather than crashing on a missing value
 * keeps the banner from rendering an unsubmittable form.
 *
 * The server does NOT block requests on a stale version. The banner is
 * a presentation-layer gate per ME-ILF-001 §3.1.1: the user can keep
 * navigating, but the banner persists until acceptance is recorded.
 *
 * Reference: ME-ILF-001 §3.1, §3.1.1 (Lane S Block A.5).
 */
export function ReacceptanceBanner() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const currentTosVersion = useAuthStore((s) => s.currentTosVersion);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user?.requires_tos_reacceptance || !currentTosVersion) {
    return null;
  }

  const onAccept = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await account.acceptTos(currentTosVersion);
    } catch {
      setError(t('errors.TOS_VERSION_MISMATCH'));
      setSubmitting(false);
      return;
    }

    // acceptTos succeeded; the server has recorded the acceptance.
    // A fetchProfile failure now is a recoverable client-side state
    // refresh problem — surface a separate error and reset submitting
    // so the user can retry (clicking again will re-attempt the
    // profile refresh; the server-side acceptance is idempotent on
    // the same version).
    try {
      await fetchProfile();
    } catch {
      setError(t('errors.profileRefreshFailed'));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-3 border-be border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
      role="alert"
      data-testid="reacceptance-banner-root"
    >
      <FileWarning size={18} className="shrink-0" />
      <span
        className="min-w-0 flex-1"
        data-testid="reacceptance-banner-message"
      >
        {error ?? t('legal.tosUpdatedBanner')}
      </span>
      <button
        type="button"
        onClick={() => {
          void onAccept();
        }}
        disabled={submitting}
        className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-medium text-canvas hover:bg-accent/90 disabled:opacity-60"
        data-testid="reacceptance-banner-accept-button"
      >
        {submitting
          ? t('legal.tosUpdatedAccepting')
          : t('legal.tosUpdatedAcceptButton')}
      </button>
    </div>
  );
}
