#!/usr/bin/env node
/**
 * End-to-end check of parser + optimiser against the real submitted corpus.
 *
 *   node scripts/smoke-test.mjs
 *
 * Asserts the properties the sort actually promises, rather than just that it
 * runs: nothing is lost, declared dependencies are respected, group order holds
 * where dependencies allow, and the result is deterministic.
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CORPUS = 'Load Orders - Public Submitted';
const out = path.join(os.tmpdir(), `volo-smoke-${process.pid}.mjs`);

await build({
  stdin: {
    contents: `
      export { parseLoadOrder } from './client/src/lib/parser';
      export { sortLoadOrder } from './client/src/lib/optimiser';
      export { exportOrder } from './client/src/lib/exporter';
      export { default as dividers } from './client/src/lib/dividers.json';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});

const { parseLoadOrder, sortLoadOrder, exportOrder, dividers } = await import(`file://${out}`);
const masterlist = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };
const ok = (msg) => console.log(`  ok    ${msg}`);

const groupRank = new Map(masterlist.groups.map((g, i) => [g.name, i]));

for (const file of fs.readdirSync(CORPUS).sort()) {
  const raw = fs.readFileSync(path.join(CORPUS, file), 'utf8');
  const parsed = parseLoadOrder(raw, file);
  if (!parsed.mods.length) continue;

  const t0 = performance.now();
  const result = sortLoadOrder(parsed.mods, masterlist);
  const ms = performance.now() - t0;

  console.log(`\n${file}`);
  console.log(`  ${parsed.mods.length} mods, ${parsed.format}, sorted in ${ms.toFixed(1)}ms`);

  // 1. nothing lost, nothing duplicated
  if (result.mods.length !== parsed.mods.length) {
    fail(`lost mods: in ${parsed.mods.length}, out ${result.mods.length}`);
  } else if (new Set(result.mods.map(m => m.uuid)).size !== parsed.mods.length) {
    fail('duplicate uuids in output');
  } else {
    ok('every mod preserved exactly once');
  }

  // 2. declared dependencies come first
  const position = new Map(result.mods.map((m, i) => [m.uuid, i]));
  let violations = 0;
  for (const mod of result.mods) {
    for (const dep of mod.dependencies ?? []) {
      const depPos = position.get(dep.uuid);
      if (depPos !== undefined && depPos > position.get(mod.uuid)) violations++;
    }
  }
  violations
    ? fail(`${violations} dependencies load after their dependent`)
    : ok('all declared dependencies load first');

  // 3. Divider order holds wherever dependencies don't force otherwise. The
  //    dividers are the skeleton of the sort, so this is the shape invariant;
  //    group rank only breaks ties inside a divider section.
  let inversions = 0;
  for (let i = 1; i < result.mods.length; i++) {
    const prev = result.placements.get(result.mods[i - 1].uuid)?.divider ?? Infinity;
    const curr = result.placements.get(result.mods[i].uuid)?.divider ?? Infinity;
    if (curr < prev) inversions++;
  }
  const forced = result.stats.hardEdges;
  inversions > forced
    ? fail(`${inversions} divider inversions, only ${forced} dependency edges to explain them`)
    : ok(`divider order holds (${inversions} inversions, ${forced} dependency edges)`);

  // 4. deterministic
  const again = sortLoadOrder(parsed.mods, masterlist);
  again.mods.map(m => m.uuid).join() === result.mods.map(m => m.uuid).join()
    ? ok('deterministic across runs')
    : fail('non-deterministic output');

  // 5. Speed. This is what made the hosted version time out.
  ms < 250 ? ok(`fast enough (${ms.toFixed(1)}ms)`) : fail(`too slow: ${ms.toFixed(1)}ms`);

  const critical = result.issues.filter(i => i.severity === 'critical');
  if (critical.length) {
    console.log(`  note  ${critical.length} critical issue(s) reported:`);
    for (const c of critical.slice(0, 3)) console.log(`        - ${c.message.slice(0, 110)}`);
  }
}

// Mods the masterlist has never seen fall back to name patterns. Every group a
// pattern can emit must exist in the masterlist's vocabulary; an unknown name
// ranks as nothing and silently sorts to the end, which is how a vocabulary
// rename once broke the fallback without failing any corpus test.
{
  const validGroups = new Set(masterlist.groups.map(g => g.name));
  const probes = [
    'Fancy Sword of Testing', 'Probe Hair Pack', 'Probe Spellbook',
    'Probe Interface Tweak', 'Probe Armour Set', 'Probe Compatibility Patch',
    'Zzz Totally Unknown Thing',
  ].map((name, i) => ({ uuid: `probe-${i}`, name, originalIndex: i }));

  const result = sortLoadOrder(probes, masterlist);
  let bad = 0;
  console.log('\nfallback vocabulary probe');
  for (const mod of result.mods) {
    const g = result.placements.get(mod.uuid)?.group;
    if (!validGroups.has(g)) {
      bad++;
      console.log(`  FAIL  "${mod.name}" assigned unknown group "${g}"`);
    }
  }
  if (!bad) console.log('  ok    every fallback group exists in the masterlist vocabulary');
  else failures += bad;
}

// modsettings.lsx: the game's own load order file. Fixture mirrors the real
// structure, including the base-game Gustav entry that must be filtered out.
{
  const lsx = `<?xml version="1.0" encoding="UTF-8"?>
<save>
  <region id="ModuleSettings">
    <node id="root">
      <children>
        <node id="Mods">
          <children>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="GustavDev"/>
              <attribute id="Name" type="LSString" value="GustavDev"/>
              <attribute id="UUID" type="guid" value="28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8"/>
            </node>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="ImpUI_Folder"/>
              <attribute id="Name" type="LSString" value="ImpUI (ImprovedUI)"/>
              <attribute id="UUID" type="guid" value="26922ba9-6018-5252-075d-7ff2ba6ed879"/>
              <attribute id="Version64" type="int64" value="36028797018963968"/>
            </node>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="TestMod"/>
              <attribute id="Name" type="LSString" value="Probe Test Mod"/>
              <attribute id="UUID" type="guid" value="11111111-2222-3333-4444-555555555555"/>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;

  const parsed = parseLoadOrder(lsx, 'modsettings.lsx');
  console.log('\nmodsettings.lsx fixture');
  const names = parsed.mods.map(m => m.name);
  if (parsed.mods.length === 2 && names.includes('ImpUI (ImprovedUI)') && names.includes('Probe Test Mod')) {
    console.log('  ok    two mods parsed, base game filtered out');
  } else {
    failures++;
    console.log(`  FAIL  expected 2 mods without GustavDev, got ${JSON.stringify(names)}`);
  }
  if (parsed.mods[0]?.uuid === '26922ba9-6018-5252-075d-7ff2ba6ed879') {
    console.log('  ok    uuids extracted');
  } else {
    failures++;
    console.log('  FAIL  uuid not extracted');
  }
}

// Astra's dividers: stripped on import by uuid, reinserted on export when asked.
{
  const div = dividers.byGroup['User Interface'];
  const input = JSON.stringify({ Order: [
    { UUID: div.uuid, Name: div.name },
    { UUID: '26922ba9-6018-5252-075d-7ff2ba6ed879', Name: 'ImpUI (ImprovedUI)' },
    { UUID: 'aaaaaaaa-0000-0000-0000-000000000001', Name: 'Zed Probe Mod' },
  ] });
  const parsed = parseLoadOrder(input, 'order.json');
  console.log('');
  console.log('divider fixtures');
  if (parsed.mods.length === 2 && parsed.sections.length === 1) {
    console.log('  ok    divider stripped from mods and kept as a section');
  } else {
    failures++;
    console.log('  FAIL  expected 2 mods and 1 section, got ' + parsed.mods.length + ' and ' + parsed.sections.length);
  }

  const result = sortLoadOrder(parsed.mods, masterlist);
  const plain = JSON.parse(exportOrder(result, 'bg3mm'));
  const withDividers = JSON.parse(exportOrder(result, 'bg3mm', { insertDividers: true }));
  const dividerEntries = withDividers.Order.filter(e => dividers.uuids.includes(e.UUID));
  const impuiAt = withDividers.Order.findIndex(e => e.UUID === '26922ba9-6018-5252-075d-7ff2ba6ed879');
  const firstDividerAt = withDividers.Order.findIndex(e => dividers.uuids.includes(e.UUID));
  if (plain.Order.every(e => !dividers.uuids.includes(e.UUID))
      && dividerEntries.length > 0
      && firstDividerAt !== -1 && firstDividerAt < impuiAt) {
    console.log('  ok    export inserts ' + dividerEntries.length + ' dividers ahead of the mods they head');
  } else {
    failures++;
    console.log('  FAIL  divider insertion incorrect');
  }

  // Inserted dividers must run in the taxonomy's own sequence, which is the
  // whole point of using it as the skeleton.
  const byNum = new Map(dividers.all.map(d => [d.uuid, d.num]));
  const seq = withDividers.Order.filter(e => byNum.has(e.UUID)).map(e => byNum.get(e.UUID));
  const ascending = seq.every((n, i) => i === 0 || seq[i - 1] <= n);
  if (ascending) {
    console.log('  ok    dividers appear in taxonomy order (' + seq.length + ' of them)');
  } else {
    failures++;
    console.log('  FAIL  dividers out of sequence: ' + seq.join(', '));
  }
}

// TSV export fixture, modelled on a real BG3MM "export to file" TSV: engine
// modules appear as rows, there is no UUID column, and dependencies are one
// comma-separated string of names.
{
  const tsv = [
    'Index	Name	Author	FileName	Tags	Dependencies	URL',
    '0	GustavX		GustavX_cb555efe.pak		GustavDev	',
    '1	HonourX		HonourX_767d0062.pak		GustavX, Honour	',
    "2	Mystra's Spells	randomkilla	test_4b516620.pak		GustavDev, GustavX	",
    "3	Mystra's Scrolls	randomkilla	mystrasscrolls_1c1568b8.pak		DiceSet_01, MainUI, ModBrowser, GustavDev, Mystra's Spells	",
    '4	ImpUI (ImprovedUI)	bibsan	impui.pak		MainUI	',
  ].join('\n');
  const parsed = parseLoadOrder(tsv, 'export.tsv');
  console.log('');
  console.log('tsv fixture');
  const names = parsed.mods.map(m => m.name);
  if (parsed.mods.length === 3 && !names.includes('GustavX') && !names.includes('HonourX')) {
    console.log('  ok    engine modules dropped from the list');
  } else {
    failures++;
    console.log('  FAIL  expected 3 mods without engine modules, got ' + JSON.stringify(names));
  }
  const scrolls = parsed.mods.find(m => m.name === "Mystra's Scrolls");
  const depNames = (scrolls?.dependencies ?? []).map(d => d.name);
  if (depNames.length === 1 && depNames[0] === "Mystra's Spells") {
    console.log('  ok    string dependencies parsed, engine names filtered');
  } else {
    failures++;
    console.log('  FAIL  dependencies wrong: ' + JSON.stringify(depNames));
  }
  const result = sortLoadOrder(parsed.mods, masterlist);
  const order = result.mods.map(m => m.name);
  if (order.indexOf("Mystra's Spells") < order.indexOf("Mystra's Scrolls")) {
    console.log('  ok    name-only dependency creates an ordering edge');
  } else {
    failures++;
    console.log('  FAIL  dependency edge not honoured: ' + JSON.stringify(order));
  }

  // UUID-less imports should round-trip: the masterlist knows ImpUI's real
  // pak UUID, so the BG3MM export must carry it rather than an empty string.
  const exported = JSON.parse(exportOrder(result, 'bg3mm'));
  const impui = exported.Order.find(e => e.Name === 'ImpUI (ImprovedUI)');
  if (impui?.UUID === '26922ba9-6018-5252-075d-7ff2ba6ed879') {
    console.log('  ok    masterlist recovers real UUIDs for UUID-less imports');
  } else {
    failures++;
    console.log('  FAIL  ImpUI UUID not recovered, got ' + JSON.stringify(impui));
  }
  if (exported.Order.every(e => !e.UUID.startsWith('name:'))) {
    console.log('  ok    no synthetic keys leak into the export');
  } else {
    failures++;
    console.log('  FAIL  synthetic name: keys leaked into the export');
  }
}

// numbered text fixture: BG3MM's text export writes "NN. Name (file.pak)".
// Numbering and filenames must strip, commas in names must survive, and
// engine modules must still be recognised and dropped.
{
  const txt = [
    '0. GustavX (GustavX_cb555efe-2d9e-131f-8195-a89329d218ea.pak) ',
    '10. ASE - Gnoll, Harpy, Hobgoblin, Hag, Djinni (ase_nr_fav_races_bad311ff-bbf9-2f2w.pak) ',
    '12. ImpUI (ImprovedUI) (impui_26922ba9-6018-5252-075d-eqgb.pak) ',
  ].join('\n');
  const parsed = parseLoadOrder(txt, 'order.txt');
  console.log('');
  console.log('numbered text fixture');
  const names = parsed.mods.map(m => m.name);
  const wantAse = 'ASE - Gnoll, Harpy, Hobgoblin, Hag, Djinni';
  if (parsed.mods.length === 2 && names.includes(wantAse) && names.includes('ImpUI (ImprovedUI)')) {
    console.log('  ok    numbering and filenames stripped, commas kept, engine dropped');
  } else {
    failures++;
    console.log('  FAIL  got ' + JSON.stringify(names));
  }
  const result = sortLoadOrder(parsed.mods, masterlist);
  const exported = JSON.parse(exportOrder(result, 'bg3mm'));
  const impui = exported.Order.find(e => e.Name === 'ImpUI (ImprovedUI)');
  if (impui?.UUID === '26922ba9-6018-5252-075d-7ff2ba6ed879') {
    console.log('  ok    cleaned names still recover real UUIDs');
  } else {
    failures++;
    console.log('  FAIL  UUID not recovered from cleaned name');
  }
}

// modsettings round trip: what we write back must be a file the game and our
// own parser accept, with the engine preamble restored and versions kept.
{
  const src = [
    { UUID: '26922ba9-6018-5252-075d-7ff2ba6ed879', Name: 'ImpUI (ImprovedUI)', Folder: 'ImpUI_26922ba9', Version64: '72198331526283346', MD5: 'abc123' },
    { UUID: '11111111-2222-3333-4444-555555555555', Name: 'Probe & Test <Mod>', Folder: 'TestMod', Version64: '36028797018963968' },
  ];
  const parsed = parseLoadOrder(JSON.stringify({ Order: src }), 'order.json');
  const result = sortLoadOrder(parsed.mods, masterlist);
  const lsx = exportOrder(result, 'modsettings');
  console.log('');
  console.log('modsettings round trip');
  const hasPreamble = lsx.includes('value="GustavDev"') && lsx.includes('value="GustavX"') && lsx.includes('value="HonourX"');
  const keptVersion = lsx.includes('value="72198331526283346"') && lsx.includes('value="abc123"');
  const escaped = lsx.includes('Probe &amp; Test &lt;Mod&gt;');
  if (hasPreamble && keptVersion && escaped) {
    console.log('  ok    engine preamble restored, versions kept, names escaped');
  } else {
    failures++;
    console.log('  FAIL  preamble ' + hasPreamble + ', versions ' + keptVersion + ', escaping ' + escaped);
  }
  const reparsed = parseLoadOrder(lsx, 'modsettings.lsx');
  const names = reparsed.mods.map(m => m.name);
  if (reparsed.mods.length === 2 && names.includes('ImpUI (ImprovedUI)') && names.includes('Probe & Test <Mod>')) {
    console.log('  ok    exported file re-imports to the same mods');
  } else {
    failures++;
    console.log('  FAIL  re-import got ' + JSON.stringify(names));
  }
}

/**
 * The two name-pattern tables must classify a mod identically.
 *
 * mine-corpus.mjs classifies the corpus at build time; the copy in optimiser.ts
 * classifies whatever a user imports that the corpus has never seen. They were
 * found disagreeing once, which made the same mod sort differently depending on
 * whether it happened to be in the masterlist.
 */
{
  console.log('');
  console.log('name-pattern tables');

  const tableFrom = (src, start) => {
    const a = src.indexOf(start);
    if (a === -1) throw new Error(`table not found: ${start}`);
    const b = src.indexOf('\n];', a);
    return eval(`${src.slice(a + start.length - 1, b)}\n]`);
  };

  const miner = tableFrom(
    fs.readFileSync('scripts/mine-corpus.mjs', 'utf8'),
    'const NAME_PATTERNS = [',
  );
  const client = tableFrom(
    fs.readFileSync('client/src/lib/optimiser.ts', 'utf8').replace(': [RegExp, GroupName, number][] =', ' ='),
    'const NAME_PATTERNS = [',
  );

  const searchable = n => n
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ');
  const classify = (table, name) => {
    const hit = table.find(([re]) => re.test(searchable(name)));
    return hit ? `${hit[1]}/${hit[2]}` : 'none';
  };

  const probes = [
    "Ghost's Deck Of Many Feats (v6.0)", 'FeatsOverhaul', 'Essential_Feats',
    'Subraces of Faerun', 'Warlock Subclass Pack', 'Compatibility Framework',
    'Extra encounters and Minibosses', 'Horns of Faerun', 'Community Library',
    'Pose Pack', 'More Dice Sets', 'Glowing Eyes', 'ImpUI (ImprovedUI)', '5eSpells',
  ];
  const disagreements = probes.filter(n => classify(miner, n) !== classify(client, n));

  if (!disagreements.length) {
    console.log(`  ok    both tables agree on ${probes.length} probe names`);
  } else {
    failures++;
    console.log(`  FAIL  tables disagree on ${disagreements.join(', ')}`);
  }

  /*
   * Structural identity, not just probe agreement. The probes once passed while
   * the tables differed in nine rows and thirty-eight positions, because a
   * probe list can only catch drift someone thought to probe for. Row-for-row
   * equality catches all of it, and position matters because first match wins.
   */
  const structural = [];
  if (miner.length !== client.length) {
    structural.push(`row counts differ: miner ${miner.length}, client ${client.length}`);
  }
  miner.forEach((row, i) => {
    const twin = client[i];
    if (!twin) return;
    if (row[0].source !== twin[0].source || row[1] !== twin[1] || row[2] !== twin[2]) {
      structural.push(`row ${i}: ${row[0].source.slice(0, 40)} vs ${twin[0].source.slice(0, 40)}`);
    }
  });
  if (!structural.length) {
    console.log(`  ok    the two tables are structurally identical, all ${miner.length} rows`);
  } else {
    failures++;
    for (const s of structural.slice(0, 5)) console.log(`  FAIL  ${s}`);
  }

  // A slot only means something if it exists in Astra's taxonomy.
  const slots = new Set(dividers.all.map(d => d.num));
  const unknown = [...miner, ...client].map(row => row[2]).filter(n => !slots.has(n));
  if (!unknown.length) {
    console.log('  ok    every pattern points at a real divider slot');
  } else {
    failures++;
    console.log(`  FAIL  patterns point at slots that do not exist: ${[...new Set(unknown)].join(', ')}`);
  }

  // A rule that a broader earlier rule already swallows can never fire.
  const shadowed = [];
  for (let i = 0; i < miner.length; i++) {
    for (let j = 0; j < i; j++) {
      const sample = miner[i][0].source
        .replace(/\\b|\\s\*|\(\?:|[()?^$]/g, ' ')
        .split('|')[0].trim();
      if (sample.length > 4 && !/[\\[\]*+.]/.test(sample) && miner[j][0].test(sample)
          && miner[i][1] !== miner[j][1]) {
        shadowed.push(`${miner[i][0].source} behind ${miner[j][0].source}`);
      }
    }
  }
  if (!shadowed.length) {
    console.log('  ok    no pattern is shadowed by an earlier one');
  } else {
    failures++;
    for (const s of shadowed) console.log(`  FAIL  unreachable: ${s}`);
  }
}

/**
 * Every client route needs prerendering, or it 404s in production.
 *
 * public/404.html turns off the host's fallback to index.html, which is what
 * makes a real 404 possible for addresses that are not pages. Each route earns
 * its 200 by having a file of its own, so a route the prerenderer does not know
 * about simply stops existing once deployed.
 */
{
  console.log('');
  console.log('routes and prerendering');

  const app = fs.readFileSync('client/src/App.tsx', 'utf8');
  const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]);

  const prerender = fs.readFileSync('scripts/prerender.mjs', 'utf8');
  const listed = [...prerender.matchAll(/'(\/[a-z]*)'/g)].map(m => m[1]);

  const missing = routes.filter(r => !listed.includes(r));
  if (!missing.length) {
    console.log(`  ok    all ${routes.length} routes are prerendered`);
  } else {
    failures++;
    console.log(`  FAIL  routes the prerenderer does not know, will 404 live: ${missing.join(', ')}`);
  }

  if (fs.existsSync('public/404.html')) {
    const page = fs.readFileSync('public/404.html', 'utf8');
    if (page.includes('noindex')) {
      console.log('  ok    404 page is present and noindex');
    } else {
      failures++;
      console.log('  FAIL  404.html is missing its noindex tag');
    }
  } else {
    failures++;
    console.log('  FAIL  public/404.html is missing, so unknown URLs answer 200');
  }

  // The point of the exercise: real text in the file the host serves.
  const home = 'dist/index.html';
  if (fs.existsSync(home)) {
    const body = fs.readFileSync(home, 'utf8').split('<body')[1] ?? '';
    const text = body
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 1000) {
      console.log(`  ok    home page ships ${text.length} characters without JavaScript`);
    } else {
      failures++;
      console.log(`  FAIL  home page ships only ${text.length} characters; prerendering did not run`);
    }
  } else {
    console.log('  skip  no dist/ yet, run the build to check the prerendered output');
  }
}

