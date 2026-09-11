/**
 * Dates as the site writes them, from the YYYY-MM-DD the corpus carries.
 * Done by hand rather than through the locale so the prerendered page and
 * the browser agree on every character.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The full date, as in 9 September 2026.
 *
 * @param iso a date such as 2026-09-09
 * @returns the day, the month's name and the year
 */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * The date at axis width, as in 9 Sep.
 *
 * @param iso a date such as 2026-09-09
 * @returns the day and the month's first three letters
 */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1].slice(0, 3)}`;
}
