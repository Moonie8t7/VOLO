/** Domain types. Everything here is plain data, no I/O and no framework. */

/** A mod as it exists in the user's load order. */
export interface Mod {
  /** BG3's stable identifier. Present in every real export; our primary key. */
  uuid: string;
  name: string;
  /** Position in the file the user gave us. Used to minimise reordering. */
  originalIndex: number;

  folder?: string;
  author?: string;
  version?: string;
  description?: string;
  fileName?: string;
  /** Declared dependencies from the .pak metadata. Only in full BG3MM exports. */
  dependencies?: ModRef[];
  /** Script Extender feature flags, e.g. ["Lua"]. */
  featureFlags?: string[];
  /**
   * Fields modsettings.lsx and full BG3MM exports carry, preserved so the
   * order can be written back as a modsettings.lsx the game will accept.
   */
  version64?: string;
  md5?: string;
  publishHandle?: string;
}

export interface ModRef {
  uuid: string;
  name: string;
}

export type GroupName = string;

export interface Group {
  name: GroupName;
  description: string;
  /** Groups this one loads after. */
  after: GroupName[];
}

export interface MasterlistPlugin {
  name: string;
  uuid: string;
  group: GroupName;
  folder?: string;
  author?: string;
  version?: string;
  dependencies?: ModRef[];
  featureFlags?: string[];
  /** Newest BG3 build this mod has been seen in a load order for. */
  lastSeenGameBuild?: string;
  /** Astra divider this mod belongs under, e.g. 58.11 for a Warlock subclass. */
  divider?: number;
  /** Relies on the Script Extender, which is a dll and never appears in a load order. */
  usesScriptExtender?: boolean;
  /**
   * Loaded after the mods that require it, so requirements naming it stop
   * being ordering constraints. True of a patcher, which reads the mods it
   * patches and so has to come last. Set by the miner from the working orders,
   * never by hand. The requirement itself still stands: the mod being absent
   * is still reported.
   */
  loadsAfterDependents?: boolean;
  /**
   * Most working orders that declare this as a requirement do not have it, so
   * its absence is not what breaks a load order. Measured, never hand-set.
   */
  oftenAbsent?: boolean;
  /**
   * The count behind that flag: working orders holding a mod that requires this
   * one, and how many of them have it.
   *
   * The measurement was taken and thrown away for the boolean, so a card could
   * only assert a colour. A number is checkable and a colour is not, and the
   * red one claims the order is broken, which this cannot know. Present
   * whenever the corpus witnessed the requirement at all, not only when the
   * absence crossed a threshold.
   */
  absence?: { held: number; witnesses: number };
  /**
   * Mods this one loads after because an author published a sequence saying so.
   *
   * An ordering, deliberately not a requirement. A published load order says
   * these load in this order; it does not say the later ones need the earlier
   * ones, and reporting a missing dependency on that basis would invent a claim
   * the author never made.
   */
  loadAfter?: (ModRef & { why?: string })[];
  /**
   * Other names this mod has been published under, most frequent first.
   *
   * A rename leaves everyone who has not updated listing the old name, so both
   * live in the corpus. Used to resolve a name nothing else answers to; a
   * canonical name always wins its own key.
   */
  alternateNames?: string[];
  /** Curated warnings attached to this mod, shown whenever it is present. */
  messages?: { text: string; severity: IssueSeverity }[];
  evidence?: {
    source: 'curated' | 'section' | 'section-majority' | 'name-pattern' | 'external-category' | 'author-catalogue' | 'divider-vocabulary' | 'inferred' | 'none';
    /** Distinct orders holding this mod, whatever their status. */
    installs: number;
    /** Of those, the ones whose submitter said the order worked. */
    workingInstalls: number;
    brokenInstalls?: number;
    /**
     * Of those, the ones VOLO sorted. Their presence counts, since the mods were
     * really installed and played; their sequence never does, because it is
     * VOLO's own answer returning.
     */
    voloSortedInstalls?: number;
    /** For inferred entries: neighbour agreement, 0.7 to 1. Higher tracks measured accuracy. */
    confidence?: number;
  };
}