/**
 * The corpus is published under CC0, so it must not carry anyone's account name.
 *
 * BG3MM writes the full path of a pak into the FileName column for some entries.
 * One submitted order reached the repository with a submitter's Windows username
 * inside it. process-submission.mjs strips these on intake now; this checks the
 * files already committed, because intake cannot fix what is already here.
 */
{
  console.log('');
  console.log('corpus privacy');

  const dir = 'Load Orders - Public Submitted';
  const windowsPath = /(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)+[^\\\t"\r\n]+/g;
  const homePath = /(?:\/home\/|\/Users\/)[A-Za-z0-9._-]+\//g;

  const offenders = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (!fs.statSync(file).isFile()) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const re of [windowsPath, homePath]) {
      const hits = [...text.matchAll(re)];
      if (hits.length) offenders.push(`${name}: ${hits[0][0].slice(0, 50)}`);
    }
  }

  if (!offenders.length) {
    console.log('  ok    no local filesystem paths in the corpus');
  } else {
    failures++;
    for (const o of offenders) console.log(`  FAIL  personal path in ${o}`);
  }

  /*
   * The same scrub exists in three places, because an order can reach the
   * corpus through the browser, through the API without the browser, or through
   * the GitHub issue form which touches neither. If they drift, the weakest one
   * decides what gets published, and the strongest gives false assurance.
   */
  const probes = [
    ['C:\\Users\\someone\\AppData\\Local\\Larian Studios\\Mods\\A.pak', 'A.pak'],
    ['D:\\Games\\BG3\\Mods\\B.pak', 'B.pak'],
    ['/home/someone/.local/share/Larian Studios/Mods/C.pak', 'C.pak'],
    ['/Users/someone/Library/Application Support/Mods/D.pak', 'D.pak'],
    ['https://github.com/author/repo/blob/main/README.md', null],
    // A URL whose path merely contains /Users/ is an address, not a home
    // directory, and rewriting it destroys a working link.
    ['https://cdn.example.com/Users/team/file.pak', null],
    ['ModFixer.pak', null],
  ];

  const win = /(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)*([^\\\t"\r\n]+)/g;
  const nix = /(?<![A-Za-z0-9])\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g;
  const scrub = t => t.replace(win, '$1').replace(nix, '$1');

  const wrong = probes.filter(([input, expected]) => scrub(input) !== (expected ?? input));
  if (!wrong.length) {
    console.log(`  ok    the scrub handles ${probes.length} path shapes, and leaves URLs alone`);
  } else {
    failures++;
    for (const [input] of wrong) console.log(`  FAIL  scrub wrong for ${input}`);
  }

  // All three copies must contain the same two patterns.
  const copies = {
    'client/src/lib/scrub.ts': fs.readFileSync('client/src/lib/scrub.ts', 'utf8'),
    'functions/api/submit.js': fs.readFileSync('functions/api/submit.js', 'utf8'),
    'scripts/process-submission.mjs': fs.readFileSync('scripts/process-submission.mjs', 'utf8'),
  };
  const missing = Object.entries(copies).filter(([, src]) =>
    !src.includes('home|Users') || !src.includes('[A-Za-z]:'));
  if (!missing.length) {
    console.log('  ok    all three scrub points cover Windows and Unix paths');
  } else {
    failures++;
    for (const [file] of missing) console.log(`  FAIL  ${file} is missing a scrub pattern`);
  }
}

/**
 * Orders VOLO sorted must not be read as evidence of where mods belong.
 *
 * The declared answer decides in both directions and the measurement only
 * settles the cases nobody answered, so a threshold drifting or an answer being
 * ignored would quietly reopen the feedback loop this exists to close.
 */
{
  console.log('');
  console.log('corpus provenance');

  const { judge, isVoloSorted } = await import('./corpus-provenance.mjs');

  const cases = [
    ['a submitter saying VOLO sorted it is believed', { declared: 'volo', agreementWithVolo: 0.4 }, true],
    ['a submitter saying they arranged it is believed', { declared: 'self', agreementWithVolo: 1 }, false],
    ['an unanswered order matching almost exactly is flagged', { declared: 'unknown', agreementWithVolo: 0.99 }, true],
    ['an unanswered order merely agreeing is not', { declared: 'unknown', agreementWithVolo: 0.8 }, false],
    ['an unmeasurable unanswered order is not', { declared: 'unknown', agreementWithVolo: null }, false],
  ];

  const wrong = cases.filter(([, input, expected]) => judge(input) !== expected);
  if (!wrong.length) {
    console.log(`  ok    provenance decided correctly in ${cases.length} cases`);
  } else {
    failures++;
    for (const [name] of wrong) console.log(`  FAIL  ${name}`);
  }

  // Absence must read as independent, or the whole existing corpus is discarded.
  if (isVoloSorted('an-order-nobody-recorded.json') === false) {
    console.log('  ok    an unrecorded order counts as independent');
  } else {
    failures++;
    console.log('  FAIL  an unrecorded order is being treated as VOLO-sorted');
  }
}

/**
 * Curated rules: the tier that states a constraint instead of measuring a habit.
 *
 * Two failure modes are checked. A pattern that matches nothing looks like the
 * case is handled while the mod falls through to a guess, which is how
 * Compatibility Framework was filed as a library for months. And an
 * incompatibility that never fires is a warning nobody will ever see.
 */
{
  console.log('');
  console.log('curated rules');

  const { loadCuratedRules } = await import('./curated-rules.mjs');

  let rules;
  try {
    rules = loadCuratedRules();
    console.log(`  ok    ${rules.placements.length} placements match their own examples`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${err.message.split('\n')[0]}`);
    rules = { placements: [], incompatible: [], messages: [] };
  }

  // Every curated slot must exist in Astra's taxonomy, or the sort sends the
  // mod somewhere that has no meaning.
  const slots = new Set(dividers.all.map(d => d.num));
  const unknown = rules.placements.filter(p => p.divider !== undefined && !slots.has(p.divider));
  if (!unknown.length) {
    console.log('  ok    every curated placement names a real divider slot');
  } else {
    failures++;
    for (const p of unknown) console.log(`  FAIL  ${p.pattern} points at slot ${p.divider}`);
  }

  // The detection itself, against two mods that really are in the masterlist.
  const real = masterlist.plugins.filter(p => p.uuid && !p.uuid.startsWith('name:')).slice(0, 2);
  const probe = {
    ...masterlist,
    incompatible: [{ mods: real.map(p => p.uuid), why: 'Test rule.', severity: 'critical' }],
  };
  const order = real.map((p, i) => ({ UUID: p.uuid, Name: p.name, Index: i }));
  const result = sortLoadOrder(parseLoadOrder(JSON.stringify({ Order: order }), 'probe.json').mods, probe);
  const raised = result.issues.filter(i => i.kind === 'incompatible');

  if (raised.length === 1 && raised[0].uuids.length === 2) {
    console.log('  ok    an incompatible pair present together is reported');
  } else {
    failures++;
    console.log(`  FAIL  incompatibility not detected (${raised.length} issues raised)`);
  }

  // One of the pair alone must stay quiet, or every order gets a false alarm.
  const single = sortLoadOrder(
    parseLoadOrder(JSON.stringify({ Order: [order[0]] }), 'probe.json').mods, probe,
  );
  if (!single.issues.some(i => i.kind === 'incompatible')) {
    console.log('  ok    one of the pair alone raises nothing');
  } else {
    failures++;
    console.log('  FAIL  a single mod triggered an incompatibility warning');
  }
}

/**
 * Figures quoted in the README must match the masterlist they describe.
 *
 * README is the first thing anyone reads and the last thing anyone regenerates.
 * Repairing two dead curated patterns moved a single mod from one tier to
 * another, and the README was wrong in two places for a day without anything
 * noticing. A number in prose is a claim, and this is the only thing that
 * checks it.
 */
{
  console.log('');
  console.log('README figures');

  const readme = fs.readFileSync('README.md', 'utf8');
  const tier = src => masterlist.plugins.filter(p => p.evidence?.source === src).length;
  const withCommas = n => n.toLocaleString('en-GB');

  const figures = [
    ['total mods', masterlist.plugins.length],
    ['from section headers', tier('section') + tier('section-majority')],
    ['from name patterns', tier('name-pattern')],
    ['from listings', tier('external-category')],
    ['inferred', tier('inferred')],
    ['curated', tier('curated')],
    ['uncategorised', tier('none')],
    ['on a divider slot', masterlist.plugins.filter(p => p.divider !== undefined).length],
  ];

  const stale = figures.filter(([, value]) =>
    !readme.includes(withCommas(value)) && !readme.includes(String(value)));

  if (!stale.length) {
    console.log(`  ok    all ${figures.length} quoted figures match the masterlist`);
  } else {
    failures++;
    for (const [label, value] of stale) {
      console.log(`  FAIL  README does not quote the current ${label} (${withCommas(value)})`);
    }
  }
}

fs.rmSync(out, { force: true });
console.log(failures ? `\n${failures} FAILURES\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
