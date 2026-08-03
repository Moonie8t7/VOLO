/**
 * The load order optimiser.
 *
 * Groups define the broad shape of the order. Dependencies declared in mod
 * metadata are hard constraints. Anything not covered by either stays where the
 * user put it.
 *
 * This is Kahn's algorithm over the dependency graph, with the ready set ordered
 * by group rank then original position. That ordering gives three properties:
 *
 *   1. Declared dependencies are never violated, because they are graph edges.
 *   2. Group order is honoured wherever dependencies allow.
 *   3. Mods move as little as possible. Reshuffling a working load order without
 *      cause destroys the user's trust in the result.
 *
 * Runs in O(V + E). Materialising group relations as pairwise edges would be
 * O(n^2) and is not needed.
 */

import type {
  Mod, Masterlist, MasterlistPlugin, SortResult, Placement, Reason, Issue, GroupName,
} from './types';

const DEFAULT_GROUP = 'unsorted';

/**
 * Fallback categorisation for mods the masterlist has not seen. Group names
 * must match the masterlist's group vocabulary exactly: an unknown name ranks
 * as nothing and silently sorts to the end of the order.
 */
const NAME_PATTERNS: [RegExp, GroupName][] = [
  [/script\s*extender|native\s*mod\s*loader|^bg3se|mod\s*fixer/i, 'Utilities'],
  [/improvedui|^impui|hotbar|tooltip|sidebar|\bui\b|interface|topbar|context menu/i, 'User Interface'],
  [/communitylibrary|community\s*library|volitioncabinet|material\s*library|modders?\s*resource|compatibility\s*framework|mod\s*configuration\s*menu|^bg3mcm|framework\b/i, 'Resources'],
  [/\bspell|cantrip|\bmagic\b/i, 'Spells'],
  [/subclass|\bclass\b|\bfeat\b|deit(y|ies)/i, 'Classes'],
  [/\brace\b|subrace/i, 'Races'],
  [/hair|beard/i, 'Hair'],
  [/\bheads?\b|\beyes?\b|\bface\b/i, 'Heads'],
  [/\bbod(y|ies)\b|skin\s*tone/i, 'Bodies'],
  [/tattoo|makeup|preset|character\s*creat/i, 'Character Customization'],
  [/\bdyes?\b/i, 'Dyes'],
  [/outfit|clothing|clothes|camp\s*(clothes|outfit)/i, 'Clothing'],
  [/armou?r/i, 'Armor'],
  [/weapon|sword|blade|\bbow\b|dagger/i, 'Weapons'],
  [/jewel|amulet|\brings?\b|cloak|earring/i, 'Accessories'],
  [/equipment|\bgear\b|container/i, 'Equipment'],
  [/companion|astarion|shadowheart|karlach|\bgale\b|wyll|lae.?zel/i, 'Companions'],
  [/\bnpcs?\b/i, 'NPC'],
  [/\bquests?\b/i, 'Quests'],
  [/animation/i, 'Animations'],
  [/\bdice\b/i, 'Dice'],
  [/audio|sound|music|voice/i, 'Audio'],
  [/texture|colou?rs?\b|vfx|visual/i, 'Visuals'],
  [/\bpatch(es)?\b|compatibility|\bfix(es)?\b|hotfix/i, 'Bug Fixes'],
];

/**
 * Rank groups from their `after` relations rather than array order, so that
 * reordering the masterlist by hand cannot silently change how mods sort.
 */
function rankGroups(masterlist: Masterlist): Map<GroupName, number> {
  const groups = masterlist.groups ?? [];
  const byName = new Map(groups.map(g => [g.name, g]));
  const rank = new Map<GroupName, number>();
  const visiting = new Set<GroupName>();
  let next = 0;

  const visit = (name: GroupName) => {
    if (rank.has(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const dep of byName.get(name)?.after ?? []) visit(dep);
    visiting.delete(name);
    rank.set(name, next++);
  };

  for (const g of groups) visit(g.name);
  rank.set(DEFAULT_GROUP, rank.get(DEFAULT_GROUP) ?? next);
  return rank;
}

/** Index the masterlist for lookup by UUID first, then by normalised name. */
function indexMasterlist(masterlist: Masterlist) {
  const byUuid = new Map<string, MasterlistPlugin>();
  const byName = new Map<string, MasterlistPlugin>();
  for (const p of masterlist.plugins ?? []) {
    if (p.uuid) byUuid.set(p.uuid, p);
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key && !byName.has(key)) byName.set(key, p);
  }
  return { byUuid, byName };
}

