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
  /** Relies on the Script Extender, which is a dll and never appears in a load order. */
  usesScriptExtender?: boolean;
  evidence?: {
    source: 'curated' | 'section' | 'section-majority' | 'name-pattern' | 'inferred' | 'none';
    installs: number;
    workingInstalls: number;
    brokenInstalls?: number;
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
  groups: Group[];
  plugins: MasterlistPlugin[];
}

/**
 * Name-to-group map built from the external catalogues (Nexus and mod.io) at
 * build time. Consulted only for mods with no community evidence at all;
 * where the community has placed a mod, no external source overrides it.
 * Nexus wins name ties, so the modio map only holds names Nexus lacks.
 */
export interface ExternalCategories {
  generated: string;
  groups: GroupName[];
  /** Normalised mod name to index into groups, from the Nexus catalogue. */
  nexus: Record<string, number>;
  /** Names only mod.io knows, mapped from its tag vocabulary. */
  modio: Record<string, number>;
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
  position: number;
  group: GroupName;
  /** How we decided the group. */
  groupSource: 'masterlist' | 'inferred' | 'nexus' | 'modio' | 'name-pattern' | 'default';
  /** Neighbour agreement behind an inferred group, when that is the source. */
  groupConfidence?: number;
  /** Mods that had to load before this one, and why. */
  reasons: Reason[];
  /** How far this mod moved. Negative = earlier. */
  movedBy: number;
}

export interface Reason {
  kind: 'dependency' | 'group';
  text: string;
  relatedUuid?: string;
}

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface Issue {
  severity: IssueSeverity;
  kind: 'missing-dependency' | 'cycle' | 'duplicate' | 'unsorted' | 'unknown-mod' | 'script-extender';
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

/** What a parser produces from a user's file. */
export interface ParseResult {
  mods: Mod[];
  /** Section headers found, in order. These are the submitter's own categorisation. */
  sections: { label: string; afterIndex: number }[];
  format: string;
  warnings: string[];
  errors: string[];
}
