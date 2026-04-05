/**
 * Locale-aware date/time formatting utilities.
 *
 * Use these instead of calling `toLocaleDateString()` / `toLocaleTimeString()`
 * directly. Direct calls default to the *browser* locale, not the app locale
 * selected via i18n — so a French-UI user on a Korean browser would see
 * Korean-formatted dates inside the otherwise-French app.
 *
 * All functions read the active locale from `i18n.language` at call time,
 * which means React re-renders triggered by `i18n.on('languageChanged', ...)`
 * will automatically refresh formatted dates.
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part E Step 14.
 */
import i18n from '../i18n';

/**
 * Map an i18next locale code to the BCP-47 tag the Intl API expects.
 *
 * Most of our locales are already valid BCP-47 (`en`, `hi`, `es`, `ar`, `fr`),
 * but `zh-Hans` needs to be mapped to `zh-Hans-CN` or `zh-CN` for Intl to
 * produce Simplified-Chinese-specific formatting. We use `zh-CN` which is the
 * most widely supported CLDR locale for Simplified Chinese.
 */
function intlLocale(appLocale: string): string {
  if (appLocale === 'zh-Hans') return 'zh-CN';
  return appLocale;
}

/**
 * Format a date using the current app locale.
 *
 * @param date    A Date object or an ISO-8601 string (as returned by the API).
 * @param options Standard `Intl.DateTimeFormat` options. Defaults to
 *                `{ year: 'numeric', month: 'short', day: 'numeric' }`.
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(intlLocale(i18n.language), options);
}

/**
 * Format a time (hour + minute by default) using the current app locale.
 */
export function formatTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(intlLocale(i18n.language), options);
}

/**
 * Format a date as a relative time using `Intl.RelativeTimeFormat`.
 * Replaces the hand-templated `communityFeed.justNow` / `minutesAgo` / etc.
 * keys with CLDR-correct phrasing in every locale.
 *
 * Past dates return negative deltas (e.g. "5 minutes ago" in English,
 * "il y a 5 minutes" in French, "قبل 5 دقائق" in Arabic).
 * Future dates return positive deltas ("in 5 minutes", etc.).
 *
 * The unit auto-selects based on magnitude: seconds → minutes → hours → days.
 * Beyond 7 days, falls back to an absolute `formatDate` to avoid awkward
 * phrasings like "372 days ago".
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';

  const locale = intlLocale(i18n.language);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absMs = Math.abs(diffMs);

  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(diffMs / 60_000);
  const hours = Math.round(diffMs / 3_600_000);
  const days = Math.round(diffMs / 86_400_000);

  if (absMs < 60_000) return rtf.format(seconds, 'second');
  if (absMs < 3_600_000) return rtf.format(minutes, 'minute');
  if (absMs < 86_400_000) return rtf.format(hours, 'hour');
  if (absMs < 7 * 86_400_000) return rtf.format(days, 'day');

  // Beyond a week — fall back to an absolute short date.
  return formatDate(d, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format a date and time together — convenience for timestamps displayed
 * in a single string (e.g. "5 Apr 2026, 14:32").
 */
export function formatDateTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(intlLocale(i18n.language), options);
}
