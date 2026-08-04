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

fs.rmSync(out, { force: true });
console.log(failures ? `\n${failures} FAILURES\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
