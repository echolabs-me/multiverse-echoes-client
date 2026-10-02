import { readdirSync } from 'fs';

/**
 * The locales `npm run check-i18n` checks: every `.json` file in the locale
 * folder other than `en.json`, the source, sorted (R266.5). A folder with no
 * other locale is an error, so the checks cannot pass by reading nothing.
 * @param {string} dir the locale folder
 * @returns {string[]} locale codes
 */
export function localeCodes(dir) {
  const codes = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'en.json')
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
  if (codes.length === 0) {
    throw new Error(`${dir} holds no locale file other than en.json`);
  }
  return codes;
}
