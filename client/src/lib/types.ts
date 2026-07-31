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
  evidence?: {
    source: 'curated' | 'section' | 'section-majority' | 'name-pattern' | 'none';
    installs: number;
    workingInstalls: number;
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

/** Why a mod ended up where it did. LOOT's transparency principle. */
export interface Placement {
  uuid: string;
  position: number;
  group: GroupName;
  /** How we decided the group. */
  groupSource: 'masterlist' | 'name-pattern' | 'default';
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
  kind: 'missing-dependency' | 'cycle' | 'duplicate' | 'unsorted' | 'unknown-mod';
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
