/**
 * Safe localStorage wrappers — guard every read + parse against
 * exceptions so a single corrupted key cannot crash-loop the app.
 *
 * Crash-loop class: the app boots, a module-level or store-factory
 * `localStorage.getItem` / `JSON.parse` throws, ErrorBoundary shows
 * the fallback, user hits reload → same throw on the same bytes →
 * stuck unless they manually clear site data.
 *
 * Two failure modes this module guards against:
 *
 *   1. `localStorage` access itself throws. Happens in some sandbox
 *      contexts (cross-origin iframes with storage-access restrictions,
 *      older Safari private-browsing mode, user-disabled site storage).
 *      The whole `localStorage` object call throws — any read, write,
 *      or remove is a crash vector.
 *
 *   2. Stored JSON is malformed. Pre-existing data from an older app
 *      version that changed the shape, truncated bytes from a
 *      storage-quota event, user-edited dev-tools tampering, a
 *      mid-write crash on a previous tab.
 *
 * On either failure: log context-bearing `console.error`, clear the
 * specific key that failed (not the whole storage — unrelated keys
 * like locale selection must survive an auth corruption), return a
 * sentinel (null / fallback) so the caller proceeds with default
 * state. The user sees a fresh boot (login prompt, empty echo
 * ordering, etc.) instead of a crash-reload loop.
 *
 * Token-aware redaction in the log: any value > 40 chars gets
 * truncated, and the `auth`-related keys (`access_token`,
 * `refresh_token`) get blanked entirely because even a fragment is
 * a credentials leak into the browser console. See the sanitize()
 * helper below.
 */

/** Keys whose values MUST NOT appear in any log output. */
const CREDENTIAL_KEYS = new Set(['access_token', 'refresh_token']);

/** Safe prefix of a value for diagnostic logging. */
function sanitize(key: string, value: string | null | undefined): string {
  if (value === null || value === undefined) return '<empty>';
  if (CREDENTIAL_KEYS.has(key)) return '<redacted credential>';
  if (value.length <= 40) return value;
  return `${value.slice(0, 40)}…(${String(value.length)} chars)`;
}

/**
 * Read a raw string from localStorage. Returns null on any exception
 * or if the key is missing. Clears the key on parse-level corruption
 * reporting (there's no parse here — this is the raw-string path).
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    // localStorage itself threw (SecurityError, QuotaExceededError in rare
    // read paths on Firefox, etc.). Nothing to clear — we can't reach the
    // storage anyway. Log and proceed with null.
    // eslint-disable-next-line no-console -- intentional diagnostic output on crash-loop-adjacent storage failure
    console.error(
      `[safeStorage] localStorage.getItem('${key}') threw:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Write a raw string to localStorage. Swallows exceptions — a write
 * failure is non-fatal (the user just doesn't get their preference
 * persisted). Logs context.
 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    // eslint-disable-next-line no-console -- intentional diagnostic output on storage write failure
    console.error(
      `[safeStorage] localStorage.setItem('${key}', ...) threw:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Remove a key. Swallows exceptions.
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // eslint-disable-next-line no-console -- intentional diagnostic output on storage remove failure
    console.error(
      `[safeStorage] localStorage.removeItem('${key}') threw:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Read + JSON.parse a key, returning `fallback` on any failure class.
 * On parse failure specifically: clear the corrupted key so the next
 * boot starts clean (no crash-reload loop). On localStorage-access
 * failure: don't clear (we can't).
 *
 * Distinguishes the two failure classes in logs:
 *   - SyntaxError → stored bytes are malformed; this is the primary
 *     crash-loop surface the Founder named.
 *   - Other Error → localStorage itself threw; storage unavailable.
 *
 * Narrow clearing (only the failing key) is deliberate — an unrelated
 * corrupt key must not log the user out mid-session, must not reset
 * their theme, must not clear their locale.
 */
export function safeGetJSON<T>(key: string, fallback: T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    // eslint-disable-next-line no-console -- intentional diagnostic output on storage access failure
    console.error(
      `[safeStorage] localStorage.getItem('${key}') threw:`,
      err instanceof Error ? err.message : String(err),
    );
    return fallback;
  }

  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (parseErr) {
    // eslint-disable-next-line no-console -- intentional diagnostic output on malformed-JSON crash-loop recovery
    console.error(
      `[safeStorage] JSON.parse of '${key}' failed (value: ${sanitize(
        key,
        raw,
      )}):`,
      parseErr instanceof Error ? parseErr.message : String(parseErr),
    );
    // Clear the specific corrupted key so the next boot starts clean.
    safeRemoveItem(key);
    return fallback;
  }
}