export function sortLoadOrder(mods: Mod[], masterlist: Masterlist): SortResult {
  const rank = rankGroups(masterlist);
  const { byUuid, byName } = indexMasterlist(masterlist);
  const issues: Issue[] = [];

  // Step 1: assign a group to every mod.
  const group = new Map<string, GroupName>();
  const groupSource = new Map<string, Placement['groupSource']>();
  const confidence = new Map<string, number>();
  let known = 0;

  for (const mod of mods) {
    const entry =
      byUuid.get(mod.uuid) ??
      byName.get(mod.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

    if (entry && entry.group !== DEFAULT_GROUP) {
      group.set(mod.uuid, entry.group);
      if (entry.evidence?.source === 'inferred') {
        groupSource.set(mod.uuid, 'inferred');
        if (entry.evidence.confidence) confidence.set(mod.uuid, entry.evidence.confidence);
      } else {
        groupSource.set(mod.uuid, 'masterlist');
      }
      known++;
      continue;
    }
    if (entry) known++;

    const guessed = NAME_PATTERNS.find(([re]) => re.test(mod.name))?.[1];
    group.set(mod.uuid, guessed ?? DEFAULT_GROUP);
    groupSource.set(mod.uuid, guessed ? 'name-pattern' : 'default');
  }

  // Step 2: build the dependency graph. An edge from dep to mod means the dep
  // must be emitted first.
  const present = new Map<string, Mod>();
  const byNormName = new Map<string, Mod>();
  for (const m of mods) {
    present.set(m.uuid, m);
    byNormName.set(m.name.toLowerCase().replace(/[^a-z0-9]/g, ''), m);
  }

  const dependents = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  const reasons = new Map<string, Reason[]>();
  let hardEdges = 0;

  for (const m of mods) {
    indegree.set(m.uuid, 0);
    reasons.set(m.uuid, []);
  }

  const missing = new Map<string, string[]>();

  for (const mod of mods) {
    // Masterlist dependencies supplement whatever the export declared.
    const declared = [
      ...(mod.dependencies ?? []),
      ...(byUuid.get(mod.uuid)?.dependencies ?? []),
    ];

    const linked = new Set<string>();
    for (const dep of declared) {
      const target =
        present.get(dep.uuid) ??
        byNormName.get(dep.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (!target) {
        const list = missing.get(dep.name) ?? [];
        list.push(mod.uuid);
        missing.set(dep.name, list);
        continue;
      }
      if (target.uuid === mod.uuid || linked.has(target.uuid)) continue;
      linked.add(target.uuid);

      if (!dependents.has(target.uuid)) dependents.set(target.uuid, new Set());
      dependents.get(target.uuid)!.add(mod.uuid);
      indegree.set(mod.uuid, (indegree.get(mod.uuid) ?? 0) + 1);
      hardEdges++;

      reasons.get(mod.uuid)!.push({
        kind: 'dependency',
        text: `Requires ${target.name}, so it must load after it.`,
        relatedUuid: target.uuid,
      });
    }
  }

  for (const [depName, wanters] of missing) {
    issues.push({
      severity: 'critical',
      kind: 'missing-dependency',
      message:
        `${wanters.length} mod${wanters.length > 1 ? 's require' : ' requires'} ` +
        `"${depName}", which is not in your load order.`,
      uuids: wanters,
      resolution: `Install ${depName}, or remove the mods that depend on it.`,
    });
  }

  // Step 3: Kahn's algorithm, ready set ordered by group rank then original index.
  const rankOf = (m: Mod) =>
    rank.get(group.get(m.uuid) ?? DEFAULT_GROUP) ?? Number.MAX_SAFE_INTEGER;
  const before = (a: Mod, b: Mod) =>
    rankOf(a) - rankOf(b) || a.originalIndex - b.originalIndex;

  const ready = mods.filter(m => (indegree.get(m.uuid) ?? 0) === 0).sort(before);
  const sorted: Mod[] = [];

  while (ready.length) {
    const mod = ready.shift()!;
    sorted.push(mod);

    for (const dependentUuid of dependents.get(mod.uuid) ?? []) {
      const remaining = (indegree.get(dependentUuid) ?? 1) - 1;
      indegree.set(dependentUuid, remaining);
      if (remaining === 0) {
        const dependent = present.get(dependentUuid);
        if (!dependent) continue;
        // Binary insert rather than push and re-sort, to keep the ready set
        // ordered without an O(n log n) sort on every iteration.
        let lo = 0, hi = ready.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (before(ready[mid], dependent) <= 0) lo = mid + 1; else hi = mid;
        }
        ready.splice(lo, 0, dependent);
      }
    }
  }

  // Step 4: anything left unemitted is part of a dependency cycle.
  if (sorted.length < mods.length) {
    const stuck = mods.filter(m => !sorted.includes(m));
    const names = stuck.slice(0, 5).map(m => m.name).join(', ');
    issues.push({
      severity: 'critical',
      kind: 'cycle',
      message:
        `${stuck.length} mods form a circular dependency and cannot be ordered: ` +
        names + (stuck.length > 5 ? `, and ${stuck.length - 5} more` : ''),
      uuids: stuck.map(m => m.uuid),
      resolution:
        'One of these dependencies is wrong. Check the mod pages, then report it ' +
        'so the masterlist can be corrected.',
    });
    // Append them in original order so the user still gets a usable list.
    sorted.push(...stuck.sort((a, b) => a.originalIndex - b.originalIndex));
  }

  // Step 5: record placements and statistics.
  const placements = new Map<string, Placement>();
  let moved = 0;

  sorted.forEach((mod, position) => {
    const g = group.get(mod.uuid) ?? DEFAULT_GROUP;
    const src = groupSource.get(mod.uuid) ?? 'default';
    const conf = confidence.get(mod.uuid);
    const rs = reasons.get(mod.uuid) ?? [];
    rs.unshift({
      kind: 'group',
      text:
        g === DEFAULT_GROUP
          ? 'Not yet categorised by the community, so it stayed in its original position.'
          : src === 'inferred'
            ? `Categorised as "${g}" from where it sits in submitted load orders` +
              (conf ? `, with ${Math.round(conf * 100)} percent of its neighbours agreeing.` : '.')
            : `Categorised as "${g}", which loads in that part of the order.`,
    });
    if (position !== mod.originalIndex) moved++;
    placements.set(mod.uuid, {
      uuid: mod.uuid,
      position,
      group: g,
      groupSource: src,
      groupConfidence: conf,
      reasons: rs,
      movedBy: position - mod.originalIndex,
    });
  });

  // The Script Extender is a dll, not a pak, so it can never appear in this
  // list; the one useful thing a sorter can do is say how much of the order
  // depends on it being installed.
  const seMods = sorted.filter(m => {
    if (m.featureFlags?.length) return true;
    const entry = byUuid.get(m.uuid) ??
      byName.get(m.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return Boolean(entry?.usesScriptExtender);
  });
  if (seMods.length) {
    issues.push({
      severity: 'info',
      kind: 'script-extender',
      message:
        `${seMods.length} mod${seMods.length > 1 ? 's' : ''} in this order rel` +
        `${seMods.length > 1 ? 'y' : 'ies'} on the Script Extender, which is ` +
        'installed separately and never appears in a load order.',
      uuids: seMods.map(m => m.uuid),
      resolution:
        'Make sure BG3SE is installed before playing, or these mods will not work.',
    });
  }

  const unsortedMods = sorted.filter(m => group.get(m.uuid) === DEFAULT_GROUP);
  if (unsortedMods.length) {
    issues.push({
      severity: 'info',
      kind: 'unsorted',
      message:
        `${unsortedMods.length} mods are not in the masterlist yet, ` +
        'so VOLO left them where they were.',
      uuids: unsortedMods.map(m => m.uuid),
      resolution: 'Know where these belong? Contribute a category to help everyone.',
    });
  }

  return {
    mods: sorted,
    placements,
    issues,
    stats: {
      total: mods.length,
      moved,
      knownToMasterlist: known,
      hardEdges,
      unsorted: unsortedMods.length,
    },
  };
}
