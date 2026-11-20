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
 * The month alone, as in Sep, with the year added where a chart crosses
 * into a new one, as in Jan 2027.
 *
 * @param iso a date such as 2026-09-09
 * @param withYear whether this label has to say which year it starts
 * @returns the month's first three letters, and the year when asked
 */
export function monthLabel(iso: string, withYear = false): string {
  const [year, month] = iso.split('-').map(Number);
  const name = MONTHS[month - 1].slice(0, 3);
  return withYear ? `${name} ${year}` : name;
}
