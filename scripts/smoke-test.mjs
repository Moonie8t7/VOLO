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
      export { parseLoadOrder, isSeparator } from './client/src/lib/parser';
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

const { parseLoadOrder, isSeparator, sortLoadOrder, exportOrder, dividers } = await import(`file://${out}`);
const masterlist = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };
const ok = (msg) => console.log(`  ok    ${msg}`);

const groupRank = new Map(masterlist.groups.map((g, i) => [g.name, i]));

/*
 * Names carried by more than one row, where the rows disagree about the group.
 *
 * A mod is looked up by uuid first and by name only when that fails, and
 * client/src/lib/optimiser.ts keeps the first row it meets for a name. Where
 * two rows share a name and sit in different groups, whichever was mined first
 * decides where the mod goes, which is a coin toss rather than an answer.
 *
 * The masterlist count is the wrong measure of this and was quoted for ten days
 * as though it were the right one: it counts rows, and rows are not placements.
 * What matters is how often the coin is actually tossed, which is counted in
 * the loop below and bounded after it. Identity is deliberately unresolved, so
 * the point here is not to fix it but to notice if it ever starts to matter.
 */
const rowsByName = new Map();
for (const p of masterlist.plugins) {
  const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) continue;
  if (!rowsByName.has(key)) rowsByName.set(key, []);
  rowsByName.get(key).push(p);
}
const knownUuids = new Set(masterlist.plugins.map(p => p.uuid).filter(Boolean));
const ambiguousNames = new Set(
  [...rowsByName.entries()]
    .filter(([, rows]) => rows.length > 1 && new Set(rows.map(r => r.group)).size > 1)
    .map(([key]) => key),
);
let placementsSeen = 0;
let placementsTossed = 0;

