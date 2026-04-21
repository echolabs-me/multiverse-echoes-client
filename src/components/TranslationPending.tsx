import { useTranslation } from 'react-i18next';

/**
 * Small italic muted label shown alongside content that is temporarily being
 * served in English to a non-English user, while the outbound translation
 * pipeline (CC TASK 3) backfills the locale translation.
 *
 * Usage pattern: a diary entry / life event / relationship description
 * returned by the API includes a `content_locale` field. When the client
 * user's locale is non-English but `content_locale === "en"`, wrap the
 * English text with this marker so the user understands why they're seeing
 * English mid-page. The marker disappears automatically on the next refetch
 * once the translation worker has persisted the localised version.
 *
 * The `shouldShowTranslationPending` predicate helper lives in a separate
 * module (`../lib/translationPending.ts`) so this file stays a pure
 * component export — otherwise React Fast Refresh breaks on this file.
 *
 * Matches the existing visual vocabulary of the "Arriving at [shard]…"
 * travel indicator — muted italic text-accent. No layout impact.
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part G Step 20.
 */
export function TranslationPending() {
  const { t } = useTranslation();
  return (
    <span
      className="ms-2 inline-block text-[11px] text-accent/70 italic"
      aria-live="polite"
    >
      {t('common.translationPending', 'Translating\u2026')}
    </span>
  );
}
