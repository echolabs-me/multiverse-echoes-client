/**
 * Predicate helper for the `<TranslationPending>` marker.
 *
 * Lives in `lib/` rather than alongside the component so the component file
 * only exports React components (required by `react-refresh/only-export-components`).
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part G Step 20.
 */

/**
 * Returns true when the given `content_locale` indicates the API is still
 * serving English content for this user, but the user's active locale is
 * non-English. Returns false for English users or when content_locale
 * already matches the user's locale (content is in sync — no marker needed).
 */
export function shouldShowTranslationPending(
  contentLocale: string | null | undefined,
  userLocale: string,
): boolean {
  if (userLocale === 'en') return false;
  if (!contentLocale) return false;
  return contentLocale === 'en';
}
