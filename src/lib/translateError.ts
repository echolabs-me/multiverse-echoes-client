/**
 * Translate a server-emitted error code into the user's locale.
 *
 * The API returns errors as `{ error: { code: "...", message: "..." } }`.
 * This helper looks up `errors.{code}` in the active i18n bundle and falls
 * back to `error.message` (which is always English from the server) when the
 * code isn't known locally.
 *
 * Why not just call the errors namespace directly at every call site? Two reasons:
 *   1. If a new error code lands on the server before the locale bundles are
 *      updated, direct `t()` calls would render the raw key to the user
 *      (e.g. "errors.NEW_CODE"). This helper falls through to the English
 *      `error.message` the server sent, which is always a safe default.
 *   2. Centralising the translation contract in one function lets us add
 *      tracking/logging for unknown codes in a single place.
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part F Step 15.
 */
import i18n from '../i18n';

/** Shape of the server error envelope as returned by `ApiError::into_response`. */
export interface ServerErrorEnvelope {
  code?: string;
  message?: string;
}

/**
 * Translate a server error envelope to a user-facing string in the active locale.
 *
 * @param envelope The `error` field from the API response.
 * @param fallback Optional last-resort fallback when neither a translation nor
 *                 an English message is available (e.g. a generic
 *                 "Something went wrong" from the caller).
 */
export function translateError(
  envelope: ServerErrorEnvelope | string | null | undefined,
  fallback?: string,
): string {
  // Legacy path: some older code throws a plain string. Treat as a message.
  if (typeof envelope === 'string') return envelope;
  if (!envelope) return fallback ?? i18n.t('errors.INTERNAL_ERROR');

  const { code, message } = envelope;

  if (code) {
    const key = `errors.${code}`;
    const translated = i18n.t(key);
    // i18next returns the key itself when the translation is missing.
    // Only accept the translation if it's genuinely different from the key,
    // otherwise fall through to the English server message.
    if (translated && translated !== key) {
      return translated;
    }
  }

  if (message) return message;
  return fallback ?? i18n.t('errors.INTERNAL_ERROR');
}
