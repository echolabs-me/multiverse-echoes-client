import { useTranslation } from 'react-i18next';

interface SkipLinkProps {
  targetId?: string;
}

export function SkipLink({ targetId = 'main-content' }: SkipLinkProps) {
  const { t } = useTranslation();

  return (
    /* Skip-link visual-hiding pattern — Lane MOCK_SHARD-cleanup Cluster
       E1. Previously used Tailwind's `sr-only focus:not-sr-only` utility
       which applies `clip: rect(0,0,0,0)` plus 1×1px sizing; Chromium
       and several screen-reader engines drop those elements from the
       sequential focus navigation order, so Tab from the body never
       reached the link (verified empirically in Phase 2F-diag-6 §6-C —
       even adding `tabIndex={0}` did not bring it back into the focus
       cycle). Replacing with off-canvas absolute positioning keeps the
       link tabbable at all times, then `focus:top-2` slides it into the
       viewport on focus. Same canonical pattern used by GitHub, MDN,
       a11yproject's reference implementation, etc. */
    <a
      href={`#${targetId}`}
      className="absolute inset-s-2 -inset-bs-12 z-50 rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas focus:inset-bs-2"
    >
      {t('common.skipToContent', 'Skip to main content')}
    </a>
  );
}
