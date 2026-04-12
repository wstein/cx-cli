export type CxStyle = "xml" | "markdown" | "json" | "plain";
export type CxDedupMode = "fail" | "warn" | "first-wins";
export type CxRepomixMissingExtensionMode = "fail" | "warn";
export type CxConfigDuplicateEntryMode = "fail" | "warn" | "first-wins";
export type CxUnmatchedMode = "ignore" | "fail";
export type CxAssetsMode = "copy" | "ignore" | "fail";
export type CxAssetsLayout = "flat" | "deep";

export interface CxSectionConfig {
  include: string[];
  exclude: string[];
  style?: CxStyle;
  /**
   * Optional ownership priority for overlap resolution.
   *
   * When two or more sections claim the same file, the section with the
   * highest `priority` value wins. Sections without a `priority` value
   * are treated as priority 0 and their relative order is governed by
   * `dedup.order` (config order or lexical).
   *
   * Only applies when `dedup.mode` is `"first-wins"` or `"warn"`. In
   * `"fail"` mode, overlaps are rejected regardless of priority.
   */
  priority?: number;
}

export interface CxRepomixConfig {
  style: CxStyle;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
}

export interface CxFilesConfig {
  exclude: string[];
  followSymlinks: boolean;
  unmatched: CxUnmatchedMode;
}

export interface CxDedupConfig {
  mode: CxDedupMode;
  order: "config" | "lexical";
}

export interface CxManifestConfig {
  format: "json";
  pretty: boolean;
  includeFileSha256: boolean;
  includeOutputSha256: boolean;
  includeOutputSpans: boolean;
  includeSourceMetadata: boolean;
}

export interface CxChecksumsConfig {
  algorithm: "sha256";
  fileName: string;
}

export interface CxTokensConfig {
  encoding: string;
}

export interface CxListDisplayConfig {
  bytesWarm: number;
  bytesHot: number;
  tokensWarm: number;
  tokensHot: number;
  mtimeWarmMinutes: number;
  mtimeHotHours: number;
  timePalette: number[];
}

export interface CxAssetsConfig {
  include: string[];
  exclude: string[];
  mode: CxAssetsMode;
  targetDir: string;
  /**
   * Controls how asset files are placed inside `targetDir`.
   *
   * - "flat" — all assets are placed directly in `targetDir` with no
   *   subdirectories (default). When two source files share the same
   *   basename, a numeric postfix is appended to the base name (before
   *   the extension) to keep stored paths unique, e.g. `logo-2.png`.
   * - "deep" — the original relative directory structure is preserved
   *   under `targetDir`.
   */
  layout: CxAssetsLayout;
}

/**
 * Category B behavioral settings — configurable via cx.toml, CX_* env vars, or CLI flags.
 *
 * Category A invariants (section overlap with dedup.mode=fail, asset collision, missing core
 * adapter contract) are never configurable and are not represented here.
 */
export interface CxBehaviorConfig {
  /**
   * Controls what happens when the cx-specific Repomix adapter extensions
   * (packStructured / renderWithMap) are missing but the core contract is met.
   *
   * - "fail" — abort with a non-zero exit code (useful for strict CI assertions).
   * - "warn" — emit a warning and continue with degraded output (default).
   */
  repomixMissingExtension: CxRepomixMissingExtensionMode;
  /**
   * Controls what happens when duplicate glob patterns are found within the same
   * include or exclude array in any section or config block.
   *
   * - "fail"       — abort with a non-zero exit code.
   * - "warn"       — emit a warning and deduplicate (first occurrence wins).
   * - "first-wins" — silently deduplicate (first occurrence wins).
   */
  configDuplicateEntry: CxConfigDuplicateEntryMode;
}

/** The source from which each Category B behavioral setting was resolved. */
export interface CxBehaviorSources {
  dedupMode:
    | "compiled default"
    | "cx.toml"
    | "env var"
    | "CX_STRICT"
    | "cli flag";
  repomixMissingExtension:
    | "compiled default"
    | "cx.toml"
    | "env var"
    | "CX_STRICT"
    | "cli flag";
  configDuplicateEntry:
    | "compiled default"
    | "cx.toml"
    | "env var"
    | "CX_STRICT"
    | "cli flag";
}

export interface CxConfig {
  schemaVersion: 1;
  projectName: string;
  sourceRoot: string;
  outputDir: string;
  repomix: CxRepomixConfig;
  files: CxFilesConfig;
  dedup: CxDedupConfig;
  manifest: CxManifestConfig;
  checksums: CxChecksumsConfig;
  tokens: CxTokensConfig;
  assets: CxAssetsConfig;
  behavior: CxBehaviorConfig;
  behaviorSources: CxBehaviorSources;
  sections: Record<string, CxSectionConfig>;
}

export interface CxConfigInput {
  schema_version?: unknown;
  project_name?: unknown;
  source_root?: unknown;
  output_dir?: unknown;
  repomix?: Record<string, unknown>;
  files?: Record<string, unknown>;
  dedup?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  checksums?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  display?: unknown;
  assets?: Record<string, unknown>;
  config?: Record<string, unknown>;
  sections?: Record<string, Record<string, unknown>>;
}

export interface CxUserConfig {
  display: {
    list: CxListDisplayConfig;
  };
}

export interface CxUserConfigInput {
  display?: Record<string, unknown>;
}
