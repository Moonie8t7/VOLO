/**
 * Small counts as words, because "ten working orders" reads as prose and
 * "10 working orders" reads as a spreadsheet. The counts come from generated
 * data now, so the words have to be generated too; past twenty a numeral is
 * the honest rendering anyway.
 */

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** Sentence-initial variant. */
export function countWordCap(n: number): string {
  const w = countWord(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
}
