/**
 * Format a server-provided simulated_date string ("Day 102 Hour 4")
 * into the user's locale via the diary.dayHour i18n key.
 *
 * Each locale defines its own word order:
 *   en:      "Day {{day}} Hour {{hour}}"
 *   zh-Hans: "第{{day}}天 第{{hour}}时"
 *   ar:      "اليوم {{day}} الساعة {{hour}}"
 *
 * Falls back to the raw string if parsing fails.
 */
import i18n from '../i18n';

const DAY_HOUR_RE = /Day\s+(\d+)\s+Hour\s+(\d+)/i;

export function formatSimDate(simDate: string): string {
  const match = DAY_HOUR_RE.exec(simDate);
  if (!match) return simDate;
  return i18n.t('diary.dayHour', { day: match[1], hour: match[2] });
}