for (const file of fs.readdirSync(CORPUS).sort()) {
  const raw = fs.readFileSync(path.join(CORPUS, file), 'utf8');
  const parsed = parseLoadOrder(raw, file);
  if (!parsed.mods.length) continue;

  for (const mod of parsed.mods) {
    placementsSeen++;
    if (knownUuids.has(mod.uuid)) continue;
    if (ambiguousNames.has(mod.name.toLowerCase().replace(/[^a-z0-9]/g, ''))) placementsTossed++;
  }

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

/*
 * The bound on the coin toss above, deliberately loose.
 *
 * It measured 52 placements of 47,075, which is 0.11 percent, and the entry in
 * the worklist stays open on the strength of that being negligible rather than
 * on anyone having solved identity. One percent is roughly ten times worse and
 * is where that reasoning stops holding, so this fails there rather than at the
 * current figure: the number is expected to drift as the corpus grows, and a
 * test that fails on ordinary drift teaches people to raise the threshold
 * without reading it.
 */
{
  console.log('\nname twins');
  const share = placementsSeen ? placementsTossed / placementsSeen : 0;
  const shown = `${placementsTossed} of ${placementsSeen} placements (${(100 * share).toFixed(2)}%)`;
  if (share < 0.01) {
    ok(`a name twin decides ${shown}, still negligible`);
  } else {
    fail(`a name twin now decides ${shown}; identity was left open on the basis that this stays small`);
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

// A dependency naming a pak folder rather than a published title, with a stale
// uuid alongside it. Reported from the wild: four "missing dependency" notices
// on mods that were all present, one of them Mod Configuration Menu, which
// ships in a folder called BG3MCM and so matched nothing by name.
{
  const order = {
    Order: [
      {
        Name: 'Mod Configuration Menu',
        Folder: 'BG3MCM',
        UUID: '755a8a72-407f-4f0d-9a33-274ac75b1f7b',
      },
      {
        Name: 'Some Mod That Needs It',
        Folder: 'SomeModThatNeedsIt',
        UUID: '11111111-2222-3333-4444-555555555555',
        Dependencies: [
          // The name a modder writes, and a uuid gone stale since it was copied.
          { Name: 'BG3MCM', UUID: '00000000-0000-0000-0000-000000000000' },
        ],
      },
    ],
  };
  const parsed = parseLoadOrder(JSON.stringify(order), 'folder-dep.json');
  console.log('');
  console.log('folder-named dependency fixture');

  const result = sortLoadOrder(parsed.mods, masterlist);
  const missing = result.issues.filter(i => i.kind === 'missing-dependency');
  if (!missing.length) {
    console.log('  ok    a dependency named by pak folder resolves to the installed mod');
  } else {
    failures++;
    console.log('  FAIL  false missing dependency: ' + JSON.stringify(missing.map(i => i.message)));
  }

  const names = result.mods.map(m => m.name);
  if (names.indexOf('Mod Configuration Menu') < names.indexOf('Some Mod That Needs It')) {
    console.log('  ok    and still orders the dependency first');
  } else {
    failures++;
    console.log('  FAIL  folder-resolved dependency did not order first: ' + JSON.stringify(names));
  }

  // The other half of the guarantee: resolving by folder must not invent a
  // link. A requirement nobody in the list satisfies still has to be reported.
  const absent = {
    Order: [
      {
        Name: 'Some Mod That Needs It',
        Folder: 'SomeModThatNeedsIt',
        UUID: '11111111-2222-3333-4444-555555555555',
        Dependencies: [{ Name: 'NotInstalledAnywhere', UUID: '' }],
      },
    ],
  };
  const absentResult = sortLoadOrder(
    parseLoadOrder(JSON.stringify(absent), 'absent-dep.json').mods,
    masterlist,
  );
  if (absentResult.issues.some(i => i.kind === 'missing-dependency')) {
    console.log('  ok    a genuinely absent dependency is still reported');
  } else {
    failures++;
    console.log('  FAIL  a genuinely missing dependency went unreported');
  }
}

// A required mod that the working orders load last anyway. Compatibility
// Framework is the real case: pinned to the final divider, then dragged to the
// front by the five mods declaring it as a requirement. Built here from
// synthetic plugins so the test states the rule rather than depending on which
// mods the corpus currently flags.
{
  const LATE = 'aaaaaaaa-0000-0000-0000-000000000001';
  const EARLY = 'bbbbbbbb-0000-0000-0000-000000000002';
  const withFlag = flagged => ({
    ...masterlist,
    plugins: [
      ...masterlist.plugins,
      {
        name: 'Late Patcher',
        uuid: LATE,
        group: masterlist.plugins.find(p => p.divider === 105)?.group ?? 'Bottom of Load Order',
        divider: 105,
        ...(flagged ? { loadsAfterDependents: true } : {}),
      },
      {
        name: 'Early Class Mod',
        uuid: EARLY,
        group: 'Classes',
        divider: 57,
        dependencies: [{ uuid: LATE, name: 'Late Patcher' }],
      },
    ],
  });

  const order = JSON.stringify({
    Order: [
      { Name: 'Late Patcher', UUID: LATE, Folder: 'LatePatcher' },
      { Name: 'Early Class Mod', UUID: EARLY, Folder: 'EarlyClassMod' },
    ],
  });
  const mods = parseLoadOrder(order, 'late-patcher.json').mods;

  console.log('');
  console.log('load-after-dependents fixture');

  const flagged = sortLoadOrder(mods, withFlag(true)).mods.map(m => m.name);
  if (flagged.indexOf('Late Patcher') > flagged.indexOf('Early Class Mod')) {
    console.log('  ok    a flagged mod keeps its late slot despite being required');
  } else {
    failures++;
    console.log('  FAIL  flagged mod still dragged forward: ' + JSON.stringify(flagged));
  }

  // The control. Without the flag the requirement is an ordering edge as
  // usual, which is what makes the assertion above mean anything.
  const plain = sortLoadOrder(mods, withFlag(false)).mods.map(m => m.name);
  if (plain.indexOf('Late Patcher') < plain.indexOf('Early Class Mod')) {
    console.log('  ok    and an ordinary requirement still orders first');
  } else {
    failures++;
    console.log('  FAIL  unflagged requirement did not order first: ' + JSON.stringify(plain));
  }

  // Dropping the ordering claim must not drop the requirement.
  const soloResult = sortLoadOrder(
    parseLoadOrder(JSON.stringify({
      Order: [{ Name: 'Early Class Mod', UUID: EARLY, Folder: 'EarlyClassMod' }],
    }), 'late-patcher-absent.json').mods,
    withFlag(true),
  );
  if (soloResult.issues.some(i => i.kind === 'missing-dependency')) {
    console.log('  ok    the requirement still stands when the mod is absent');
  } else {
    failures++;
    console.log('  FAIL  a flagged mod going missing was not reported');
  }
}

// A requirement naming a mod by something none of the mod's own strings match.
// Reported from a load order that held Vlad's Grimoire and was told it did
// not: the pak is called VFX_Library_VladsGrimoire and the mod page is called
// "Vlad's Grimoire - Spell VFX Library", so neither the name nor the folder
// matches what a mod author writes. Only a curated alias joins them.
{
  console.log('');
  console.log('curated requirement alias fixture');

  const aliases = masterlist.requirementAliases ?? {};
  const aliased = Object.entries(aliases)
    .map(([key, uuid]) => ({ key, plugin: masterlist.plugins.find(p => p.uuid === uuid) }))
    .filter(a => a.plugin);

  if (aliased.length) {
    console.log(`  ok    ${aliased.length} alias${aliased.length > 1 ? 'es' : ''} resolve to a mod in the masterlist`);
  } else {
    failures++;
    console.log('  FAIL  no requirement alias resolves to anything');
  }

  // Each alias must actually satisfy a requirement written that way, which is
  // the only thing any of this is for.
  let broken = 0;
  for (const { key, plugin } of aliased) {
    const order = JSON.stringify({
      Order: [
        { Name: plugin.name, UUID: plugin.uuid, Folder: plugin.folder ?? plugin.name },
        {
          Name: 'Something That Needs It',
          UUID: 'cccccccc-0000-0000-0000-000000000003',
          Folder: 'SomethingThatNeedsIt',
          Dependencies: [{ Name: key, UUID: '' }],
        },
      ],
    });
    const result = sortLoadOrder(parseLoadOrder(order, 'alias.json').mods, masterlist);
    if (result.issues.some(i => i.kind === 'missing-dependency')) {
      broken++;
      console.log(`  FAIL  alias "${key}" did not satisfy a requirement naming it`);
    }
  }
  if (broken) failures++;
  else console.log('  ok    every alias satisfies a requirement written that way');
}

// Requirements that are not what a broken load order looks like. Reported by
// a player shown three critical warnings, all of them wrong in a different
// way: one mod they had under another name, one they had a substitute for, and
// one that most working orders simply do without.
{
  console.log('');
  console.log('requirement strength fixture');

  const REQUIRING = {
    Name: 'Needs Things',
    UUID: 'ffffffff-0000-0000-0000-000000000006',
    Folder: 'NeedsThings',
  };
  const sortWith = (extra, deps) => sortLoadOrder(
    parseLoadOrder(JSON.stringify({
      Order: [...extra, { ...REQUIRING, Dependencies: deps }],
    }), 'strength.json').mods,
    masterlist,
  );

  // A mod nobody installs, declared by mods that plainly work without it, is
  // still worth mentioning and is not a broken order.
  const soft = masterlist.plugins.find(p => p.oftenAbsent);
  if (!soft) {
    console.log('  note  no requirement currently measures as often absent, nothing to assert');
  } else {
    const issues = sortWith([], [{ Name: soft.name, UUID: soft.uuid }]).issues
      .filter(i => i.kind === 'missing-dependency');
    if (issues.length && issues.every(i => i.severity === 'warning')) {
      console.log(`  ok    "${soft.name}" reads as a warning, not a broken load order`);
    } else {
      failures++;
      console.log(`  FAIL  expected a warning for "${soft.name}", got ${JSON.stringify(issues.map(i => i.severity))}`);
    }
  }

  // A library, by contrast, is exactly what a load order is broken without.
  const hard = masterlist.plugins.find(p => !p.oftenAbsent && !p.uuid.startsWith('name:')
    && masterlist.plugins.some(q => (q.dependencies ?? []).some(d => d.uuid === p.uuid)));
  if (hard) {
    const issues = sortWith([], [{ Name: hard.name, UUID: hard.uuid }]).issues
      .filter(i => i.kind === 'missing-dependency');
    if (issues.length && issues.every(i => i.severity === 'critical')) {
      console.log(`  ok    "${hard.name}" is still critical when genuinely absent`);
    } else {
      failures++;
      console.log(`  FAIL  a hard requirement stopped being critical: ${JSON.stringify(issues.map(i => i.severity))}`);
    }
  }

  // A stand-in present in the list satisfies the requirement outright.
  const pairs = Object.entries(masterlist.requirementSatisfiedBy ?? {});
  if (!pairs.length) {
    failures++;
    console.log('  FAIL  no requirement stand-ins reached the masterlist');
  } else {
    let broken = 0;
    for (const [reqUuid, altUuids] of pairs) {
      const req = masterlist.plugins.find(p => p.uuid === reqUuid);
      const alt = masterlist.plugins.find(p => p.uuid === altUuids[0]);
      if (!req || !alt) continue;
      // Named specifically: the stand-in is a real mod with requirements of
      // its own, and those are nothing to do with this assertion.
      const reportsThis = result => result.issues.some(
        i => i.kind === 'missing-dependency' && i.message.includes(`"${req.name}"`),
      );
      const withAlt = sortWith(
        [{ Name: alt.name, UUID: alt.uuid, Folder: alt.folder ?? alt.name }],
        [{ Name: req.name, UUID: req.uuid }],
      );
      if (reportsThis(withAlt)) {
        broken++;
        console.log(`  FAIL  "${alt.name}" did not satisfy a requirement for "${req.name}"`);
      }
      // And with neither present, it must still be reported.
      if (!reportsThis(sortWith([], [{ Name: req.name, UUID: req.uuid }]))) {
        broken++;
        console.log(`  FAIL  "${req.name}" went unreported with no stand-in present`);
      }
    }
    if (broken) failures++;
    else console.log(`  ok    ${pairs.length} stand-ins satisfy their requirement, and only when present`);
  }
}

// The game's own modules are not mods, and cannot be missing from a load
// order. This list lived in two places and they drifted: the parser knew about
// MainUI, CrossplayUI and PhotoMode, the miner did not, and 32 mods ended up
// carrying a requirement for a base game module that nobody can install.
{
  console.log('');
  console.log('engine modules');

  const engine = JSON.parse(fs.readFileSync('client/src/lib/engine-modules.json', 'utf8')).modules;
  const parserSrc = fs.readFileSync('client/src/lib/parser.ts', 'utf8');
  const minerSrc = fs.readFileSync('scripts/mine-corpus.mjs', 'utf8');

  if (parserSrc.includes('engine-modules.json') && minerSrc.includes('engine-modules.json')
    && !/ENGINE_MASTERS = new Set\(\[/.test(parserSrc + minerSrc)) {
    console.log('  ok    one list, read by both the parser and the miner');
  } else {
    failures++;
    console.log('  FAIL  an engine module list is written out again instead of read');
  }

  const leaked = [];
  for (const p of masterlist.plugins) {
    if (engine.includes(p.name)) leaked.push(`${p.name} is in the masterlist as a mod`);
    for (const d of p.dependencies ?? []) {
      if (engine.includes(d.name)) leaked.push(`${p.name} requires ${d.name}`);
    }
  }
  if (!leaked.length) {
    console.log('  ok    no mod in the masterlist requires one, and none is listed as a mod');
  } else {
    failures++;
    console.log(`  FAIL  ${leaked.length} engine module references survived: ${leaked.slice(0, 3).join('; ')}`);
  }
}

// Dividers from a set this project does not catalogue. Reported by somebody
// using LN P8 Load Order Dividers: VOLO stripped theirs, which is right, and
// then could only offer Astra's back, which they do not have installed. The
// export has to return the paks the order arrived with.
{
  console.log('');
  console.log('foreign divider set fixture');

  const ui = masterlist.plugins.find(p => p.group === 'User Interface' && !p.uuid.startsWith('name:'));
  const other = masterlist.plugins.find(
    p => p.group && p.group !== ui?.group && !p.uuid.startsWith('name:'),
  );
  const MINE_A = { UUID: '9a9a9a9a-1111-2222-3333-444444444401', Name: '===== My UI Section =====' };
  const MINE_B = { UUID: '9a9a9a9a-1111-2222-3333-444444444402', Name: '===== My Other Section =====' };

  const parsed = parseLoadOrder(JSON.stringify({
    Order: [MINE_A, { Name: ui.name, UUID: ui.uuid }, MINE_B, { Name: other.name, UUID: other.uuid }],
  }), 'mine.json');

  if (parsed.sections.length === 2 && parsed.sections.every(s => s.uuid && s.name)) {
    console.log('  ok    a divider set we do not catalogue is kept, uuid and all');
  } else {
    failures++;
    console.log(`  FAIL  imported dividers lost: ${JSON.stringify(parsed.sections)}`);
  }

  const sorted = sortLoadOrder(parsed.mods, masterlist);
  const withMine = JSON.parse(exportOrder(sorted, 'bg3mm', {
    insertDividers: true, sections: parsed.sections,
  }));
  const emitted = withMine.Order.map(e => e.UUID);

  if (emitted.includes(MINE_A.UUID) || emitted.includes(MINE_B.UUID)) {
    console.log("  ok    the user's own dividers come back in the export");
  } else {
    failures++;
    console.log('  FAIL  the export dropped the dividers the order arrived with');
  }

  const astraUuids = new Set(dividers.uuids);
  if (!emitted.some(u => astraUuids.has(u))) {
    console.log("  ok    and Astra's set is not substituted for one they have");
  } else {
    failures++;
    console.log("  FAIL  Astra's dividers were inserted over the user's own");
  }

  // An order that arrived with none still gets the catalogued set offered.
  const bare = parseLoadOrder(JSON.stringify({
    Order: [{ Name: ui.name, UUID: ui.uuid }, { Name: other.name, UUID: other.uuid }],
  }), 'bare.json');
  const withAstra = JSON.parse(exportOrder(sortLoadOrder(bare.mods, masterlist), 'bg3mm', {
    insertDividers: true, sections: bare.sections,
  }));
  if (withAstra.Order.some(e => astraUuids.has(e.UUID))) {
    console.log("  ok    an order that had none still gets Astra's as the fallback");
  } else {
    failures++;
    console.log('  FAIL  no dividers inserted for an order that carried none');
  }

  // Nothing is inserted unless asked, whichever set would be used.
  const off = JSON.parse(exportOrder(sorted, 'bg3mm', { sections: parsed.sections }));
  if (off.Order.length === parsed.mods.length) {
    console.log('  ok    and none at all when the option is off');
  } else {
    failures++;
    console.log('  FAIL  dividers inserted without being asked for');
  }
}

// A mod name has to be selectable, so it can be copied and looked up. Asked
// for by a user, and not possible before: each row of the sorted order is a
// button, and browsers do not let a drag select text inside one.
{
  console.log('');
  console.log('sorted order is copyable');

  const page = fs.readFileSync('client/src/pages/OptimisePage.tsx', 'utf8');

  if (/select-text/.test(page)) {
    console.log('  ok    the mod name opts back in to being selectable');
  } else {
    failures++;
    console.log('  FAIL  nothing makes the mod name selectable inside the row button');
  }

  // Selecting text ends in a click on the row, which must not open it.
  if (/getSelection\(\)/.test(page) && /isCollapsed/.test(page)) {
    console.log('  ok    and selecting a name does not toggle the row open');
  } else {
    failures++;
    console.log('  FAIL  a drag to select will still expand the row it crossed');
  }
}

// Intake must not depend on a label alone. GitHub drops a label an issue
// template asks for when the repository does not have it, with no error
// anywhere, and that is exactly what happened: `wrong-placement` was never
// created, so every report of a wrong placement arrived unlabelled and the
// branch handling them had never run on a single one.
{
  console.log('');
  console.log('issue intake does not hang on a label');

  const workflow = fs.readFileSync('.github/workflows/process-submission.yml', 'utf8');
  const templates = fs.readdirSync('.github/ISSUE_TEMPLATE')
    .filter(f => f.endsWith('.yml') && f !== 'config.yml')
    .map(f => ({ file: f, text: fs.readFileSync(path.join('.github/ISSUE_TEMPLATE', f), 'utf8') }));

  // Every label a template asks for, and whether intake can still recognise
  // that template's issues without it.
  const gaps = [];
  for (const t of templates) {
    const declared = (t.text.match(/^labels:\s*\[(.*)\]/m) ?? [])[1];
    if (!declared) continue;
    const labels = declared.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    /*
     * Only the labels intake actually branches on, read out of the expression
     * that tests them. Matching the bare word anywhere in the file caught the
     * word "bug" inside a comment and failed a template nothing keys on.
     */
    const keyedOn = new Set(
      [...workflow.matchAll(/labels\.\*\.name,\s*'([^']+)'/g)].map(m => m[1]),
    );
    for (const label of labels) {
      if (!keyedOn.has(label)) continue;
      // Intake keys on this label, so it needs a second way in: a heading the
      // template writes into every body it creates.
      const headings = [...t.text.matchAll(/^\s*label:\s*(.+)$/gm)].map(m => m[1].trim());
      const covered = headings.some(h => workflow.includes(h));
      if (!covered) gaps.push(`${t.file}: intake only recognises "${label}" by label`);
    }
  }

  if (!gaps.length) {
    console.log('  ok    every labelled template is also recognised by what it writes');
  } else {
    failures++;
    for (const g of gaps) console.log(`  FAIL  ${g}`);
  }
}

// A slot the user picked for their own mod. Asked for by somebody with a lot
// of unsorted cosmetics who knows what they are and does not want to file a
// GitHub issue per mod.
{
  console.log('');
  console.log('user-assigned divider slots');

  const UNKNOWN = 'dddddddd-0000-0000-0000-00000000000a';
  const order = JSON.stringify({
    Order: [
      { Name: 'Totally Unknown Cosmetic Thing', UUID: UNKNOWN, Folder: 'UnknownCosmetic' },
      ...masterlist.plugins
        .filter(p => typeof p.divider === 'number' && !p.uuid.startsWith('name:'))
        .slice(0, 6)
        .map(p => ({ Name: p.name, UUID: p.uuid })),
    ],
  });
  const mods = parseLoadOrder(order, 'assigned.json').mods;

  const before = sortLoadOrder(mods, masterlist);
  const wasUnsorted = before.placements.get(UNKNOWN)?.groupSource === 'default';
  if (wasUnsorted) {
    console.log('  ok    a mod nothing knows about starts unsorted');
  } else {
    failures++;
    console.log('  FAIL  the fixture mod was placed by something, so this proves nothing');
  }

  // 37 is Clothing, an exact slot. 61 is the Customization category heading,
  // which is the partial answer somebody gives when they know the kind but not
  // the position.
  for (const slot of [37, 61]) {
    const after = sortLoadOrder(mods, masterlist, null, { [UNKNOWN]: slot });
    const p = after.placements.get(UNKNOWN);
    if (p?.groupSource === 'you' && p.divider !== undefined) {
      console.log(`  ok    slot ${slot} is honoured and labelled as the user's own`);
    } else {
      failures++;
      console.log(`  FAIL  slot ${slot} ignored: ${JSON.stringify({ source: p?.groupSource, divider: p?.divider })}`);
    }
  }

  // And it has to actually move: an assigned mod sorts among its new section
  // rather than staying at the end with the unplaced ones.
  const assignedFirst = sortLoadOrder(mods, masterlist, null, { [UNKNOWN]: 0 });
  const positions = assignedFirst.mods.map(m => m.uuid);
  if (positions[0] === UNKNOWN) {
    console.log('  ok    and the mod moves to where the slot puts it');
  } else {
    failures++;
    console.log('  FAIL  an assigned mod did not move: ' + positions.indexOf(UNKNOWN));
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
 * A thin export must still be able to credit its mods.
 *
 * Most submitted orders carry no author column, so the page could name an
 * author for one row in twenty. The masterlist already holds one for most of
 * them and every visitor downloads it, so the sorter carries it through to the
 * placement. The file's own answer still wins, because that is the pak the
 * person actually installed.
 */
{
  console.log('author recovery');

  const list = {
    version: '0', generated: '', groups: [],
    plugins: [
      { uuid: '11111111-1111-1111-1111-111111111111', name: 'Alpha', group: 'unsorted', author: 'Someone' },
      { uuid: '22222222-2222-2222-2222-222222222222', name: 'Bravo', group: 'unsorted', author: 'Masterlist Author' },
    ],
  };
  const thin = JSON.stringify({
    Order: [
      { UUID: '11111111-1111-1111-1111-111111111111', Name: 'Alpha' },
      { UUID: '22222222-2222-2222-2222-222222222222', Name: 'Bravo' },
    ],
  });
  const parsedThin = parseLoadOrder(thin, 'thin.json');
  const sortedThin = sortLoadOrder(parsedThin.mods, list);
  const recovered = sortedThin.placements.get('11111111-1111-1111-1111-111111111111')?.author;

  if (recovered === 'Someone') {
    console.log('  ok    an export with no author column still credits its mods');
  } else {
    failures++;
    console.log(`  FAIL  author not recovered for a thin export (got ${JSON.stringify(recovered)})`);
  }

  const rich = JSON.stringify({
    Order: [{ UUID: '11111111-1111-1111-1111-111111111111', Name: 'Alpha', Author: 'The Pak Says This' }],
  });
  const sortedRich = sortLoadOrder(parseLoadOrder(rich, 'rich.json').mods, list);
  const own = parseLoadOrder(rich, 'rich.json').mods[0].author;
  const placed = sortedRich.placements.get('11111111-1111-1111-1111-111111111111')?.author;

  if (own === 'The Pak Says This' && placed === 'The Pak Says This') {
    console.log("  ok    the file's own author is not overwritten by the masterlist");
  } else {
    failures++;
    console.log(`  FAIL  the file's author was displaced (own ${JSON.stringify(own)}, placed ${JSON.stringify(placed)})`);
  }
}

/**
 * A specific section key must be declared before any key it contains.
 *
 * groupForSection falls back to the first key appearing anywhere in the label,
 * so declaration order is behaviour. 'skins' sat above 'dice' and sent 173 dice
 * sets to Bodies; 'loaders' sat above 'late loaders' and split one submitter's
 * two headers across two groups. Nothing announced either.
 */
{
  console.log('section table order');

  const source = fs.readFileSync('scripts/mine-corpus.mjs', 'utf8');
  const block = source.slice(source.indexOf('const SECTION_TO_GROUP'));
  const table = block.slice(0, block.indexOf('};'));
  const pairs = [...table.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]);

  const shadowed = [];
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const [outerKey, outerGroup] = pairs[i];
      const [innerKey, innerGroup] = pairs[j];
      // A key declared later that CONTAINS an earlier one can never be reached
      // by the fallback, so it must not promise a different group.
      if (innerKey.includes(outerKey) && innerKey !== outerKey && innerGroup !== outerGroup) {
        shadowed.push(`'${innerKey}' -> ${innerGroup} is unreachable behind '${outerKey}' -> ${outerGroup}`);
      }
    }
  }

  if (pairs.length && !shadowed.length) {
    console.log(`  ok    ${pairs.length} section keys, none shadowed by a shorter one above it`);
  } else {
    failures++;
    if (!pairs.length) console.log('  FAIL  the section table could not be read');
    for (const s of shadowed) console.log(`  FAIL  ${s}`);
  }
}

/**
 * One rule for whether a Nexus listing belongs to a mod.
 *
 * The crawler keeps fuzzy matches as well as exact ones, which is right for
 * guessing what a mod is and wrong for asserting which mod it is. The two
 * consumers of nexus/enrichment.json disagreed: the requirement promotion took
 * exact matches only, saying so in a comment, while the Script Extender block
 * took every match and told 25 mods a listing was theirs on a name similarity
 * alone. Both read one filtered view now, and this fails if a third consumer
 * starts reading the file raw.
 */
{
  console.log('nexus enrichment policy');

  const miner = fs.readFileSync('scripts/mine-corpus.mjs', 'utf8');
  const rawReads = [...miner.matchAll(/Object\.entries\(\s*enrichment\s*\)/g)].length;
  const filtered = miner.includes('nexusMatches');

  if (filtered && rawReads === 0) {
    console.log('  ok    every consumer reads the same exact-match view');
  } else {
    failures++;
    if (!filtered) console.log('  FAIL  the filtered enrichment view is gone');
    if (rawReads) console.log(`  FAIL  ${rawReads} consumer(s) still read enrichment.json unfiltered`);
  }

  const list = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
  const known = new Set(list.plugins.map(p => p.uuid));
  const dangling = list.plugins.flatMap(p => (p.dependencies ?? []))
    .filter(d => d.uuid && !String(d.uuid).startsWith('name:') && !known.has(d.uuid)).length;
  if (!dangling) {
    console.log('  ok    every promoted requirement lands on a mod that exists');
  } else {
    failures++;
    console.log(`  FAIL  ${dangling} dependency edge(s) point at nothing`);
  }
}

/**
 * A name with no latin letters must not answer for every other one.
 *
 * Name lookups normalise by stripping everything outside a-z0-9, so a title
 * written in Chinese, Japanese, Korean or Cyrillic reduces to the empty string.
 * One submitted order carries 23 of them. Without a guard they shared a single
 * bucket and the last one written answered for all 23, so a dependency naming
 * any of them resolved to whichever happened to be last.
 */
{
  console.log('non-latin names');

  const order = JSON.stringify({
    Order: [
      { UUID: '11111111-1111-1111-1111-111111111111', Name: '显示状态免疫' },
      { UUID: '22222222-2222-2222-2222-222222222222', Name: '鲜血恩惠' },
      { UUID: '33333333-3333-3333-3333-333333333333', Name: 'CommunityLibrary' },
      { UUID: '44444444-4444-4444-4444-444444444444', Name: 'ImpUI (ImprovedUI)' },
      { UUID: '55555555-5555-5555-5555-555555555555', Name: 'Better Target Info' },
    ],
  });
  const parsedOrder = parseLoadOrder(order, 'nonlatin.json');
  const sortedOrder = sortLoadOrder(parsedOrder.mods, { version: '0', generated: '', groups: [], plugins: [] });
  const kept = new Set(sortedOrder.mods.map(m => m.uuid));
  const bothKept = kept.has('11111111-1111-1111-1111-111111111111')
    && kept.has('22222222-2222-2222-2222-222222222222');

  if (parsedOrder.mods.length === 5 && sortedOrder.mods.length === 5 && bothKept) {
    console.log('  ok    two names with no latin characters stay two mods');
  } else {
    failures++;
    console.log(`  FAIL  non-latin names collapsed: parsed ${parsedOrder.mods.length}, sorted ${sortedOrder.mods.length}`);
  }
}

/**
 * A curated rule naming a mod no order carries stops a build, and not a fold.
 *
 * Stopping is right for a real build: the rule matches nothing, and a dead rule
 * survives by being quiet. A held-out fold removes an order on purpose, and
 * every mod only that order carried goes with it, so the same check there fires
 * on a rule that is perfectly good.
 *
 * It did. An alias added for a mod carried by one order made every fold
 * excluding that order throw, which failed the landing step of a submission
 * already accepted and reported to its submitter. The order sat unlanded for
 * fourteen hours, and the safety net that should have retried it could not,
 * so nothing recovered it until somebody looked.
 */
{
  console.log('');
  console.log('curated rules in a fold');

  const rules = JSON.parse(fs.readFileSync('masterlist/curated-rules.json', 'utf8'));
  const named = [
    ...rules.requirementAliases.map(r => r.mod),
    ...rules.requirementSatisfiedBy.flatMap(r => [r.requirement, r.satisfiedBy]),
  ];
  const key = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const have = new Set(masterlist.plugins.flatMap(p => [key(p.name), key(p.folder)]).filter(Boolean));

  /* On a full build every rule must resolve, which is the guard's real job. */
  const dead = named.filter(n => !have.has(key(n)));
  if (!dead.length) {
    console.log(`  ok    all ${named.length} mods named by curated rules are in the masterlist`);
  } else {
    failures++;
    for (const n of dead.slice(0, 5)) console.log(`  FAIL  curated rules name "${n}", which no order carries`);
  }

  /* And the guard must be written so a fold can survive losing one. */
  const miner = fs.readFileSync('scripts/mine-corpus.mjs', 'utf8');
  const foldAware = /const fold = EXCLUDE !== null \|\| OUT_DIR !== 'masterlist';/.test(miner)
    && /if \(fold\) console\.log/.test(miner);
  if (foldAware) {
    console.log('  ok    and the guard warns rather than throws during a fold');
  } else {
    failures++;
    console.log('  FAIL  the curated-rule guard throws unconditionally, so a fold can fail a landing');
  }
}

/**
 * A requirement stated twice must not become a requirement on nothing.
 *
 * The same mod appears in several orders, and the export formats do not agree
 * on how much they carry: one states a requirement with its uuid, another
 * states it as a bare name. Both were recorded, under different keys, and the
 * name-keyed copy could never resolve, because `name:` keys only match mods the
 * corpus has no uuid for and this one has one. It sat in the masterlist as a
 * requirement pointing at nothing, and the browser reported it in red forever.
 *
 * Two existed. A user had both, was told twice that mods he had installed were
 * missing, and the count above the list read "2 mods require" while naming one
 * patch twice.
 */
{
  console.log('');
  console.log('duplicate requirements');

  const normDep = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const phantom = [];
  for (const plugin of masterlist.plugins) {
    const deps = plugin.dependencies ?? [];
    if (deps.length < 2) continue;
    const resolvable = new Set(
      deps.filter(d => d.uuid && !String(d.uuid).startsWith('name:')).map(d => normDep(d.name)),
    );
    for (const d of deps) {
      if (String(d.uuid ?? '').startsWith('name:') && resolvable.has(normDep(d.name))) {
        phantom.push(`${plugin.name} requires ${JSON.stringify(d.name)} both ways`);
      }
    }
  }

  if (!phantom.length) {
    console.log('  ok    no requirement is recorded both by uuid and by name');
  } else {
    failures++;
    for (const line of phantom.slice(0, 5)) console.log(`  FAIL  ${line}`);
  }

  /* And the count above the list counts mods, not declarations. */
  const twice = {
    Order: [
      { Name: 'Mod Configuration Menu', Folder: 'BG3MCM', UUID: '755a8a72-407f-4f0d-9a33-274ac75b1f7b' },
      {
        Name: 'Asks Twice',
        Folder: 'AsksTwice',
        UUID: '33333333-4444-5555-6666-777777777777',
        Dependencies: [
          { Name: 'Nothing At All', UUID: '99999999-8888-7777-6666-555555555555' },
          { Name: 'Nothing At All', UUID: '' },
        ],
      },
    ],
  };
  const asked = sortLoadOrder(
    parseLoadOrder(JSON.stringify(twice), 'asks-twice.json').mods,
    masterlist,
  ).issues.filter(i => i.kind === 'missing-dependency');

  if (asked.length === 1 && asked[0].uuids.length === 1 && /^1 mod requires/.test(asked[0].message)) {
    console.log('  ok    one mod asking twice is reported as one mod');
  } else {
    failures++;
    console.log(`  FAIL  ${asked.length} issue(s), first names ${asked[0]?.uuids.length} mod(s): `
      + `${JSON.stringify(asked[0]?.message ?? '').slice(0, 90)}`);
  }
}

/**
 * A run of dashes inside a mod's name must not delete the mod.
 *
 * The separator rule matched a run anywhere, so "Angel Wings And Halos ____ By
 * Ren", a published mod with 264,623 downloads, was read as a section header in
 * every order that held it: never sorted, never shown, never written back out.
 * Both copies of the rule are checked against the same probes, because the
 * miner dropping a row and the browser keeping it is its own kind of wrong.
 */
{
  console.log('separator rule');

  const probes = [
    ['================|            UI            |================', true],
    ['---------------------------| Backgrounds |---------------------------', true],
    ['] Armor [', true],
    ['>             Jewelry', true],
    ['____________', true],
    ['Mods ==========', true],
    ['Angel Wings And Halos ____ By Ren', false],
    ['into The Void----Chinese or Blend into the Void BUFF time changed to 10 turns', false],
    ['Better_Hotbar_2_16_9', false],
    ['BW_TaL_Ruler_of_the_North', false],

    /* Ornamented dividers. An author submitted an order built on 301 of these
     * and was told it held no section headers, so all 301 were mined as mods
     * with groups and slots. Written as escapes because the audit keeps
     * committed files ASCII. */
    ['\u25C6\u2501\u2501 000 \u00B7 UI MODS \u2501\u2501\u25C6', true],
    ['\u25C7 001 \u00B7 ImprovedUI', true],
    ['\u2606\u2606\u2606 000x \u00B7 Unsorted UI Mods', true],

    /* Real mods whose authors put ornaments in the title. These are why the run
     * length is three: at two the first is read as a header and deleted. */
    ['\u2718\u2B51.\u141F Lagardia\'s Arcane Presets', false],
    ['\u02DA\u2661\u02DA Bambi\'s Anahita', false],
  ];

  /* Both copies are read from source rather than imported, because the miner is
   * a script. The rule is a built expression now, not a literal, and the older
   * extraction here silently returned null when that changed: it reported the
   * rule as unreadable rather than passing, which is the only reason this was
   * caught at all. */
  const ruleFrom = file => {
    const src = fs.readFileSync(file, 'utf8');
    const from = src.indexOf('const ORNAMENT');
    const close = "].join('|'));";
    const to = src.indexOf(close, from);
    if (from < 0 || to < 0) return null;
    const decl = src.slice(from, to + close.length);
    try {
      return eval(`(function () { ${decl} return SEPARATOR_RE; })()`);
    } catch {
      return null;
    }
  };

  const minerRule = ruleFrom('scripts/mine-corpus.mjs');
  const browserRule = ruleFrom('client/src/lib/parser.ts');

  const wrong = probes.filter(([name, expected]) =>
    isSeparator(name) !== expected || (minerRule && minerRule.test(name) !== expected));

  /* Behaviour agreeing on ten probes is not the same as the rules being equal,
   * and the thing that drifts is the pattern. The miner decides what the corpus
   * learns from and the browser decides what a user's order is sorted as, so a
   * difference shows up as somebody's dividers shuffled into their mod list
   * rather than as a failing build. */
  const identical = minerRule && browserRule && minerRule.source === browserRule.source;

  if (minerRule && browserRule && identical && !wrong.length) {
    console.log(`  ok    both rules agree on ${probes.length} probes and are the same pattern`);
  } else {
    failures++;
    if (!minerRule) console.log("  FAIL  the miner's separator rule could not be read");
    if (!browserRule) console.log("  FAIL  the browser's separator rule could not be read");
    if (minerRule && browserRule && !identical) {
      console.log('  FAIL  the miner and the browser no longer share one separator rule');
    }
    for (const [name] of wrong) console.log(`  FAIL  separator rule wrong for ${JSON.stringify(name).slice(0, 60)}`);
  }
}

/**
 * The miner and the app must agree on what identifies a mod.
 *
 * A mod is counted under its UUID. modsettings.lsx always supplies one and
 * BG3MM's full export does too, but its load order export writes `"UUID": ""`
 * for anything unresolved, and its TSV has no UUID column at all while naming
 * a pak that ends in one. The app's parser recovered that; the miner did not,
 * so 865 entries across two submitted orders were counted by name in the
 * masterlist and by UUID in the browser. The same mod exported two ways became
 * two rows with its evidence divided between them, and one of those rows was
 * reported to users as never verified while the other had twelve working
 * installs behind it.
 */
{
  console.log('identity across export methods');

  const miner = fs.readFileSync('scripts/mine-corpus.mjs', 'utf8');
  const parser = fs.readFileSync('client/src/lib/parser.ts', 'utf8');
  const rule = /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/;

  if (rule.test(miner) && rule.test(parser)) {
    console.log('  ok    both recover a UUID from a pak filename');
  } else {
    failures++;
    console.log(`  FAIL  ${rule.test(parser) ? 'the miner' : 'the parser'} cannot read a UUID out of a filename`);
  }

  if (miner.includes('uuidByName')) {
    console.log('  ok    a name is reconciled to a UUID the corpus supplied for it');
  } else {
    failures++;
    console.log('  FAIL  nothing reconciles a name-keyed mod with its own UUID');
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
 * The community watcher reads the comment, not the label above it.
 *
 * A comment's body sits in comment-content-text. The enclosing comment-content
 * opens with a hidden "Locked" div, so a pattern that closes on the first
 * </div> returns the word "Locked" for every comment ever posted. It did that
 * for weeks, and nothing could tell: the output looked like a list of comments,
 * the counts were right, and only the words were wrong.
 *
 * The markup here is a trimmed copy of the real page. It will drift, and when
 * it does this fails and says so, which is the whole point: a scraper of
 * somebody else's HTML is the last thing that should be trusted silently.
 */
{
  console.log('');
  console.log('community watcher');

  const { parseNexus } = await import('./watch-community.mjs');

  const page = [
    '<li class="comment odd" id="comment-174046263">',
    '  <a class="comment-user" href="https://next.nexusmods.com/profile/Keileon">',
    '    <img src="https://avatars.nexusmods.com/22130454/100" /></a>',
    '  <div class="comment-content">',
    '    <div id="locked-comment-label-174046263" class="locked" style="display:none;">',
    '      Locked',
    '    </div>',
    '    <div class="dst-date-adjust" data-date="1787091420"></div>',
    '    <div class="comment-content-text">',
    '      Sent in Issue 114 with all of my new section dividers in!',
    '    </div>',
    '  </div>',
    '</li>',
  ].join('\n');

  const { items } = parseNexus(page);
  const one = items[0];

  if (!one) {
    failures++;
    console.log('  FAIL  the watcher parsed no comment out of the sample page');
  } else if (/^Locked$/i.test(one.text)) {
    failures++;
    console.log('  FAIL  the watcher is reading the locked label instead of the comment');
  } else if (!one.text.includes('section dividers') || one.author !== 'Keileon') {
    failures++;
    console.log(`  FAIL  the watcher misread the sample: ${JSON.stringify(one.author)} said ${JSON.stringify(one.text)}`);
  } else {
    console.log('  ok    the watcher reads the comment body and its author');
  }
}

/**
 * What the built pages tell search engines about themselves.
 *
 * /optimise and /export render whatever load order someone imported. They are
 * prerendered so a refresh returns a real page, and marked noindex because that
 * page has nothing to index and belongs to whoever is looking at it. Nothing
 * checked that the tag survived the build, so the guarantee rested on the
 * prerenderer alone.
 *
 * Both directions are checked, and the second matters more. A page wrongly
 * marked noindex is a page removed from search, and a mistake in the shared
 * default would take the whole site out at once, quietly, with the build green.
 *
 * `head.ts` is the source of truth rather than a list repeated here, so a new
 * noindex page is covered the day it is added. If the parse ever stops finding
 * routes this fails instead of passing on an empty set, because a test that
 * silently checks nothing is worse than no test.
 */
{
  console.log('');
  console.log('indexing directives');

  const head = fs.readFileSync('client/src/lib/head.ts', 'utf8');
  const pagesBlock = head.slice(
    head.indexOf('export const PAGES'),
    head.indexOf('export const ALIASES'),
  );

  const declared = new Map();
  for (const [, route, body] of pagesBlock.matchAll(/'(\/[a-z]*)':\s*\{([\s\S]*?)\n {2}\},/g)) {
    declared.set(route, /noindex:\s*true/.test(body));
  }
  /* An alias serves the canonical page's tags, so it inherits its answer. */
  for (const [, alias, target] of head.matchAll(/'(\/[a-z]+)':\s*'(\/[a-z]+)',/g)) {
    if (declared.has(target)) declared.set(alias, declared.get(target));
  }

  const file = route => (route === '/' ? 'dist/index.html' : `dist${route}.html`);

  if (declared.size < 2) {
    failures++;
    console.log('  FAIL  could not read the routes out of head.ts, so nothing was checked');
  } else if (!fs.existsSync('dist/index.html')) {
    console.log('  skip  no dist/ yet, run the build to check the indexing directives');
  } else {
    const wrong = [];
    let checked = 0;
    for (const [route, noindex] of declared) {
      if (!fs.existsSync(file(route))) continue;
      checked++;
      const tag = fs.readFileSync(file(route), 'utf8')
        .match(/name="robots" content="([^"]*)"/)?.[1] ?? '(no robots tag)';
      const says = tag.includes('noindex');
      if (says !== noindex) {
        wrong.push(`${route} declares ${noindex ? 'noindex' : 'index'} and ships "${tag}"`);
      }
    }

    if (wrong.length) {
      failures++;
      for (const line of wrong) console.log(`  FAIL  ${line}`);
    } else {
      const hidden = [...declared].filter(([, n]) => n).map(([r]) => r);
      console.log(`  ok    ${checked} built pages match head.ts, ${hidden.length} noindex (${hidden.join(', ')})`);
    }

    /* Asking for a page to be indexed and telling it not to be are contradictory
     * instructions, and Google reports the pair rather than resolving it. */
    if (fs.existsSync('public/sitemap.xml')) {
      const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
      const origin = head.match(/export const SITE = '([^']+)'/)?.[1] ?? '';
      const listed = [...declared]
        .filter(([route, noindex]) => noindex && sitemap.includes(`${origin}${route}<`))
        .map(([route]) => route);
      if (listed.length) {
        failures++;
        console.log(`  FAIL  noindex routes are in the sitemap: ${listed.join(', ')}`);
      } else {
        console.log('  ok    no noindex route is advertised in the sitemap');
      }
    }
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

  /*
   * Every copy must contain the same two patterns. The fourth is the submitter
   * note, which is free text from a stranger rather than an exported order, and
   * reaches the same published file by a route none of the other three cover.
   */
  const copies = {
    'client/src/lib/scrub.ts': fs.readFileSync('client/src/lib/scrub.ts', 'utf8'),
    'functions/api/submit.js': fs.readFileSync('functions/api/submit.js', 'utf8'),
    'scripts/process-submission.mjs': fs.readFileSync('scripts/process-submission.mjs', 'utf8'),
    'scripts/corpus-provenance.mjs': fs.readFileSync('scripts/corpus-provenance.mjs', 'utf8'),
  };
  const missing = Object.entries(copies).filter(([, src]) =>
    !src.includes('home|Users') || !src.includes('[A-Za-z]:'));
  if (!missing.length) {
    console.log(`  ok    all ${Object.keys(copies).length} scrub points cover Windows and Unix paths`);
  } else {
    failures++;
    for (const [file] of missing) console.log(`  FAIL  ${file} is missing a scrub pattern`);
  }

  /*
   * Holding the pattern is not the same as applying it to what a person types.
   * The order was scrubbed at all three boundaries while the note was scrubbed
   * at none of them, so it reached the public issue carrying whatever had been
   * pasted into it, and an issue is permanent. The note is the likelier of the
   * two to hold a path: the box asks what went wrong, which is when somebody
   * pastes one.
   */
  const submitApi = copies['functions/api/submit.js'];
  const submitPage = fs.readFileSync('client/src/pages/SubmitPage.tsx', 'utf8');
  const applied = [
    [submitApi.includes('strip(s)'),
      'the API cleans free text for the issue without stripping paths from it'],
    [/clean\(notes,/.test(submitApi),
      'the API writes the note into the issue without cleaning it'],
    [/clean\(patch,/.test(submitApi),
      'the API writes the patch into the issue without cleaning it'],
    [/scrubPersonalPaths\(notes\)/.test(submitPage),
      'the submit page sends the note without scrubbing it first'],
  ];
  const unapplied = applied.filter(([ok]) => !ok);
  if (!unapplied.length) {
    console.log('  ok    the order, the note and the patch are all scrubbed before they are published');
  } else {
    failures++;
    for (const [, why] of unapplied) console.log(`  FAIL  ${why}`);
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
    /*
     * The neighbour rule, which has to beat the declared answer or it catches
     * nothing: the case it exists for is somebody who sorted with VOLO, played
     * it, and honestly answered that they arranged it themselves.
     */
    ['a near-copy that suddenly agrees far more is flagged whatever was declared',
      { declared: 'self', agreementWithVolo: 0.93, nearest: { similarity: 0.95, agreementWithVolo: 0.64 } }, true],
    ['the original is never flagged by its own echo',
      { declared: 'self', agreementWithVolo: 0.64, nearest: { similarity: 0.95, agreementWithVolo: 0.93 } }, false],
    ['refining your own order is not an echo',
      { declared: 'self', agreementWithVolo: 0.72, nearest: { similarity: 0.99, agreementWithVolo: 0.64 } }, false],
    ['a big jump against an unrelated order means nothing',
      { declared: 'self', agreementWithVolo: 0.93, nearest: { similarity: 0.40, agreementWithVolo: 0.64 } }, false],
    ['an order with nothing to compare against is untouched',
      { declared: 'self', agreementWithVolo: 0.93, nearest: null }, false],
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

  /*
   * The submitter's own words, which reach a published file without ever being
   * an exported order. Two ways this goes wrong and neither announces itself:
   * keeping the placeholder GitHub writes into an empty box, so every silent
   * submission acquires a note saying nothing, and dropping a line because it
   * happens to be wrapped in underscores, which is what a bare pak name looks
   * like.
   */
  const { noteFromIssueBody, NOTE_MAX } = await import('./corpus-provenance.mjs');
  const heading = '### Notes\n\n';
  const notes = [
    ['no Notes field at all', '### Something else\n\nwords', null],
    ['an empty box is not a note', `${heading}_No response_\n`, null],
    ['the site footer alone is not a note', `${heading}_Submitted through volobg3.com_\n`, null],
    ['a note is kept', `${heading}It crashed in act 2.\n`, 'It crashed in act 2.'],
    ['the footer is dropped from a real note',
      `${heading}It crashed.\n\n_Submitted through volobg3.com_\n`, 'It crashed.'],
    ['a line that is only a pak name survives',
      `${heading}_Elven_Weaponry_Chest_Only_\n`, '_Elven_Weaponry_Chest_Only_'],
    ['the note stops at the next field',
      `${heading}the note\n\n### Anything\n\nnot the note\n`, 'the note'],
    ['a Windows path is stripped',
      `${heading}from C:\\Users\\someone\\Mods\\A.pak here`, 'from A.pak here'],
    ['a Unix home is stripped',
      `${heading}see /home/someone/mods/B.pak ok`, 'see B.pak ok'],
    ['a URL containing /Users/ is left alone',
      `${heading}https://cdn.example.com/Users/team/C.pak`, 'https://cdn.example.com/Users/team/C.pak'],
  ];
  const wrongNotes = notes.filter(([, body, expected]) => noteFromIssueBody(body) !== expected);
  if (!wrongNotes.length) {
    console.log(`  ok    submitter notes read correctly in ${notes.length} cases`);
  } else {
    failures++;
    for (const [name, body] of wrongNotes) {
      console.log(`  FAIL  ${name}: got ${JSON.stringify(noteFromIssueBody(body))}`);
    }
  }

  // A truncated note must say so. A sentence cut in half reads as a whole one
  // and can mean the opposite of what was written.
  const long = noteFromIssueBody(heading + 'x'.repeat(NOTE_MAX + 500));
  if (long.length <= NOTE_MAX + 20 && long.endsWith('[truncated]')) {
    console.log(`  ok    an overlong note is cut at ${NOTE_MAX} and marked`);
  } else {
    failures++;
    console.log(`  FAIL  an overlong note was kept at ${long.length} characters`);
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
 * Staged submissions: the pointer intake trusts, and the ones it must not.
 *
 * An order too large for a GitHub issue body is written to R2 and referenced
 * from the issue, so intake fetches a URL it read out of public text that a
 * stranger wrote. The pattern deciding which URL is the whole of that defence,
 * and it is the kind of thing a later edit loosens without noticing, so the
 * shapes that must never match are asserted here rather than trusted.
 */
{
  console.log('');
  console.log('staged submissions');

  const processor = fs.readFileSync('scripts/process-submission.mjs', 'utf8');
  const endpoint = fs.readFileSync('functions/api/submit.js', 'utf8');
  const route = fs.readFileSync('functions/api/submission/[id].js', 'utf8');

  // The live pattern, lifted from the source so a change there reaches here.
  const pointerSrc = processor.match(/\/\^Stored order:[^\n]*?\/m,/);
  if (!pointerSrc) {
    failures++;
    console.log('  FAIL  could not find the staged-order pointer pattern in the processor');
  } else {
    const POINTER = new RegExp(
      pointerSrc[0].replace(/^\//, '').replace(/\/m,$/, ''),
      'm',
    );
    const key = 'a'.repeat(32);
    const good = `Stored order: https://volobg3.com/api/submission/${key}`;
    const hostile = [
      ['another host', `Stored order: https://evil.example.com/api/submission/${key}`],
      ['a lookalike domain', `Stored order: https://volobg3.com.evil.example/api/submission/${key}`],
      ['path traversal', 'Stored order: https://volobg3.com/api/submission/../../etc/passwd'],
      ['a mention rather than a pointer', `See https://volobg3.com/api/submission/${key} for the order`],
      ['plain http', `Stored order: http://volobg3.com/api/submission/${key}`],
    ];

    const accepted = POINTER.test(good);
    const leaked = hostile.filter(([, line]) => POINTER.test(line));
    if (accepted && !leaked.length) {
      console.log(`  ok    the pointer accepts its own URL and rejects ${hostile.length} hostile shapes`);
    } else {
      failures++;
      if (!accepted) console.log('  FAIL  the pointer pattern rejects a URL the endpoint itself writes');
      for (const [what] of leaked) console.log(`  FAIL  the pointer pattern accepts ${what}`);
    }
  }

  // A truncated fetch still parses, and a short order looks like a small one.
  if (processor.includes('expectedEntries') && processor.includes('staged order looks truncated')) {
    console.log('  ok    a staged order short of its recorded entry count is refused');
  } else {
    failures++;
    console.log('  FAIL  nothing checks a staged order against its recorded entry count');
  }

  /*
   * That count must be of rows, not of mods. The endpoint counts rows, and the
   * parser drops separators and engine modules, so comparing one to the other
   * refused a real 958 entry order whose checksum matched exactly, on the
   * grounds that only 839 of its rows were mods.
   */
  if (processor.includes('staged.rawEntries < staged.expectedEntries')
    && !/result\.mods\.length\s*<\s*staged\.expectedEntries/.test(processor)) {
    console.log('  ok    the truncation check counts rows, the same quantity the endpoint sent');
  } else {
    failures++;
    console.log('  FAIL  the truncation check compares parsed mods against submitted rows');
  }

  // And a checksum that matched has already answered the question.
  if (processor.includes('!staged.digestVerified')) {
    console.log('  ok    a verified checksum skips the weaker row count entirely');
  } else {
    failures++;
    console.log('  FAIL  the row count can still overrule a checksum that matched');
  }

  /*
   * The reason the two counts differ, stated as a fact about the parser rather
   * than a comment: an order made mostly of hand-written section headers must
   * parse to far fewer mods than it has rows.
   */
  {
    const rows = [
      { UUID: '', Name: '================|            Libraries            |================' },
      { UUID: '', Name: 'CommunityLibrary' },
      { UUID: '', Name: '================|            UI            |================' },
      { UUID: '', Name: 'ImpUI (ImprovedUI)' },
      { UUID: '', Name: 'Better Topbar' },
    ];
    const parsedRows = parseLoadOrder(JSON.stringify({ Order: rows }), 'headers.json');
    if (parsedRows.mods.length < rows.length) {
      console.log(`  ok    section headers are not mods (${rows.length} rows read as ${parsedRows.mods.length})`);
    } else {
      failures++;
      console.log('  FAIL  section headers counted as mods, so the two counts cannot diverge');
    }
  }

  if (processor.includes('does not match the checksum')) {
    console.log('  ok    a staged order is checked against the checksum recorded at submission');
  } else {
    failures++;
    console.log('  FAIL  nothing checks the staged order checksum');
  }

  /*
   * Intake must not decide the format on the submitter's behalf.
   *
   * It passed 'submission.json' for every candidate, and the parser reads the
   * extension before the content, so every paste went down the JSON branch and
   * the TSV, CSV and plain-name branches could never be reached from an issue.
   * A real 539 mod TSV export was rejected as "Not valid JSON" while the same
   * bytes parse cleanly under an honest name. The formats are checked here
   * against the parser rather than against the intake, because the bug was
   * that the two had quietly stopped agreeing.
   */
  {
    const shapes = [
      ['TSV', 'Index\tName\tAuthor\tFileName\n0\tAlpha\tsomeone\tAlpha 11111111-1111-1111-1111-111111111111.pak\n'
        + '1\tBravo\tsomeone\tBravo 22222222-2222-2222-2222-222222222222.pak\n'
        + '2\tCharlie\tsomeone\tCharlie 33333333-3333-3333-3333-333333333333.pak\n'
        + '3\tDelta\tsomeone\tDelta 44444444-4444-4444-4444-444444444444.pak\n'
        + '4\tEcho\tsomeone\tEcho 55555555-5555-5555-5555-555555555555.pak\n'],
      ['JSON', JSON.stringify({ Order: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map(n => ({ UUID: '', Name: n })) })],
    ];
    const unread = shapes.filter(([, text]) => parseLoadOrder(text, '').mods.length < 5);
    if (!unread.length) {
      console.log(`  ok    intake reads ${shapes.length} formats without being told which`);
    } else {
      failures++;
      for (const [label] of unread) console.log(`  FAIL  a pasted ${label} order cannot be read`);
    }

    if (!/parseLoadOrder\(\s*text\s*,\s*'[^']*\.[a-z]+'/.test(processor)) {
      console.log('  ok    intake does not invent a file extension for what it was given');
    } else {
      failures++;
      console.log('  FAIL  intake names every candidate for one format, which hides the others');
    }

    /*
     * And what it files has to wear the right extension. A TSV saved as .json
     * was refused by the repository audit for not being JSON, and would have
     * been unreadable to every script that reads the corpus back, since they
     * all hand the parser the file's own name.
     */
    const formats = ['TSV', 'CSV', 'Plain text', 'BG3 modsettings.lsx'];
    const unnamed = formats.filter(f => !processor.includes(`'${f}'`) && !processor.includes(`${f}:`));
    if (!unnamed.length) {
      console.log(`  ok    every non-JSON format has a corpus extension of its own`);
    } else {
      failures++;
      console.log(`  FAIL  no corpus extension for: ${unnamed.join(', ')}`);
    }
  }

  /*
   * The excerpt in a staged issue body must not be parseable as an order.
   * Intake tries every candidate until one parses, so a JSON-shaped excerpt
   * would win and land a handful of mods as somebody's whole load order.
   */
  if (endpoint.includes('First entries:') && !endpoint.includes("'```json',\n      trimmed")) {
    console.log('  ok    the staged excerpt is prose, so it cannot parse as the order');
  } else {
    failures++;
    console.log('  FAIL  the staged issue body inlines the order as JSON as well as staging it');
  }

  // The read route is the only way out of the bucket, so it must be narrow.
  if (/\^\[0-9a-f\]\{32\}\$/.test(route) && route.includes('env.SUBMISSIONS')) {
    console.log('  ok    the read route serves one key shape and nothing else');
  } else {
    failures++;
    console.log('  FAIL  the read route does not constrain the key it will look up');
  }

  // Staging happens after scrubbing, or the bucket holds what the issue never would.
  const stagesScrubbed = endpoint.indexOf('SUBMISSIONS.put') > endpoint.indexOf('const order = typeof rawOrder');
  if (stagesScrubbed) {
    console.log('  ok    what reaches storage is the scrubbed order');
  } else {
    failures++;
    console.log('  FAIL  the order is staged before it is scrubbed');
  }
}

/**
 * A mod renamed since somebody's last update still has to be recognised.
 *
 * The corpus holds both names, because everyone who has not updated goes on
 * listing the old one, but only the most frequent reached the masterlist. UUID
 * covers most of that, which is why it never showed; a thin export carries no
 * UUID, and that is exactly when the name is all there is.
 *
 * The alias must never displace a real name. 64 of the corpus's alternates are
 * also some mod's canonical name, so the rule is that canonical always wins its
 * own key and aliases only fill gaps.
 */
{
  console.log('');
  console.log('Alternate names');

  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const canonical = new Set(masterlist.plugins.map(p => norm(p.name)).filter(Boolean));
  const withAlias = masterlist.plugins.filter(p => p.alternateNames?.length);

  const gapFilling = withAlias.flatMap(p =>
    p.alternateNames.filter(a => norm(a) && !canonical.has(norm(a))).map(a => ({ p, a })));

  if (gapFilling.length) {
    console.log(`  ok    ${gapFilling.length} alternate name(s) reach a mod no canonical name reaches`);
  } else {
    failures++;
    console.log('  FAIL  no alternate names are published');
  }

  /* An order listing a mod by its old name, with no uuid, as a thin export gives. */
  const { p, a } = gapFilling[0];
  const sorted = sortLoadOrder([{ uuid: '', name: a, originalIndex: 0 }], masterlist);
  const placed = sorted.placements.values().next().value;
  if (placed && placed.group === p.group) {
    console.log(`  ok    "${a}" resolves to ${p.group}, the group of "${p.name}"`);
  } else {
    failures++;
    console.log(`  FAIL  "${a}" did not resolve to "${p.name}" (${placed?.group ?? 'nothing'})`);
  }

  /* And a name a mod really publishes under still answers for that mod. */
  const shadowed = withAlias.flatMap(p2 =>
    (p2.alternateNames ?? []).filter(a2 => canonical.has(norm(a2))));
  const victim = masterlist.plugins.find(p2 => shadowed.some(a2 => norm(a2) === norm(p2.name)));
  if (!victim) {
    console.log('  ok    no alternate name collides with a canonical one');
  } else {
    const out = sortLoadOrder([{ uuid: '', name: victim.name, originalIndex: 0 }], masterlist);
    const got = out.placements.values().next().value;
    if (got && got.group === victim.group) {
      console.log(`  ok    "${victim.name}" still answers for itself, not for an alias`);
    } else {
      failures++;
      console.log(`  FAIL  an alias displaced the real "${victim.name}"`);
    }
  }
}

/**
 * The two XML readers must decode the same escapes.
 *
 * modsettings.lsx is read twice in this project: by the parser for the browser,
 * and by the miner for the corpus. The parser decoded the five named entities
 * and both numeric forms; the miner decoded only the named ones. A mod called
 * `Tav&#39;s Hair` therefore reached the miner with the escape intact and the
 * browser without, and the two disagreed about the mod's name, which is what
 * every name lookup and the `name:` fallback identity are built on.
 *
 * Compared by running the real thing through the parser and asserting the
 * miner's source carries the same rules, because the miner is a script rather
 * than a module and importing it would run a full mine.
 */
{
  console.log('');
  console.log('XML entity decoding');

  const lsx = (name) => `<?xml version="1.0" encoding="UTF-8"?>
<save><region id="ModuleSettings"><node id="Mods"><children>
<node id="ModuleShortDesc">
  <attribute id="Name" type="LSString" value="${name}"/>
  <attribute id="UUID" type="FixedString" value="11111111-2222-3333-4444-555555555555"/>
  <attribute id="Folder" type="LSString" value="EntityTest"/>
</node>
</children></node></region></save>`;

  const parsed = parseLoadOrder(lsx('Tav&#39;s &#x48;air &amp; Halos'), 'entities.lsx');
  const got = parsed.mods[0]?.name;
  if (got === "Tav's Hair & Halos") {
    console.log('  ok    the parser decodes named, decimal and hex escapes');
  } else {
    failures++;
    console.log(`  FAIL  the parser read the name as ${JSON.stringify(got)}`);
  }

  const miner = fs.readFileSync('scripts/mine-corpus.mjs', 'utf8');
  const hasNumeric = miner.includes('&#x([0-9a-fA-F]+);') && miner.includes('&#(\\d+);')
    && miner.includes('fromCodePoint');
  if (hasNumeric) {
    console.log('  ok    the miner decodes the same escapes as the parser');
  } else {
    failures++;
    console.log('  FAIL  the miner does not decode numeric character references');
  }
}

/**
 * An export is free to write a UUID in either case, and it must not matter.
 *
 * A UUID is hexadecimal and case carries no meaning, but identity here is an
 * exact string match. The filename reader lower-cased what it extracted while
 * the UUID field was taken as written, so the two halves of the identity path
 * disagreed whenever an exporter chose upper-case. Nothing in the corpus does,
 * which is exactly why it went unnoticed: the failure needs one new exporter and
 * takes the whole file with it when it arrives.
 *
 * Asserted on a real order rather than a fixture, because the fixture would have
 * been written by someone who already knew the answer.
 */
{
  console.log('');
  console.log('UUID case');

  const corpus = 'Load Orders - Public Submitted';
  const sample = fs.readdirSync(corpus)
    .filter(f => f.endsWith('.json') && f !== 'provenance.json')
    .sort((a, b) => fs.statSync(path.join(corpus, b)).size - fs.statSync(path.join(corpus, a)).size)[0];

  const raw = fs.readFileSync(path.join(corpus, sample), 'utf8');
  const asWritten = parseLoadOrder(raw, sample);
  const upperCased = parseLoadOrder(
    raw.replace(
      /"UUID"(\s*):(\s*)"([0-9a-fA-F-]{36})"/g,
      (_m, s1, s2, uuid) => `"UUID"${s1}:${s2}"${uuid.toUpperCase()}"`,
    ),
    sample,
  );

  const original = new Set(asWritten.mods.map(m => m.uuid));
  const shared = upperCased.mods.filter(m => original.has(m.uuid)).length;

  if (asWritten.mods.length && shared === asWritten.mods.length) {
    console.log(`  ok    an upper-cased export resolves to the same ${shared} identities`);
  } else {
    failures++;
    console.log(
      `  FAIL  upper-casing the UUIDs in ${sample} splits `
      + `${asWritten.mods.length - shared} of ${asWritten.mods.length} identities`,
    );
  }
}

/**
 * A reviewed order lands by the same path a clean one does.
 *
 * Merging a submission branch instead produces a commit carrying an order the
 * README does not describe, because the branch carries only the corpus file.
 * That commit fails its own checks permanently, and the same failure fires on
 * the pull request, so red meant nothing while somebody was deciding whether to
 * merge it. Approving on the issue replays the order through the direct path,
 * which commits the order and everything derived from it together.
 *
 * Asserted against the source because the alternative is noticing the next time
 * three merges go red.
 */
{
  console.log('');
  console.log('Reviewed submissions');

  const processor = fs.readFileSync('scripts/process-submission.mjs', 'utf8');
  const workflow = fs.readFileSync('.github/workflows/process-submission.yml', 'utf8');

  const checks = [
    [
      /*
       * Labels used to be interpolated from the event payload as JSON. They now
       * come from a file the run writes after reading the issue by number,
       * because a dispatched run has no payload at all. Both halves still
       * matter: the gate has to receive them, and they must not be pasted into
       * the command, where a label carrying a quote could end it.
       */
      'the issue labels reach the gate',
      workflow.includes('--labels')
        && /jq -c '\[\.labels\[\]\.name\]'/.test(workflow)
        && /LABELS="\$\(cat \/tmp\/issue-labels\.json\)"/.test(workflow)
        && !/LABELS:\s*\$\{\{/.test(workflow),
    ],
    [
      /*
       * A label toggled by the workflow token starts nothing, so the replay net
       * has to ask for a run rather than nudge an issue.
       */
      'the replay net dispatches rather than toggling a label',
      (() => {
        const net = fs.readFileSync('.github/workflows/replay-stranded.yml', 'utf8');
        return /workflow_dispatch:\s*\n\s*inputs:\s*\n\s*issue:/.test(workflow)
          && net.includes('gh workflow run process-submission.yml')
          && !/--(add|remove)-label load-order-submission/.test(net);
      })(),
    ],
    [
      'approval overrides the hold',
      /const autoMerge = metricHeld \|\| reviewApproved;/.test(processor),
    ],
    /*
     * One gate for both kinds of order. A broken order adds presence and the
     * section headers its submitter wrote, and never adds sequence, because
     * workingPositions is built from working orders alone. Holding it for a
     * person did not make anybody read the diagnosis, which is posted to the
     * issue regardless; it only meant the corpus waited on somebody being
     * available.
     */
    [
      'a broken order is not held merely for being broken',
      !processor.includes('a broken order needs a human read')
        && !/const autoMerge = .*\bworking &&/.test(processor),
    ],
    [
      'approval does not override validation',
      workflow.includes("steps.process.outputs.accepted == 'yes' && steps.process.outputs.automerge == 'true'"),
    ],
    /*
     * A held order waits on its issue, not on a branch. The corpus-only pull
     * request it used to get carried an order the README did not describe, so
     * its checks failed on it and the red mark meant nothing at the moment
     * somebody was deciding whether to accept. Approval replays from the issue
     * body, so the branch never reached main and was only ever a copy waiting to
     * be discarded.
     */
    [
      'a held order does not open a pull request',
      !workflow.includes('gh pr create') && workflow.includes('--add-label held-for-review'),
    ],
    /*
     * The already-landed guard has to look at the order, not at whatever git
     * happens to list first. Intake stages provenance.json alongside the order,
     * and byte-sorted paths put `working_` after it and `not_working_` before
     * it, so on exactly the orders that land automatically the guard asked
     * whether provenance.json was on main. It always is, so a failed apply was
     * reported as landed and the submitter was thanked for nothing. Issue #67
     * is the one that was lost.
     */
    /*
     * Approval is spent when it lands something. The label sits on an issue, an
     * issue can be edited afterwards, and intake replays on `edited`, so an
     * approval left in place approves whatever the body says next.
     */
    [
      'the labels an order carried are cleared once it lands',
      workflow.includes('for label in approved held-for-review'),
    ],
    /*
     * And clearing them cannot hang off the step that closes the issue. A bare
     * `if:` means `success() && ...`, so a failed comment would leave `approved`
     * in place, and intake replays on `edited`: the next edit would then land
     * unread on an approval given for something else.
     */
    [
      'the labels are cleared even if closing the issue fails',
      /if: always\(\) && steps\.land\.outputs\.landed == 'yes'/.test(workflow),
    ],
    [
      'the already-landed guard tests the order file',
      workflow.includes("grep -v '/provenance\\.json$'")
        && !workflow.includes('order=$(git diff --cached --name-only | head -1)'),
    ],
    /*
     * And that guard compares filenames, so both runs one submission starts
     * have to compute the same one. The name carries a date, and the date used
     * to come from the runner's clock: issue #134 arrived at 23:58 UTC, the
     * first run stamped it the 27th, the concurrency group held the second
     * until 00:29 and it stamped the 28th, so the guard compared two different
     * names and the corpus took a byte-identical second copy. The date comes
     * from the issue now. Dropping the flag does not fail anything at runtime,
     * because intake falls back to the clock, which is why it is checked here.
     */
    [
      'the filename date comes from the issue, not the runner clock',
      workflow.includes('--json body,labels,state,createdAt')
        && /--created "\$\{\{ steps\.subject\.outputs\.created \}\}"/.test(workflow)
        && fs.readFileSync('scripts/process-submission.mjs', 'utf8').includes("opt('created')"),
    ],
    /*
     * A placement report is answered, never closed. It reaches intake because
     * it carries an order somebody played on, which is worth having, and the
     * report is a separate claim about one mod that nothing in this workflow
     * reads. Issue #135 was closed with a receipt for the attachment while the
     * placement it reported stayed wrong, and it was the first report ever to
     * reach this branch: the earlier ones did not say they had been played on,
     * so they failed the gate, stayed open, and a person answered them.
     */
    [
      'a placement report is not closed by landing its order',
      /placement != 'true'/.test(workflow)
        && /placement == 'true'/.test(workflow)
        && workflow.includes("any(.labels[].name; . == \"wrong-placement\")"),
    ],
  ];

  for (const [what, held] of checks) {
    if (held) {
      console.log(`  ok    ${what}`);
    } else {
      failures++;
      console.log(`  FAIL  ${what}`);
    }
  }
}

/**
 * The caution means the same thing wherever it is counted.
 *
 * The browser warns about mods seen in two or more broken orders and never in a
 * working one, answered by a same-name row that does have working installs. The
 * submission report quoted a different rule: any mod seen once in a broken order
 * and never in a working one. So a submitter was told 466 while the site warned
 * about 28, and the larger figure was the one in the message people read.
 *
 * Asserted against the source, because the report is produced inside a workflow
 * run against a masterlist that does not exist yet at test time.
 */
{
  console.log('');
  console.log('Caution definition');

  const processor = fs.readFileSync('scripts/process-submission.mjs', 'utf8');
  const browser = fs.readFileSync('client/src/lib/optimiser.ts', 'utf8');

  const barOf = src => (src.match(/CAUTION_MIN_BROKEN_ORDERS\s*=\s*(\d+)/) ?? [])[1];
  const inBrowser = barOf(browser);
  const inReport = barOf(processor);

  if (inBrowser && inReport && inBrowser === inReport) {
    console.log(`  ok    both count a caution at ${inBrowser} or more broken orders`);
  } else {
    failures++;
    console.log(`  FAIL  the browser uses ${inBrowser ?? 'no'} and the report uses ${inReport ?? 'no'} threshold`);
  }

  /* Both must also let a working same-name row answer the caution. */
  const answered = src => /verifiedNames/.test(src);
  if (answered(browser) && answered(processor)) {
    console.log('  ok    a working same-name row answers it on both sides');
  } else {
    failures++;
    console.log('  FAIL  only one side lets a same-name row answer the caution');
  }
}

/**
 * A load order an author published for their own mods is honoured exactly.
 *
 * This is the only ordering evidence in the project that somebody stated rather
 * than something inferred from what players happened to do, and it is the one
 * kind a group-based sort will quietly override: the Valkrana set spans
 * Resources, Classes, Equipment and Miscellaneous, so the divider skeleton
 * interleaves it with everything else on those shelves and lands the author's
 * twelfth entry ahead of their fifth.
 *
 * Fed in reversed, so passing cannot be an accident of the input already being
 * right.
 */
{
  console.log('');
  console.log('Published load orders');

  const rules = JSON.parse(fs.readFileSync('masterlist/curated-rules.json', 'utf8'));
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const byAnyName = new Map();
  for (const p of masterlist.plugins) {
    const k = norm(p.name);
    if (k && !byAnyName.has(k)) byAnyName.set(k, p);
  }
  for (const p of masterlist.plugins) {
    for (const a of p.alternateNames ?? []) {
      const k = norm(a);
      if (k && !byAnyName.has(k)) byAnyName.set(k, p);
    }
  }

  let checked = 0, violations = 0, cycles = 0;
  for (const seq of rules.sequences ?? []) {
    const rows = seq.order.map(n => byAnyName.get(norm(n))).filter(Boolean);
    if (rows.length < 2) continue;
    checked++;

    const input = [...rows].reverse().map((p, i) => ({ uuid: p.uuid, name: p.name, originalIndex: i }));
    const out = sortLoadOrder(input, masterlist);
    const at = new Map(out.mods.map((m, i) => [m.uuid, i]));
    cycles += out.issues.filter(i => i.kind === 'cycle').length;

    for (let i = 0; i < rows.length - 1; i++) {
      const a = at.get(rows[i].uuid); const b = at.get(rows[i + 1].uuid);
      if (a === undefined || b === undefined) continue;
      if (a > b) {
        violations++;
        console.log(`  FAIL  ${rows[i].name} should load before ${rows[i + 1].name}`);
      }
    }
  }

  if (!checked) {
    console.log('  ok    no published orderings to check');
  } else if (!violations && !cycles) {
    console.log(`  ok    ${checked} published ordering(s) honoured exactly, no cycles`);
  } else {
    failures++;
    if (cycles) console.log(`  FAIL  ${cycles} cycle(s) introduced by a published ordering`);
  }
}

/**
 * uuid is the key everything joins on, so it has to be unique.
 *
 * JSON Schema cannot express uniqueness by property, only whole-item equality,
 * so the published schema can state the guarantee and nothing can validate it.
 * Consumers have been observed breaking ties in opposite directions, which is
 * the failure this prevents: two rows sharing a key means one of them answers
 * for the other, and which one depends on whose loop wrote last.
 */
{
  console.log('');
  console.log('Masterlist keys');

  const counts = new Map();
  for (const p of masterlist.plugins) counts.set(p.uuid, (counts.get(p.uuid) ?? 0) + 1);
  const shared = [...counts.entries()].filter(([, n]) => n > 1);

  if (!shared.length) {
    console.log(`  ok    all ${masterlist.plugins.length} rows carry a distinct uuid`);
  } else {
    failures++;
    console.log(`  FAIL  ${shared.length} uuid(s) are carried by more than one row`);
    for (const [uuid, n] of shared.slice(0, 5)) console.log(`        ${uuid} on ${n} rows`);
  }

  /* And every row has one, since a blank key collides with every other blank. */
  const keyless = masterlist.plugins.filter(p => !p.uuid);
  if (!keyless.length) {
    console.log('  ok    no row is published without a key');
  } else {
    failures++;
    console.log(`  FAIL  ${keyless.length} row(s) have no uuid`);
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
    ['from the author\'s other mods', tier('author-catalogue')],
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

  /*
   * docs/decisions.md quotes the headline result, and until now nothing checked
   * it. sync-figures rewrites it and fails loudly if its pattern stops matching,
   * which catches the prose being reworded but not the file being edited by hand
   * to a number nobody measured. The README half of this test exists because
   * exactly that happened there.
   *
   * Read from measured.json rather than recomputed, because that file is what
   * sync-figures itself writes from: the question is whether the prose agrees
   * with the measurement, not whether the measurement is right.
   */
  const decisions = fs.readFileSync('docs/decisions.md', 'utf8');
  const measured = JSON.parse(fs.readFileSync('client/src/lib/measured.json', 'utf8'));

  /*
   * Matched in the sentence rather than looked for anywhere in the file. A bare
   * substring search passes on any page that happens to contain the digits
   * somewhere, which is not a check, it is a coincidence detector.
   */
  const headline = decisions.match(
    /Current: \*\*([\d.]+) percent held out\*\*, against a ([\d.]+) percent random baseline/,
  );

  if (!headline) {
    failures++;
    console.log('  FAIL  docs/decisions.md no longer states its headline result in the expected form');
  } else {
    const wrong = [
      ['held-out agreement', headline[1], measured.heldOut.toFixed(1)],
      ['random baseline', headline[2], measured.random.toFixed(1)],
    ].filter(([, quoted, actual]) => quoted !== actual);

    if (!wrong.length) {
      console.log('  ok    docs/decisions.md quotes the measured headline figures');
    } else {
      failures++;
      for (const [label, q, a] of wrong) {
        console.log(`  FAIL  docs/decisions.md says ${label} is ${q}, measured ${a}`);
      }
    }
  }
}

fs.rmSync(out, { force: true });
console.log(failures ? `\n${failures} FAILURES\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
