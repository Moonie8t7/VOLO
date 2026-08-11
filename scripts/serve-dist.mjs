#!/usr/bin/env node
/**
 * Serves dist/ the way the host does, so the routing can be checked locally.
 *
 *   node scripts/serve-dist.mjs [port]
 *
 * `vite preview` answers any unknown path with index.html, which is exactly the
 * behaviour prerendering removes, so it reports every route as working whether
 * or not it is. This resolves a request the way Cloudflare Pages does: an exact
 * file, else that path's index.html, else 404.html with a real 404 status.
 *
 * Without this the arrangement could only be verified after deploying, and a
 * missing route would be found by a visitor rather than by a test.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import zlib from 'zlib';

const DIST = 'dist';
const port = Number(process.argv[2] ?? 4180);

/** Content types for the extensions this build actually produces. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * The file a path resolves to, or null when nothing matches.
 *
 * Mirrors the host's order: the file as asked for, then the same name with
 * .html, then a directory index. The middle step is the one that matters,
 * because it is what serves /about from about.html without the redirect a
 * directory index would force.
 */
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\.\./g, '');
  const direct = path.join(DIST, clean);

  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

  const asHtml = `${direct.replace(/[/\\]$/, '')}.html`;
  if (clean !== '/' && fs.existsSync(asHtml)) return asHtml;

  const indexed = path.join(direct, 'index.html');
  if (fs.existsSync(indexed)) return indexed;

  return null;
}

/**
 * Text is compressed, as the host compresses it.
 *
 * Without this the server was useless for judging anything about size. A
 * stylesheet that costs 10kb over the wire in production arrived as 52kb here,
 * so every trade between "one more request" and "a larger document" measured
 * five times too expensive and pointed the wrong way. Images and fonts are
 * already compressed formats and are left alone.
 */
const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript))/;

http.createServer((req, res) => {
  const file = resolve(req.url ?? '/');
  const notFound = path.join(DIST, '404.html');

  if (file) {
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const body = fs.readFileSync(file);
    const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');

    if (wantsGzip && COMPRESSIBLE.test(type)) {
      const packed = zlib.gzipSync(body);
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Encoding': 'gzip',
        'Content-Length': packed.length,
      });
      res.end(packed);
      return;
    }

    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    res.end(body);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
}).listen(port, () => {
  console.log(`serving ${DIST} as the host would on http://localhost:${port}`);
});