export interface Masterlist {
  version: string;
  generated: string;
  /** BG3 build this data is calibrated against, e.g. "4.8.700.7143220". */
  gameBuild?: string | null;
  /** Human form of the above, e.g. "Patch 8". */
  gamePatch?: string | null;
  gameBuildsObserved?: string[];
  provenance?: Record<string, number>;
  /**
   * Names a requirement may use for a mod that none of the mod's own strings
   * match, mapped to that mod's uuid. Keyed by lowercased alphanumeric name.
   *
   * Hand-written, because nothing measurable joins "Vlad's Grimoire" to a pak
   * called VFX_Library_VladsGrimoire, and matching on resemblance would invent
   * links between unrelated mods.
   */
  requirementAliases?: Record<string, string>;
  /**
   * Requirements another mod can meet instead, keyed by the required mod's
   * uuid. Two mods doing the same job share no name, author or metadata, so
   * nothing can measure this and it is stated by hand.
   */
  requirementSatisfiedBy?: Record<string, string[]>;
  /**
   * Mods that must not be installed together.
   *
   * Hand-written only. Two mods appearing in an order that broke is not
   * evidence they conflict, and saying so about a real author's work on that
   * basis would be a false claim rather than a cautious one.
   */
  incompatible?: Incompatibility[];
  groups: Group[];
  plugins: MasterlistPlugin[];
}

/**
 * The published Nexus and mod.io catalogues, reduced to name -> group.
 *
 * Keys are lowercased alphanumeric mod names; values index into `groups`.
 * This is the last placement tier before giving up: a mod no order has placed
 * and no name pattern recognises can still be filed where its own listing
 * says it belongs.
 */
export interface ExternalListing {
  generated: string;
  groups: GroupName[];
  nexus: Record<string, number>;
  modio: Record<string, number>;
}

export interface Incompatibility {
  /** Names or UUIDs. Two or more present together triggers the warning. */
  mods: string[];
  /** Why they conflict, shown to the user verbatim. */
  why: string;
  severity?: IssueSeverity;
}

/** Why a mod ended up where it did. LOOT's transparency principle. */
export interface Placement {
  uuid: string;
  /**
   * Real pak UUID recovered from the masterlist when the import had none
   * (TSV and plain-text exports carry no UUID column). Lets the export
   * round-trip into BG3MM, which matches entries by UUID.
   */
  resolvedUuid?: string;
  /**
   * The mod's author, from the export when it carried one and from the
   * masterlist when it did not. Recovered here for the same reason as
   * resolvedUuid: the thin exports most people submit carry no author column,
   * so the file alone can credit only a third of the mods it lists.
   */
  author?: string;
  position: number;
  group: GroupName;
  /** Astra divider this mod sits under, when one applies. */
  divider?: number;
  /** How we decided the group. */
  groupSource: 'masterlist' | 'curated' | 'inferred' | 'listing' | 'author' | 'name-pattern' | 'default' | 'you';
  /** Neighbour agreement behind an inferred group, when that is the source. */
  groupConfidence?: number;
  /** Mods that had to load before this one, and why. */
  reasons: Reason[];
  /** How far this mod moved. Negative = earlier. */
  movedBy: number;
}

export interface Reason {
  kind: 'dependency' | 'group' | 'sequence';
  text: string;
  relatedUuid?: string;
}

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface Issue {
  severity: IssueSeverity;
  kind: 'missing-dependency' | 'cycle' | 'duplicate' | 'unsorted' | 'unknown-mod' | 'incompatible' | 'curated-note'
    | 'script-extender' | 'fixed-dependency' | 'never-verified';
  message: string;
  /** Mods this issue concerns. */
  uuids: string[];
  resolution?: string;
}

export interface SortResult {
  mods: Mod[];
  placements: Map<string, Placement>;
  issues: Issue[];
  stats: {
    total: number;
    moved: number;
    knownToMasterlist: number;
    hardEdges: number;
    unsorted: number;
  };
}

/**
 * A section header out of the user's own file.
 *
 * Two kinds arrive here. Most are divider paks, which carry a uuid and can be
 * written back into an export exactly as they came, because the user has the
 * pak installed. The rest are typed into a mod's name by hand and have nothing
 * to write back. Both label the mods that follow them, which is where the
 * strongest placement evidence in the project comes from.
 */
export interface ImportedSection {
  label: string;
  /** Index into the parsed mod list that this header sat above. */
  afterIndex: number;
  /** The divider pak's uuid, absent when the header was typed by hand. */
  uuid?: string;
  /** Exactly as written in the file, so it can go back unchanged. */
  name?: string;
}

/** What a parser produces from a user's file. */
export interface ParseResult {
  mods: Mod[];
  /** Section headers found, in order. These are the submitter's own categorisation. */
  sections: ImportedSection[];
  format: string;
  warnings: string[];
  errors: string[];
}
