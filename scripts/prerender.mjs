#!/usr/bin/env node
/**
 * Renders each route to static HTML after the Vite build.
 *
 *   node scripts/prerender.mjs
 *
 * The site is a single page application, so before this ran the served HTML
 * held 43 characters of text and everything else appeared only once JavaScript
 * had executed. Google renders JavaScript but queues the work, and crawlers
 * that do not render at all saw an empty document. This writes a real file per
 * route holding the same markup React produces in the browser.
 *
 * Two things fall out of that. Every route becomes a real file, so the host
 * serves it directly and public/_redirects is no longer needed to rewrite
 * paths onto the shell. And an address that is not a route now matches no file
 * at all, which is what lets 404.html answer with a genuine 404.
 *
 * The markup is whatever the app itself produces. Nothing is written here that
 * a visitor would not also see, because serving crawlers something different
 * from people is cloaking.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const DIST = 'dist';

/**
 * Inside node_modules on purpose. React is left out of the bundle so the render
 * uses the same copy the app was built against, which means Node has to be able
 * to resolve it from wherever this file sits. From the system temp directory it
 * cannot.
 */
const bundle = path.join('node_modules', '.cache', `volo-prerender-${process.pid}.mjs`);
fs.mkdirSync(path.dirname(bundle), { recursive: true });

/**
 * Routes worth a file of their own.
 *
 * /optimise and /export are deliberately included even though they are
 * noindex: a refresh on either has to return something, and their empty state
 * is a real page telling you to import an order first.
 */
const ROUTES = [
  '/', '/import', '/optimise', '/optimizer', '/export',
  '/submit', '/masterlist', '/measured', '/about', '/privacy',
  '/donations', '/support',
];

await build({
  stdin: {
    contents: `
      import { createElement } from 'react';
      import { renderToString } from 'react-dom/server';
      import App from './client/src/App';
      export { PAGES, ALIASES, NOT_FOUND, SITE } from './client/src/lib/head';
      export const render = route =>
        renderToString(createElement(App, { ssrPath: route }));
    `,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  outfile: bundle,
  logLevel: 'error',
  loader: { '.css': 'empty', '.png': 'dataurl', '.json': 'json' },
  alias: { '@': path.resolve('client/src') },
  /*
   * Several dependencies in this graph are CommonJS and call require() at load
   * time, react-dom/server for Node's stream module among them. An ES module has
   * no require, and esbuild's stand-in throws. Defining the real one satisfies
   * both: esbuild's shim uses it when it exists.
   */
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
});

/**
 * The bundle's exports, loaded through a file URL.
 *
 * Concatenating "file://" onto the path works on Unix and produces something
 * Node cannot resolve on Windows, where the path starts with a drive letter.
 */
const { render, PAGES, ALIASES, NOT_FOUND, SITE } =
  await import(pathToFileURL(path.resolve(bundle)).href);

/**
 * The built page with its root element emptied again.
 *
 * The home page is both the template every route is built from and one of the
 * outputs, so a second run would otherwise read markup it wrote itself and
 * refuse to continue. Locating the root's closing tag by the module script that
 * follows it makes the script safe to run repeatedly.
 */
function withEmptyRoot(html) {
  const marker = '<div id="root">';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error('built index.html has no root element');

  const contentStart = start + marker.length;
  const scriptAt = html.indexOf('<script type="module"', contentStart);
  const contentEnd = html.lastIndexOf('</div>', scriptAt === -1 ? html.length : scriptAt);
  if (contentEnd < contentStart) throw new Error('could not find the end of the root element');

  return html.slice(0, contentStart) + html.slice(contentEnd);
}

/**
 * Moves the stylesheet to the front of the head.
 *
 * Vite appends its tags, which left the one render-blocking request in the
 * build sitting at byte 5,098 of a 5,164 byte head, behind the structured data
 * block and the font links, and behind the module script. Two costs came out of
 * that. The browser could not ask for the stylesheet until nearly the whole
 * document had arrived, and when it did ask, the request queued behind 143kb of
 * JavaScript the page does not need in order to show text.
 *
 * Measured on the deployed site at 390px on a throttled connection: the
 * document finished at 632ms, the stylesheet was requested at 626ms and landed
 * at 1387ms, and the first paint followed it at 1428ms. The largest element is
 * a paragraph of prose that had been sitting in the markup since 632ms, so
 * 98.7 percent of the LCP was render delay rather than anything downloading.
 *
 * Moved to the top of the head, the preload scanner finds it in the first
 * packet. Nothing else about the page changes.
 */
function stylesheetFirst(html) {
  const link = html.match(/<link rel="stylesheet"[^>]*>/);
  if (!link) return html;
  const headAt = html.indexOf('<head>');
  if (headAt === -1) return html;
  const insertAt = headAt + '<head>'.length;
  return html.slice(0, insertAt)
    + `\n    ${link[0]}`
    + html.slice(insertAt).replace(link[0], '');
}

/**
 * Tells the browser the application bundle is not urgent.
 *
 * Every route here is prerendered, so the text, the links and the headings are
 * in the markup and work before a line of JavaScript runs. The bundle only
 * needs to arrive in time to make the page interactive, yet it is requested at
 * the same moment as the stylesheet and, being an order of magnitude larger,
 * takes most of the bandwidth on a slow connection while the one resource
 * holding up the first paint waits behind it.
 *
 * Marking it low priority reorders that race. Clicking a link before the
 * bundle lands still works, because the anchor is a real anchor and the page
 * it points at is a real file.
 */
function bundleLast(html) {
  return html.replace(
    /<script type="module" crossorigin src="([^"]+)"><\/script>/,
    '<script type="module" crossorigin fetchpriority="low" src="$1"></script>',
  );
}

