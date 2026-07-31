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

const { parseLoadOrder, sortLoadOrder } = await import(`file://${out}`);
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

  // 3. group order holds wherever dependencies don't force otherwise
  let inversions = 0;
  for (let i = 1; i < result.mods.length; i++) {
    const prev = groupRank.get(result.placements.get(result.mods[i - 1].uuid)?.group) ?? 99;
    const curr = groupRank.get(result.placements.get(result.mods[i].uuid)?.group) ?? 99;
    if (curr < prev) inversions++;
  }
  const forced = result.stats.hardEdges;
  inversions > forced
    ? fail(`${inversions} group inversions, only ${forced} dependency edges to explain them`)
    : ok(`group order holds (${inversions} inversions, ${forced} dependency edges)`);

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

fs.rmSync(out, { force: true });
console.log(failures ? `\n${failures} FAILURES\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
