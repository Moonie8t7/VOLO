#!/usr/bin/env node
/**
 * Local watch on the places people talk about VOLO.
 *
 *   node watch-community.mjs            report anything new since the last run
 *   node watch-community.mjs --baseline record what is there now and report nothing
 *
 * This lived outside the repository on the reasoning that it was a maintainer's
 * aid for one session, scraping two pages whose markup is nobody's contract.
 * The scraping part is still true and is why the parsers report how much they
 * matched. The rest was wrong: it is the only thing that says what players are
 * reporting, and it ran for weeks returning the body "Locked" for every Nexus
 * comment, because the selector below caught a hidden label instead of the
 * text. Nobody could see that, because there was nothing to compare against and
 * no test to fail. A tool that decides what gets fixed belongs somewhere it can
 * be reviewed.
 *
 * State lives beside this file so a run can tell new from already-seen, and is
 * not committed: it is one machine's reading history, not project data.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const STATE = path.join(HERE, 'community-state.json');
const BASELINE = process.argv.includes('--baseline');

/** Handles that are the maintainer, so "you replied" is distinguishable from "somebody is waiting". */
const MINE = new Set(['iammoonie', 'moonie8t7', 'moonie', 'mrmoonsin', 'volo-submissions', 'github-actions[bot]', 'volo-crawler']);

const NEXUS = 'https://www.nexusmods.com/baldursgate3/mods/24316?tab=posts';
const REDDIT = 'https://www.reddit.com/r/BG3mods/comments/1vj8r7k/.rss';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

/*
 * Retried once. Reddit answers the feed intermittently and a single refusal is
 * not news; reporting it as "could not fetch" every other run would train
 * whoever reads this to ignore the line that matters.
 */
const get = (url, attempts = 2) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const out = execSync(`curl -sL --max-time 40 -A "${UA}" "${url}"`, {
        encoding: 'utf8', maxBuffer: 1024 * 1024 * 32,
      });
      if (out && out.length > 500) return out;
    } catch { /* try again */ }
  }
  return '';
};

const decode = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* ---------- Nexus ---------- */

/**
 * Comments out of the posts-tab markup.
 *
 * Separate from fetching so a test can hand it a saved page. It had no test
 * while it silently returned the wrong element for every comment, and a parser
 * of somebody else's markup is exactly the thing that needs one.
 */
