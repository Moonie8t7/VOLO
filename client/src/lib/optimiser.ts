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

import dividers from './dividers.json';
import type {
  Mod, Masterlist, MasterlistPlugin, SortResult, Placement, Reason, Issue, GroupName,
  ExternalListing,
} from './types';

const DEFAULT_GROUP = 'unsorted';

/**
 * Last-resort classification for mods the masterlist has never seen.
 *
 * Each entry names the exact divider slot the mod belongs on, and its group
 * name must match the masterlist vocabulary exactly. A typo'd group does not
 * push the mod to the end, because the slot still places it; it silently
 * loses only the within-slot ranking, which is why the smoke test checks
 * every entry against the group list rather than trusting eyes.
 * The dividers are the skeleton of the order whether or not the divider paks
 * are installed, so a feat mod belongs at 045 Skillset Feats; filing it under
 * "Classes" would land it on the 056 category marker, below every spell.
 *
 * Kept deliberately in step with NAME_PATTERNS in scripts/mine-corpus.mjs.
 * That table classifies the corpus at build time and this one classifies
 * whatever the user imports that the corpus has never seen; if they disagree,
 * the same mod sorts differently depending on how it arrived.
 *
 * First match wins, so the list runs most specific first.
 */
const NAME_PATTERNS: [RegExp, GroupName, number][] = [
  [/script\s*extender|nativemodloader|native mod loader|^bg3se|^mod\s*fixer/i, 'Utilities', 19],
  [/improvedui|^impui/i, 'User Interface', 1],
  [/hotbar|tooltip|sidebar|inventory ui|\bui\b|interface|topbar|context menu/i, 'User Interface', 5],
  [/volitioncabinet|volition\s*cabinet/i, 'Resources', 7],
  [/communitylibrary|community\s*library/i, 'Resources', 8],
  [/materiallibrary|material\s*library/i, 'Resources', 10],
  [/mod configuration menu|^bg3mcm|\bmcm\b/i, 'Resources', 14],
  [/compatibility\s*framework/i, 'Bottom of Load Order', 105],
  [/^lib[A-Z]|modders?\s*resource|framework$|framework\b/i, 'Resources', 15],
  [/waypoint/i, 'Utilities', 18],
  [/encounter|miniboss/i, 'Gameplay', 31],
  [/\bfeats?\b/i, 'Classes', 45],
  [/\babilit(y|ies)\b/i, 'Spells', 46],
  [/summon|familiar/i, 'Spells', 49],
  [/\bspell|cantrip|\bmagic\b/i, 'Spells', 47],
  [/(?=.*subclass)(?=.*barbarian)/i, 'Classes', 58.01],
  [/(?=.*subclass)(?=.*\bbard\b)/i, 'Classes', 58.02],
  [/(?=.*subclass)(?=.*cleric)/i, 'Classes', 58.03],
  [/(?=.*subclass)(?=.*druid)/i, 'Classes', 58.04],
  [/(?=.*subclass)(?=.*fighter)/i, 'Classes', 58.05],
  [/(?=.*subclass)(?=.*\bmonk\b)/i, 'Classes', 58.06],
  [/(?=.*subclass)(?=.*paladin)/i, 'Classes', 58.07],
  [/(?=.*subclass)(?=.*ranger)/i, 'Classes', 58.08],
  [/(?=.*subclass)(?=.*rogue)/i, 'Classes', 58.09],
  [/(?=.*subclass)(?=.*sorcerer)/i, 'Classes', 58.1],
  [/(?=.*subclass)(?=.*warlock)/i, 'Classes', 58.11],
  [/(?=.*subclass)(?=.*wizard)/i, 'Classes', 58.12],
  [/subclass/i, 'Classes', 58],
  [/\bclass(es)?\b|deity|deities/i, 'Classes', 56],
  [/(?=.*subrace)(?=.*half.?orc)/i, 'Races', 53.05],
  [/(?=.*subrace)(?=.*half.?el(f|ves))/i, 'Races', 53.04],
  [/(?=.*subrace)(?=.*dragonborn)/i, 'Races', 53.11],
  [/(?=.*subrace)(?=.*tiefling)/i, 'Races', 53.09],
  [/(?=.*subrace)(?=.*gith)/i, 'Races', 53.1],
  [/(?=.*subrace)(?=.*drow)/i, 'Races', 53.03],
  [/(?=.*subrace)(?=.*(dwarf|dwarves|duergar))/i, 'Races', 53.07],
  [/(?=.*subrace)(?=.*gnome)/i, 'Races', 53.08],
  [/(?=.*subrace)(?=.*halfling)/i, 'Races', 53.06],
  [/(?=.*subrace)(?=.*el(f|ves))/i, 'Races', 53.02],
  [/(?=.*subrace)(?=.*human)/i, 'Races', 53.01],
  [/subraces?/i, 'Races', 53],
  [/tiefling|githyanki|dragonborn|drow\b/i, 'Races', 52],
  [/\braces?\b/i, 'Races', 51],
  [/hair|beard/i, 'Hair', 64],
  [/\bheads?\b|\beyes?\b|\bfaces?\b/i, 'Heads', 63],
  [/\bbod(y|ies)\b|skin\s*tone/i, 'Bodies', 99],
  [/tattoo|makeup|\bscars?\b/i, 'Character Customization', 100],
  [/\bhorns?\b/i, 'Character Customization', 65],
  [/\btails?\b|\bwings?\b/i, 'Character Customization', 66],
  [/piercing/i, 'Character Customization', 67],
  [/preset|character\s*creat/i, 'Character Customization', 61],
  [/\bdyes?\b/i, 'Dyes', 38],
  [/outfit|clothing|clothes|camp\s*(clothes|outfit)/i, 'Clothing', 37],
  [/underwear|lingerie/i, 'Clothing', 41],
  [/armou?r/i, 'Armor', 36],
  [/weapon|\bswords?\b|\bblades?\b|\bbows?\b|dagger/i, 'Weapons', 42],
  [/jewel|amulet|\brings?\b|earring/i, 'Accessories', 40],
  [/cloak/i, 'Accessories', 35],
  [/instrument|\blute\b|\bflute\b/i, 'Equipment', 39],
  [/equipment|\bgear\b|basket.*equipment|container/i, 'Equipment', 43],
  [/astarion/i, 'Companions', 71],
  [/\bgale\b/i, 'Companions', 72],
  [/halsin/i, 'Companions', 73],
  [/jaheira/i, 'Companions', 74],
  [/karlach/i, 'Companions', 75],
  [/lae.?zel/i, 'Companions', 76],
  [/minsc/i, 'Companions', 77],
  [/minthara/i, 'Companions', 78],
  [/shadowheart/i, 'Companions', 79],
  [/\bwyll\b/i, 'Companions', 80],
  [/scratch|owlbear\s*cub/i, 'Companions', 81],
  [/companion/i, 'Companions', 82],
  [/\bnpcs?\b/i, 'NPC', 23],
  [/\bquests?\b/i, 'Quests', 25],
  [/\bposes?\b/i, 'Animations', 86],
  [/animation|\bidles?\b/i, 'Animations', 83],
  [/\bdice\b/i, 'Dice', 90],
  [/audio|sound|music|voice/i, 'Audio', 92],
  [/\bvfx\b|visual/i, 'Visuals', 11],
  [/texture/i, 'Visuals', 10],
  [/colou?rs?\b/i, 'Visuals', 62],
  [/\bpatch(es)?\b|compatibility|\bfix(es)?\b|hotfix/i, 'Bug Fixes', 98],
];

