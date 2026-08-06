/**
 * Removes personal filesystem paths from a load order before it is submitted.
 *
 * BG3 Mod Manager writes the full path of a pak into some exported entries, and
 * that path contains the account name of whoever exported it. A submitted order
 * becomes a public GitHub issue and then a corpus file published under CC0, so
 * anything left in it is republished under a stranger's name without them ever
 * choosing to. One order reached the repository that way, and removing it later
 * meant rewriting git history.
 *
 * This runs in the browser, before the order is sent, so the name never leaves
 * the machine at all. The same scrub runs again at the API and again at intake,
 * because the GitHub issue form bypasses this file entirely and a cached copy
 * of the app could be months old.
 *
 * Only the final path segment is kept, which is the only part anything reads.
 */

/**
 * Drive-letter paths, matched on backslashes alone.
 *
 * Allowing forward slashes as well makes "https://host/a/b" satisfy the
 * drive-letter pattern, and an earlier version of this rewrote the URLs in a
 * mod's description because of exactly that. A Windows path uses backslashes
 * and a URL never does.
 */
const WINDOWS_PATH = /(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)*([^\\\t"\r\n]+)/g;

/**
 * macOS and Linux home directories, where the segment after home is the name.
 *
 * The lookbehind keeps URLs intact: in "example.com/Users/team/file" the
 * character before the slash is a letter, so it is a path inside an address
 * rather than a filesystem root, and rewriting somebody's URL is its own kind
 * of damage.
 */
const UNIX_HOME = /(?<![A-Za-z0-9])\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g;

/**
 * The order with personal paths reduced to bare file names.
 *
 * Safe to run on any text, including an order that contains none, and it never
 * touches anything that is not a path.
 */
export function scrubPersonalPaths(text: string): string {
  if (!text) return text;
  return text
    .replace(WINDOWS_PATH, (_match, basename: string) => basename)
    .replace(UNIX_HOME, (_match, basename: string) => basename);
}

/** Whether any personal path remains, used to tell the user what was removed. */
export function containsPersonalPath(text: string): boolean {
  return text !== scrubPersonalPaths(text);
}
