/**
 * Per-route title, description and canonical.
 *
 * The site is one HTML file with client-side routing, so without this every
 * route serves the same title and description and search engines see seven
 * duplicates of the home page. Wouter changes the URL without a page load, so
 * the tags have to be rewritten as the route changes.
 *
 * The canonical is written from the route rather than from location.href, so
 * tracking parameters and the Cloudflare deploy preview domains all point at
 * the real URL.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';

export const SITE = 'https://volobg3.com';

interface PageMeta {
  title: string;
  description: string;
  /** Kept out of the index: no useful content without a session behind it. */
  noindex?: boolean;
}

/**
 * Descriptions are written to be read in a result, not stuffed. Titles stay
 * under about sixty characters so they survive truncation.
 */
export const PAGES: Record<string, PageMeta> = {
  '/': {
    title: "VOLO: Load Order Sorting for Baldur's Gate 3",
    description:
      "Sort your Baldur's Gate 3 mod load order against orders players have " +
      'actually played on. Runs in your browser, nothing to install, and every ' +
      'placement shows its reasoning.',
  },
  '/import': {
    title: 'Import a load order | VOLO',
    description:
      "Drop in a BG3 Mod Manager export or the game's own modsettings.lsx. VOLO " +
      'reads JSON, LSX, CSV, TSV and plain lists, and the file never leaves your browser.',
  },
  '/masterlist': {
    title: "Community masterlist for BG3 mods | VOLO",
    description:
      'Browse what VOLO knows about each Baldur\'s Gate 3 mod: its category, ' +
      'where players load it, and how strong the evidence behind that is.',
  },
  '/submit': {
    title: 'Submit a load order | VOLO',
    description:
      'Played on a load order that worked, or one that broke? Submitting it ' +
      'teaches the sorter. No account needed, and submissions are public domain.',
  },
  '/about': {
    title: 'About VOLO',
    description:
      'Who builds VOLO, why a Baldur\'s Gate 3 load order sorter needed to exist, '
      + 'how the masterlist is put together, and the reasons to be sceptical of it.',
  },
  '/measured': {
    title: 'How well does VOLO sort? | VOLO',
    description:
      'The measurements behind VOLO: 57.2 percent agreement with load orders it '
      + 'has never seen, against 50.4 percent for a random shuffle, plus the ideas '
      + 'that measured worse and were thrown out.',
  },
  '/donations': {
    title: 'Support VOLO',
    description: 'VOLO is free and has no ads. If it saved you an evening, you can chip in.',
  },
  '/optimise': {
    title: 'Sorted order | VOLO',
    description: 'Your sorted Baldur\'s Gate 3 load order, with the reasoning behind every placement.',
    noindex: true,
  },
  '/export': {
    title: 'Export your load order | VOLO',
    description: 'Write your sorted order back out for BG3 Mod Manager or the game itself.',
    noindex: true,
  },
};

/** Aliases resolve to the canonical route so they do not compete with it. */
export const ALIASES: Record<string, string> = {
  '/optimizer': '/optimise',
  '/support': '/donations',
};

/** Used for any address with no entry above, so a stray URL is never indexed. */
export const NOT_FOUND: PageMeta = {
  title: 'Page not found | VOLO',
  description: 'That page does not exist.',
  noindex: true,
};

/** Creates the tag if it is missing, so index.html only needs the defaults. */
function setMeta(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
}

/**
 * Keeps the document head in step with the current route.
 *
 * Each route is prerendered with these tags already in place, so this exists
 * for what happens afterwards: moving between routes in the browser changes the
 * URL without a page load, and the title, canonical and robots tags have to
 * follow. The robots tag matters most, because a route reached by client-side
 * navigation would otherwise keep whichever value the previous page carried.
 */
export function usePageMeta(): void {
  const [location] = useLocation();

  useEffect(() => {
    const route = ALIASES[location] ?? location;
    const meta = PAGES[route] ?? NOT_FOUND;
    const canonical = `${SITE}${route === '/' ? '/' : route}`;

    document.title = meta.title;

    setMeta(
      'meta[name="description"]',
      () => Object.assign(document.createElement('meta'), { name: 'description' }),
      el => el.setAttribute('content', meta.description),
    );

    setMeta(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      el => el.setAttribute('href', canonical),
    );

    setMeta(
      'meta[name="robots"]',
      () => Object.assign(document.createElement('meta'), { name: 'robots' }),
      el => el.setAttribute('content', meta.noindex ? 'noindex, follow' : 'index, follow'),
    );

    setMeta(
      'meta[property="og:title"]',
      () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:title');
        return el;
      },
      el => el.setAttribute('content', meta.title),
    );

    setMeta(
      'meta[property="og:description"]',
      () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:description');
        return el;
      },
      el => el.setAttribute('content', meta.description),
    );

    setMeta(
      'meta[property="og:url"]',
      () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:url');
        return el;
      },
      el => el.setAttribute('content', canonical),
    );
  }, [location]);
}