/**
 * A mod name as the patterns need to see it.
 *
 * Authors write "FeatsOverhaul" and "Essential_Feats" as often as "Extra
 * Feats", and a word boundary matches neither of the first two. The mod's real
 * name is never altered, only this throwaway copy used for matching.
 */
function searchableName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ');
}

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

/**
 * The group a divider slot belongs to, for a slot somebody picked by hand.
 *
 * Only the badge and the group tiebreak need it: the slot itself decides where
 * the mod sits. Built by reversing the group-to-slot map, so it answers for
 * every slot a group is mapped to, and falls through for the rest.
 */
const SLOT_GROUPS: Map<number, GroupName> = (() => {
  const byGroup = dividers.byGroup as Record<string, { num: number } | undefined>;
  const out = new Map<number, GroupName>();
  for (const [name, slot] of Object.entries(byGroup)) {
    if (slot && !out.has(slot.num)) out.set(slot.num, name);
  }
  return out;
})();

const groupForSlot = (num: number): GroupName | undefined => SLOT_GROUPS.get(num);

/**
 * Index the masterlist by UUID, then by normalised name, then by folder.
 *
 * The folder index exists because a pak's folder and the name it publishes
 * under are frequently different things, and a declared dependency can name
 * either. Mod Configuration Menu ships in a folder called BG3MCM, so a mod
 * requiring "BG3MCM" matches nothing by name while the mod itself sits in the
 * user's list. Folders are kept in their own map rather than folded into the
 * name index so a folder can never shadow a real name.
 */
