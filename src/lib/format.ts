/**
 * Currency + numeric formatting helpers.
 *
 * Sister module to `formatDate.ts`. These helpers do NOT read from
 * `i18n.language` — currency display is locale-as-argument because
 * cents → dollars is an admin-dashboard concern (always USD; per
 * ME-MIS-001 §1.1 the platform's pricing-page SSOT is USD-denominated)
 * but the digit grouping and decimal separator should follow the
 * caller's intent. Default locale is `en-US`.
 */

/**
 * Format a USD amount expressed in integer cents.
 *
 * Negative inputs render with the locale's negative-currency convention
 * (e.g. `-$123.45` in `en-US`, `-123,45 $` in `de-DE` for USD).
 * Zero renders as `$0.00`.
 *
 * `cents` is treated as an integer; fractional cent inputs are rounded
 * by `Intl.NumberFormat` per its own rounding behaviour (banker's
 * rounding on most engines). Callers should pass integer cents.
 */
export function formatUsdCents(cents: number, locale: string = 'en-US'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}