export function parseNexus(html) {
  const items = [];
  /*
   * A comment is an <li class="comment..." id="comment-NNN">, carrying the
   * author in a profile link and the time as a unix stamp. The id is Nexus's
   * own, so it is the right thing to remember: an edited comment keeps it, and
   * nothing depends on the wording staying put.
   *
   * The markup is not a contract and this will break one day. The block count is
   * reported alongside the parsed count so a page that changed shape is
   * distinguishable from a page with nothing new on it.
   */
  const blocks = html.split(/<li class="comment[^"]*" id="comment-/).slice(1);
  for (const block of blocks) {
    const id = (block.match(/^(\d+)/) ?? [])[1];
    const author = decode((block.match(/\/profile\/([^"?]+)/) ?? [])[1] ?? '');
    const when = Number((block.match(/data-date="(\d+)"/) ?? [])[1] ?? 0);
    /*
     * comment-content-text, not comment-content. The outer div opens with a
     * hidden "Locked" label, so the old pattern closed on that div and every
     * Nexus comment this has ever reported arrived with the body "Locked".
     * It looked like a working watcher for weeks.
     */
    const body = decode((block.match(/class="comment-content-text"[^>]*>([\s\S]*?)<\/div>/) ?? [])[1] ?? '');
    if (!id || !author) continue;
    items.push({
      source: 'nexus',
      id: `nexus:${id}`,
      author,
      at: when ? new Date(when * 1000).toISOString() : '',
      text: body.slice(0, 180),
      url: `${NEXUS}#comment-${id}`,
    });
  }
  return { items, note: `parsed ${items.length} of ${blocks.length} comment blocks` };
}

function nexusItems() {
  const html = get(NEXUS);
  if (!html || html.length < 5000) return { error: 'could not fetch the Nexus posts tab', items: [] };
  return parseNexus(html);
}

/* ---------- Reddit ---------- */
function redditItems() {
  const xml = get(REDDIT);
  if (!xml.trimStart().startsWith('<?xml')) return { error: 'Reddit did not return the feed', items: [] };

  const items = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const author = decode((entry.match(/<name>([^<]+)<\/name>/) ?? [])[1] ?? '').replace(/^\/u\//, '');
    const at = (entry.match(/<updated>([^<]+)<\/updated>/) ?? [])[1] ?? '';
    const href = (entry.match(/<link[^>]*href="([^"]+)"/) ?? [])[1] ?? '';
    const content = decode((entry.match(/<content[^>]*>([\s\S]*?)<\/content>/) ?? [])[1] ?? '');
    if (!author || !at) continue;
    items.push({
      source: 'reddit', id: `reddit:${href}`, author, at, text: content.slice(0, 180), url: href,
    });
  }
  return { items, note: `parsed ${items.length} feed entries` };
}

/* ---------- GitHub ---------- */
function githubItems() {
  const items = [];
  try {
    const json = execSync(
      'gh api "repos/Moonie8t7/VOLO/issues/comments?sort=created&direction=desc&per_page=30"',
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 },
    );
    for (const c of JSON.parse(json)) {
      items.push({
        source: 'github',
        id: `github:${c.id}`,
        author: c.user?.login ?? '?',
        at: c.created_at,
        text: decode(c.body ?? '').slice(0, 180),
        url: c.html_url,
      });
    }
  } catch {
    return { error: 'gh api call failed', items: [] };
  }
  /* Open issues and PRs, since a new one is news even before anybody comments. */
  try {
    const open = JSON.parse(execSync(
      'gh api "repos/Moonie8t7/VOLO/issues?state=open&per_page=30"',
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 },
    ));
    for (const i of open) {
      items.push({
        source: 'github',
        id: `github:issue:${i.id}`,
        author: i.user?.login ?? '?',
        at: i.created_at,
        text: `${i.pull_request ? 'PR' : 'issue'} #${i.number}: ${i.title}`,
        url: i.html_url,
      });
    }
  } catch { /* the comments above are the important half */ }
  return { items, note: `${items.length} github items` };
}

/* ---------- run ---------- */

/*
 * Only when run directly. The parser above is imported by the smoke test, and
 * importing a file that fetches three websites as a side effect would make the
 * test suite depend on Nexus being up.
 */
const runDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(HERE, 'watch-community.mjs');

if (runDirectly) {
  const sources = { nexus: nexusItems(), reddit: redditItems(), github: githubItems() };

  const seen = fs.existsSync(STATE)
    ? new Set(JSON.parse(fs.readFileSync(STATE, 'utf8')).seen ?? [])
    : new Set();

  const all = Object.values(sources).flatMap(s => s.items);
  const fresh = all.filter(i => !seen.has(i.id)).sort((a, b) => a.at.localeCompare(b.at));

  for (const [name, s] of Object.entries(sources)) {
    if (s.error) console.log(`  ! ${name}: ${s.error}`);
  }

  if (BASELINE || !fs.existsSync(STATE)) {
    fs.writeFileSync(STATE, JSON.stringify({ seen: all.map(i => i.id) }, null, 2));
    console.log(`baseline recorded: ${all.length} item(s) across ${Object.keys(sources).length} sources`);
    for (const [name, s] of Object.entries(sources)) console.log(`  ${name}: ${s.note ?? s.error}`);
  } else {
    if (!fresh.length) {
      console.log('nothing new');
    } else {
      const waiting = fresh.filter(i => !MINE.has(i.author.toLowerCase()));
      const mine = fresh.filter(i => MINE.has(i.author.toLowerCase()));
      console.log(`${fresh.length} new item(s): ${waiting.length} from others, ${mine.length} from you\n`);
      for (const i of fresh) {
        const who = MINE.has(i.author.toLowerCase()) ? 'YOU' : i.author;
        console.log(`[${i.source}] ${who}  ${i.at}`);
        if (i.text) console.log(`   ${i.text}`);
        console.log(`   ${i.url}`);
      }
    }

    fs.writeFileSync(STATE, JSON.stringify({ seen: [...seen, ...all.map(i => i.id)] }, null, 2));
  }
}