function indexMasterlist(masterlist: Masterlist) {
  const byUuid = new Map<string, MasterlistPlugin>();
  const byName = new Map<string, MasterlistPlugin>();
  const byFolder = new Map<string, MasterlistPlugin>();
  for (const p of masterlist.plugins ?? []) {
    if (p.uuid) byUuid.set(p.uuid, p);
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key && !byName.has(key)) byName.set(key, p);
    const folder = (p.folder ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (folder && !byFolder.has(folder)) byFolder.set(folder, p);
  }
  return { byUuid, byName, byFolder };
}

/**
 * Group from the mod's own listing on Nexus or mod.io, or null.
 *
 * Nexus wins when both list the name, matching the miner. The catalogues key
 * by lowercased alphanumeric name, the same normalisation the masterlist
 * name index uses.
 */
function listedGroup(name: string, listing?: ExternalListing | null): GroupName | null {
  if (!listing) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return null;
  // Own properties only: parsed JSON objects still inherit Object.prototype,
  // and a mod named "Constructor" would otherwise read a function out of the
  // table instead of missing cleanly.
  const index = Object.hasOwn(listing.nexus, key) ? listing.nexus[key]
    : Object.hasOwn(listing.modio, key) ? listing.modio[key]
    : undefined;
  const group = index === undefined ? undefined : listing.groups[index];
  return group ?? null;
}

