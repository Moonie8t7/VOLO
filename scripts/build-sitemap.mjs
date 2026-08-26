#!/usr/bin/env node
/**
 * Writes public/sitemap.xml with a `lastmod` taken from git.
 *
 *   node scripts/build-sitemap.mjs
 *
 * A hand-typed lastmod is worse than none: it freezes on the day someone
 * remembered to edit it, and then every page claims a freshness it does not
 * have. Google treats dates that do not track real change as a bad signal, so
 * each route's date comes from the last commit that touched the files behind
 * it. No git, no dates, rather than invented ones.
 *
 * Routes that need a load order already in the session are left out; they carry
 * noindex in client/src/lib/head.ts instead.
 */

import fs from 'fs';
import { execFileSync } from 'child_process';

const SITE = 'https://volobg3.com';

/**
 * Each route with the sources that decide when it last changed. The landing
 * page is listed against the whole client because its copy summarises the tool.
 */
const ROUTES = [
  {
    path: '/',
    priority: '1.0',
    sources: ['client/src/pages/LandingPage.tsx', 'client/index.html'],
    /*
     * The only content image on the site. Declaring it costs a few lines and
     * removes any dependence on the crawler noticing an image inside a picture
     * element it has to render JavaScript to reach.
     */
    images: [
      {
        loc: '/assets/volo-sorted-order-preview.v3.png',
        title: 'A sorted Baldur\'s Gate 3 load order in VOLO',
        caption:
          'Each mod shows its position, how far it moved, the section it belongs '
          + 'to, and whether the placement came from a played order, a listing or a guess.',
      },
    ],
  },
  {
    path: '/import',
    priority: '0.9',
    sources: ['client/src/pages/ImportPage.tsx', 'client/src/lib/parser.ts'],
  },
  {
    path: '/masterlist',
    priority: '0.8',
    changefreq: 'daily',
    sources: ['client/src/pages/MasterlistPage.tsx', 'masterlist/bg3-masterlist.json'],
  },
  {
    path: '/measured',
    priority: '0.8',
    sources: ['client/src/pages/MeasuredPage.tsx', 'docs/decisions.md'],
  },
  {
    path: '/about',
    priority: '0.7',
    sources: ['client/src/pages/AboutPage.tsx'],
  },
  {
    path: '/submit',
    priority: '0.7',
    sources: ['client/src/pages/SubmitPage.tsx'],
  },
  /*
   * Listed against the files it describes as well as itself: the page is a
   * statement about what the storage and submission code does, so it is stale
   * the moment either changes without it.
   */
  {
    path: '/privacy',
    priority: '0.4',
    sources: [
      'client/src/pages/PrivacyPage.tsx',
      'client/src/lib/store.tsx',
      'client/src/lib/scrub.ts',
      'functions/api/submit.js',
    ],
  },
  {
    path: '/donations',
    priority: '0.3',
    sources: ['client/src/pages/DonationsPage.tsx'],
  },
];

/**
 * Whether git here has the history to answer the question at all.
 *
 * A shallow clone holds one commit, so `git log -1 -- <file>` reports that
 * commit for every file and every route claims it changed today. The workflows
 * check out shallow by default, which is how the deployed sitemap came to
 * stamp the build date on pages untouched for days: exactly the invented
 * freshness the file header says is worse than no date. Checkouts now ask for
 * full history, and this refuses to guess if one ever does not.
 */
const shallow = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      encoding: 'utf8',
    }).trim() === 'true';
  } catch {
    return false;
  }
})();

/**
 * The dates the last full-history build wrote, read back from the file this
 * one is about to replace.
 *
 * The host that publishes the site builds it too, from its own shallow
 * checkout, so `shallow` is true there and every date was dropped: the
 * deployed sitemap carried none at all while the committed one carried all
 * eight. Reusing what a full-history build worked out is not the invented
 * freshness this file refuses to emit. It is the same date, computed from real
 * history, surviving a checkout that cannot see that history.
 */
const previousDates = (() => {
  const dates = new Map();
  try {
    const xml = fs.readFileSync('public/sitemap.xml', 'utf8');
    for (const block of xml.split('<url>').slice(1)) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
      const mod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
      if (loc && mod) dates.set(loc.replace(SITE, '') || '/', mod);
    }
  } catch {
    /* No previous sitemap on a first build. */
  }
  return dates;
})();

/** Commit date of the newest change to any of these files, as YYYY-MM-DD. */
function lastModified(sources, routePath) {
  if (shallow) return previousDates.get(routePath) ?? null;
  const dates = sources
    .filter(file => fs.existsSync(file))
    .map(file => {
      try {
        return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
          encoding: 'utf8',
        }).trim();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return dates.sort().pop() ?? null;
}

/** XML text nodes cannot carry a raw ampersand or angle bracket. */
const escapeXml = value =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entries = ROUTES.map(route => {
  const lastmod = lastModified(route.sources, route.path);
  const images = (route.images ?? []).flatMap(image => [
    '    <image:image>',
    `      <image:loc>${SITE}${image.loc}</image:loc>`,
    `      <image:title>${escapeXml(image.title)}</image:title>`,
    `      <image:caption>${escapeXml(image.caption)}</image:caption>`,
    '    </image:image>',
  ]);
  const lines = [
    '  <url>',
    `    <loc>${SITE}${route.path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    route.changefreq ? `    <changefreq>${route.changefreq}</changefreq>` : null,
    `    <priority>${route.priority}</priority>`,
    ...images,
    '  </url>',
  ].filter(Boolean);
  return { xml: lines.join('\n'), lastmod, path: route.path };
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generated by scripts/build-sitemap.mjs. Do not edit by hand. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ...entries.map(e => e.xml),
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync('public/sitemap.xml', xml);

console.log(`wrote public/sitemap.xml with ${entries.length} routes`);
if (shallow) {
  const kept = entries.filter(e => e.lastmod).length;
  console.log(`  shallow clone: ${kept} date(s) carried over from the previous sitemap,`
    + ` ${entries.length - kept} without one. Check out with fetch-depth: 0 to refresh them.`);
}
for (const e of entries) console.log(`  ${e.path.padEnd(12)} ${e.lastmod ?? 'no date'}`);
