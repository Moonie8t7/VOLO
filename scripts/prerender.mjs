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
  '/submit', '/masterlist', '/measured', '/about', '/donations', '/support',
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

const shell = withEmptyRoot(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'));

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

  const target = route === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, route.slice(1), 'index.html');

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