export function sortLoadOrder(
  mods: Mod[],
  masterlist: Masterlist,
  listing?: ExternalListing | null,
  /**
   * Divider slots the user picked for their own mods, by uuid.
   *
   * Outranks everything, including a maintainer's rule, because it is their
   * load order and they are looking at the mod. Kept in the browser and never
   * sent anywhere: a slot chosen here changes this sort and nothing else.
   */
  assigned?: Record<string, number>,
): SortResult {
  const rank = rankGroups(masterlist);
  const { byUuid, byName, byFolder } = indexMasterlist(masterlist);
  /*
   * Own properties only. A parsed JSON object still inherits Object.prototype,
   * so a mod requiring "constructor" would otherwise read a function out of
   * the table and be treated as resolved.
   */
  const rawAliases = masterlist.requirementAliases ?? {};
  const aliases: Record<string, string> = Object.create(null);
  for (const key of Object.keys(rawAliases)) aliases[key] = rawAliases[key];

  const rawSatisfied = masterlist.requirementSatisfiedBy ?? {};
  const satisfiedBy: Record<string, string[]> = Object.create(null);
  for (const key of Object.keys(rawSatisfied)) satisfiedBy[key] = rawSatisfied[key];
  const issues: Issue[] = [];

  // Step 1: assign a group to every mod.
  const group = new Map<string, GroupName>();
  const groupSource = new Map<string, Placement['groupSource']>();
  /** Slot read off the mod's name, for mods the masterlist has never seen. */
  const guessedDivider = new Map<string, number>();
  const confidence = new Map<string, number>();
  const resolvedUuid = new Map<string, string>();
  let known = 0;

  for (const mod of mods) {
    const entry =
      byUuid.get(mod.uuid) ??
      byName.get(mod.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Imports without a UUID column get synthetic name: keys. When the name
    // matches a masterlist entry that knows the real pak UUID, recover it so
    // the export can round-trip into BG3MM. Masterlist entries mined from thin
    // exports carry synthetic keys of their own, and those must never be
    // written into an export as if they were pak UUIDs.
    if (entry?.uuid && !entry.uuid.startsWith('name:') && mod.uuid.startsWith('name:')) {
      resolvedUuid.set(mod.uuid, entry.uuid);
    }

    const mine = assigned?.[mod.uuid];
    if (mine !== undefined) {
      group.set(mod.uuid, groupForSlot(mine) ?? 'Miscellaneous');
      groupSource.set(mod.uuid, 'you');
      guessedDivider.set(mod.uuid, mine);
      known++;
      continue;
    }

    if (entry && entry.group !== DEFAULT_GROUP) {
      group.set(mod.uuid, entry.group);
      if (entry.evidence?.source === 'inferred') {
        groupSource.set(mod.uuid, 'inferred');
        if (entry.evidence.confidence) confidence.set(mod.uuid, entry.evidence.confidence);
      } else if (entry.evidence?.source === 'external-category') {
        // Read off a Nexus or mod.io listing, not from anyone's played order.
        groupSource.set(mod.uuid, 'listing');
      } else if (entry.evidence?.source === 'author-catalogue') {
        // Placed by the author's habit across their other catalogued mods,
        // which is weaker than this mod's own listing and labelled apart.
        groupSource.set(mod.uuid, 'author');
      } else if (entry.evidence?.source === 'name-pattern'
        || entry.evidence?.source === 'divider-vocabulary') {
        // Both are read off the mod's title. A keyword guess must never be
        // indistinguishable from evidence, whichever vocabulary produced it.
        groupSource.set(mod.uuid, 'name-pattern');
      } else if (entry.evidence?.source === 'curated') {
        // A maintainer's hand-written rule, labelled so a reader can tell a
        // person's judgement from a crowd's habit.
        groupSource.set(mod.uuid, 'curated');
      } else {
        groupSource.set(mod.uuid, 'masterlist');
      }
      known++;
      continue;
    }
    if (entry) known++;

    // Same ladder as the miner: an exact slot read off the name first, then
    // the mod's own listing on Nexus or mod.io. The name patterns carry a
    // divider slot, which is finer than the coarse category a listing gives.
    const guessed = NAME_PATTERNS.find(([re]) => re.test(searchableName(mod.name)));
    if (guessed) {
      group.set(mod.uuid, guessed[1]);
      groupSource.set(mod.uuid, 'name-pattern');
      guessedDivider.set(mod.uuid, guessed[2]);
      continue;
    }

    const listed = listedGroup(mod.name, listing);
    group.set(mod.uuid, listed ?? DEFAULT_GROUP);
    groupSource.set(mod.uuid, listed ? 'listing' : 'default');
  }

  // Step 2: build the dependency graph. An edge from dep to mod means the dep
  // must be emitted first.
  const present = new Map<string, Mod>();
  const byNormName = new Map<string, Mod>();
  // The user's own mods by pak folder, for dependencies that name the folder
  // rather than the published title. First writer wins, matching the name
  // index, so an earlier mod is not displaced by a later one sharing a folder.
  const byNormFolder = new Map<string, Mod>();
  for (const m of mods) {
    present.set(m.uuid, m);
    byNormName.set(m.name.toLowerCase().replace(/[^a-z0-9]/g, ''), m);
    const folder = (m.folder ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (folder && !byNormFolder.has(folder)) byNormFolder.set(folder, m);
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
  /** Requirement names the corpus shows most working orders do without. */
  const softRequirements = new Set<string>();

  /**
   * Whether a mod that stands in for a requirement is in the list.
   *
   * By uuid, then by the name and folder the masterlist knows it under. A
   * masterlist entry only ever seen in exports that carried no uuids has a
   * synthetic key rather than a real one, so a uuid comparison alone would
   * miss it for every user whose export does carry uuids.
   */
  const standInPresent = (uuid: string): boolean => {
    if (present.has(uuid)) return true;
    const entry = byUuid.get(uuid);
    if (!entry) return false;
    const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return byNormName.has(key(entry.name))
      || (entry.folder ? byNormFolder.has(key(entry.folder)) : false);
  };

  for (const mod of mods) {
    // Masterlist dependencies supplement whatever the export declared.
    const declared = [
      ...(mod.dependencies ?? []),
      ...(byUuid.get(mod.uuid)?.dependencies ?? []),
    ];

    const linked = new Set<string>();
    for (const dep of declared) {
      const norm = dep.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      /*
       * Five ways to recognise the same mod, because a dependency can name it
       * by any of them and a wrong answer here is the worst thing a critical
       * warning can do: it tells someone a mod is missing while it sits in the
       * list in front of them.
       *
       * The uuid is tried first and is the only exact answer. It fails more
       * often than it should, because a declared uuid is copied by hand into a
       * pak's metadata and goes stale when the dependency is republished.
       *
       * Names fail too. A pak's folder and its published title are separate
       * strings and frequently differ: ImpUI ships as ImpUI_P8_Fork, and Mod
       * Configuration Menu ships in a folder called BG3MCM, so a mod that
       * requires "BG3MCM" matches nothing at all by name. So the folder is
       * tried on both sides, and the masterlist is used as a translation table
       * between the two, in both directions.
       */
      /*
       * A hand-written alias, for the names no string on the mod can match.
       * Mod pages, pak folders and published titles drift apart, and nothing
       * measurable joins "Vlad's Grimoire" to a pak called
       * VFX_Library_VladsGrimoire. Resolved through the masterlist entry it
       * names, so it finds the mod by uuid or by name, whichever the user's
       * export gave us.
       */
      const aliasUuid = aliases[norm];
      const aliased = aliasUuid ? byUuid.get(aliasUuid) : undefined;

      const viaMasterlist = byName.get(norm) ?? byFolder.get(norm) ?? aliased;
      const target =
        (dep.uuid ? present.get(dep.uuid) : undefined) ??
        byNormName.get(norm) ??
        byNormFolder.get(norm) ??
        (viaMasterlist?.uuid ? present.get(viaMasterlist.uuid) : undefined) ??
        (viaMasterlist ? byNormName.get(
          viaMasterlist.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        ) : undefined) ??
        (viaMasterlist?.folder ? byNormFolder.get(
          viaMasterlist.folder.toLowerCase().replace(/[^a-z0-9]/g, ''),
        ) : undefined);

      if (!target) {
        /*
         * Before reporting it missing, two things can still satisfy it.
         *
         * A stand-in is another mod doing the same job: mods asking for
         * TutorialChestSummoning work with AV Item Shipment Framework, and a
         * player running the second was told they were missing the first.
         * Nothing in either mod's metadata connects them, so the pairing is
         * hand-written.
         */
        const required = viaMasterlist ?? (dep.uuid ? byUuid.get(dep.uuid) : undefined);
        const standIns = required ? satisfiedBy[required.uuid] : undefined;
        if (standIns?.some(standInPresent)) continue;

        const list = missing.get(dep.name) ?? [];
        list.push(mod.uuid);
        missing.set(dep.name, list);
        /*
         * How firmly it can be called missing. A requirement absent from most
         * of the working orders that declare it is not one a load order is
         * broken without, and saying so in red was the false alarm people
         * reported. Recorded per name, since one name is reported once however
         * many mods asked for it.
         */
        if (required?.oftenAbsent) softRequirements.add(dep.name);
        continue;
      }
      if (target.uuid === mod.uuid || linked.has(target.uuid)) continue;
      linked.add(target.uuid);

      /*
       * "Requires it" and "loads after it" are different claims, and a pak can
       * only make the first. They agree for a library, which has to be parsed
       * before anything reads it, and disagree for a patcher, which reads the
       * mods it patches and so goes last. Where the working orders say a mod
       * is loaded after the things requiring it, the requirement is satisfied
       * without becoming an ordering edge, and the mod keeps the late slot the
       * corpus gives it. Compatibility Framework is the case that found this:
       * pinned to the last divider, then dragged to the front by five mods
       * declaring it.
       */
      if (byUuid.get(target.uuid)?.loadsAfterDependents) {
        reasons.get(target.uuid)?.push({
          kind: 'dependency',
          text: `${mod.name} requires it, but working orders load it later, so it stays where it is.`,
          relatedUuid: mod.uuid,
        });
        continue;
      }

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
    const soft = softRequirements.has(depName);
    const asks = `${wanters.length} mod${wanters.length > 1 ? 's require' : ' requires'}`;
    issues.push({
      /*
       * Critical means the order is broken without it, which is true of a
       * library and not of a requirement most working orders do without. The
       * second kind was being reported in red alongside the first, and people
       * reasonably read that as the tool being wrong.
       */
      severity: soft ? 'warning' : 'critical',
      kind: 'missing-dependency',
      message: soft
        ? `${asks} "${depName}", which is not in your load order. Most working orders that use these mods do not have it either.`
        : `${asks} "${depName}", which is not in your load order.`,
      uuids: wanters,
      resolution: soft
        ? `Probably optional, or covered by another mod you already have. Install ${depName} if something these mods add is missing in game.`
        : `Install ${depName}, or remove the mods that depend on it.`,
    });
  }

  // Step 3: Kahn's algorithm, ready set ordered by divider then group rank.
  const rankOf = (m: Mod) =>
    rank.get(group.get(m.uuid) ?? DEFAULT_GROUP) ?? Number.MAX_SAFE_INTEGER;

  /*
   * The dividers are the skeleton of the order.
   *
   * Their sequence decides which section a mod lands in, because that taxonomy
   * is a working load order in its own right and it is what players read when
   * they open the list. Inside a section the masterlist decides, falling back
   * to the order the mods arrived in, so nothing moves without a reason.
   *
   * A mod uses the most specific divider known for it: the one it was actually
   * observed under in a submitted order, otherwise the one its group belongs
   * to. A group rank is sortNum, not num: a group mapped to a CATEGORY heading
   * sorts at its Other slot, so a mod known only as "User Interface" cannot
   * outrank ImpUI on its exact slot. Mods with no category at all sit at the
   * end, where the corpus says unplaced mods usually sit.
   */
  const groupDividers = dividers.byGroup as Record<string, { num: number; sortNum?: number } | undefined>;
  const FIRST_DIVIDER = -1;
  const LAST_DIVIDER = 1000;

  const dividerOf = (m: Mod): number => {
    const mine = assigned?.[m.uuid];
    if (mine !== undefined) return mine;
    const entry = byUuid.get(m.uuid)
      ?? byName.get(m.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (entry?.divider !== undefined) return entry.divider;
    const named = guessedDivider.get(m.uuid);
    if (named !== undefined) return named;
    const g = group.get(m.uuid) ?? DEFAULT_GROUP;
    if (g === 'Top of Load Order') return FIRST_DIVIDER;
    if (g === 'Bottom of Load Order' || g === DEFAULT_GROUP) return LAST_DIVIDER;
    const slot = groupDividers[g];
    return slot?.sortNum ?? slot?.num ?? LAST_DIVIDER;
  };

  const before = (a: Mod, b: Mod) =>
    dividerOf(a) - dividerOf(b)
    || rankOf(a) - rankOf(b)
    || a.originalIndex - b.originalIndex;

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
          ? 'Not yet categorised by anyone, so it sits at the end, where the ' +
            'submitted orders put mods nobody has placed.'
          : src === 'inferred'
            ? `Categorised as "${g}" from where it sits in submitted load orders` +
              (conf ? `, with ${Math.round(conf * 100)} percent of its neighbours agreeing.` : '.')
            : src === 'listing'
              ? `Categorised as "${g}" from its Nexus or mod.io listing, because ` +
                'no submitted order has placed it yet.'
              : `Categorised as "${g}", which loads in that part of the order.`,
    });
    if (position !== mod.originalIndex) moved++;
    const div = dividerOf(mod);
    placements.set(mod.uuid, {
      uuid: mod.uuid,
      resolvedUuid: resolvedUuid.get(mod.uuid),
      position,
      group: g,
      // Only a real divider, never the sentinels used to pin the ends.
      divider: div === FIRST_DIVIDER || div === LAST_DIVIDER ? undefined : div,
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

  /*
   * Diagnosis of the order as it arrived, not as we left it.
   *
   * The sort silently repairs dependency violations, which hides the single
   * most useful thing we can tell someone: their order had a real problem.
   * Comparing the incoming positions against the dependency edges names it,
   * before they play rather than after they report a failure.
   */
  const incomingPosition = new Map(mods.map(m => [m.uuid, m.originalIndex]));
  const repaired: string[] = [];
  const repairedDetail: string[] = [];
  for (const mod of mods) {
    const declared = [
      ...(mod.dependencies ?? []),
      ...(byUuid.get(mod.uuid)?.dependencies ?? []),
    ];
    for (const dep of declared) {
      const target = present.get(dep.uuid)
        ?? byNormName.get(dep.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (!target) continue;
      const depWas = incomingPosition.get(target.uuid);
      const modWas = incomingPosition.get(mod.uuid);
      if (depWas === undefined || modWas === undefined || depWas < modWas) continue;
      repaired.push(mod.uuid);
      if (repairedDetail.length < 5) {
        repairedDetail.push(`${mod.name} needs ${target.name}`);
      }
    }
  }
  if (repaired.length) {
    issues.push({
      severity: 'warning',
      kind: 'fixed-dependency',
      message:
        `${repaired.length} mod${repaired.length > 1 ? 's' : ''} in the order you ` +
        `imported loaded before something ${repaired.length > 1 ? 'they' : 'it'} ` +
        `require${repaired.length > 1 ? '' : 's'}. VOLO has moved them: ` +
        repairedDetail.join(', ') +
        (repaired.length > repairedDetail.length ? ', and more' : '') + '.',
      uuids: [...new Set(repaired)],
      resolution: 'Export the sorted order to apply the fix.',
    });
  }

  /*
   * Curated incompatibilities: the one thing a statistic cannot express.
   *
   * Everything else here says where a mod usually goes. This says two mods must
   * not both be installed, which no amount of counting co-occurrences can
   * establish, and which no reordering can fix. Matched on UUID or name so a
   * rule can be written without looking a UUID up.
   */
  const byNameLower = new Map(sorted.map(m => [m.name.toLowerCase(), m]));
  const findMod = (ref: string) =>
    present.get(ref) ?? byNameLower.get(ref.toLowerCase());

  for (const rule of masterlist.incompatible ?? []) {
    const found = rule.mods.map(findMod).filter((m): m is Mod => !!m);
    if (found.length < 2) continue;
    issues.push({
      severity: rule.severity ?? 'critical',
      kind: 'incompatible',
      message: `${found.map(m => m.name).join(' and ')} should not be installed together.`,
      uuids: found.map(m => m.uuid),
      resolution: rule.why,
    });
  }

  /*
   * Curated notes on individual mods. Shown because someone wrote them down,
   * not because anything was measured.
   */
  for (const mod of sorted) {
    const entry = byUuid.get(mod.uuid)
      ?? byName.get(mod.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const note of entry?.messages ?? []) {
      issues.push({
        severity: note.severity,
        kind: 'curated-note',
        message: `${mod.name}: ${note.text}`,
        uuids: [mod.uuid],
      });
    }
  }

  /*
   * Mods the community has only ever run in orders reported as broken. Not
   * proof of fault, and deliberately worded that way, but it is the first
   * place to look when an order misbehaves for no obvious reason.
   */
  const neverVerified = sorted.filter(m => {
    const entry = byUuid.get(m.uuid)
      ?? byName.get(m.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return entry?.evidence
      && (entry.evidence.brokenInstalls ?? 0) > 0
      && entry.evidence.workingInstalls === 0;
  });
  if (neverVerified.length) {
    issues.push({
      severity: 'info',
      kind: 'never-verified',
      message:
        `${neverVerified.length} mod${neverVerified.length > 1 ? 's have' : ' has'} only ` +
        'appeared in load orders someone reported as broken, never in one confirmed working.',
      uuids: neverVerified.map(m => m.uuid),
      resolution:
        'That is not proof of fault, but if this order misbehaves, start here.',
    });
  }

  const unsortedMods = sorted.filter(m => group.get(m.uuid) === DEFAULT_GROUP);
  if (unsortedMods.length) {
    issues.push({
      severity: 'info',
      kind: 'unsorted',
      message:
        `${unsortedMods.length} mod${unsortedMods.length === 1 ? ' is' : 's are'} ` +
        'not in the masterlist yet. They keep their order relative to each other, ' +
        'but sit after the mods VOLO could place.',
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
