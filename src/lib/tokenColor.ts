/**
 * Canvas 2D colour extraction from CSS design tokens.
 *
 * Resolves computed CSS custom property values from the document root so that
 * Canvas 2D rendering uses the same colours as the rest of the UI, respecting
 * dark/light mode and shard accent overrides.
 *
 * @module tokenColor
 */

/**
 * Read a CSS custom property's computed value from `document.documentElement`.
 *
 * @param tokenName - The CSS custom property name, e.g. `'--canvas'` or `'--accent'`.
 * @returns The computed colour string (e.g. `'#0f1923'`), or an empty string
 *          if the property is not defined or the DOM is unavailable.
 */
export function getComputedTokenColor(tokenName: string): string {
  if (typeof document === 'undefined') return '';
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(tokenName)
    .trim();
  return value;
}