/**
 * Puts the stylesheet in the document instead of fetching it.
 *
 * The stylesheet is the only thing standing between the markup and the first
 * paint, and it cannot be asked for until the document that mentions it has
 * arrived. That serialises two round trips to show text that was already in
 * the first one.
 *
 * It is worth doing here only because of the numbers involved: about 10kb
 * compressed against a document of about 9kb, on pages that are already
 * generated one file at a time. It costs a larger document on every route and
 * gives up caching the stylesheet across routes, which barely applies, since
 * navigation inside the app is client side and never re-fetches the HTML.
 */
function inlineStylesheet(html) {
  const link = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
  if (!link) return html;
  const file = path.join(DIST, link[1].replace(/^\//, ''));
  if (!fs.existsSync(file)) return html;
  const css = fs.readFileSync(file, 'utf8');
  return html.replace(link[0], `<style>${css}</style>`);
}

const shell = bundleLast(
  inlineStylesheet(
    stylesheetFirst(withEmptyRoot(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'))),
  ),
);

/** Replaces a tag's attribute value, leaving the rest of the head alone. */
function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

let written = 0;
for (const route of ROUTES) {
  const canonicalRoute = ALIASES[route] ?? route;
  const meta = PAGES[canonicalRoute] ?? NOT_FOUND;
  const canonical = `${SITE}${canonicalRoute}`;

  const markup = render(route);

  let html = shell.replace('<div id="root">', `<div id="root">${markup}`);

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  html = replaceTag(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
  );
  html = replaceTag(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = replaceTag(
    html,
    /<meta name="robots" content="[^"]*"\s*\/?>/,
    `<meta name="robots" content="${meta.noindex ? 'noindex, follow' : 'index, follow'}" />`,
  );
  html = replaceTag(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
  );
  html = replaceTag(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${canonical}" />`,
  );

  /*
   * A flat about.html, not about/index.html.
   *
   * The host serves a directory's index at the path with a trailing slash and
   * permanently redirects the version without one, so every canonical and every
   * sitemap entry we publish would have pointed at a redirect. A flat file is
   * served at the address as written, which is the address we advertise.
   */
  const target = route === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, `${route.slice(1)}.html`);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  written++;

  const text = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`  ${route.padEnd(12)} ${String(text.length).padStart(5)} chars of text`);
}

fs.rmSync(bundle, { force: true });
console.log(`prerendered ${written} routes`);

/** Attribute values go into double quotes, so those and ampersands must go. */
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
