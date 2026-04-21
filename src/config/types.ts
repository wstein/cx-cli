export type CxStyle = "xml" | "markdown" | "json" | "plain";
export type CxDedupMode = "fail" | "warn" | "first-wins";
export type CxRepomixMissingExtensionMode = "fail" | "warn";
export type CxConfigDuplicateEntryMode = "fail" | "warn" | "first-wins";
export type CxScannerMode = "fail" | "warn";
export type CxScannerStage = "pre_pack_source" | "post_pack_artifact";
export type CxScannerId = "reference_secrets";
export type CxUnmatchedMode = "ignore" | "fail";
export type CxAssetsMode = "copy" | "ignore" | "fail";
export type CxAssetsLayout = "flat" | "deep";
export type CxNotesExtractFormat = "markdown" | "xml" | "plain";
export type CxNotesDocumentFormat = "asciidoc" | "markdown" | "plain";

export interface CxOutputExtensionsConfig {
  xml: string;
  markdown: string;
  json: string;
  plain: string;
}

export interface CxOutputConfig {
  extensions: CxOutputExtensionsConfig;
}

export interface CxSectionConfig {
  /**
   * Glob patterns that select files for this section from the VCS master
   * file list. Required on every section that does not set `catch_all`.
   *
   * Section globs are pure classifiers: they sort files from the master list
   * into sections. They can never introduce files that are not already in the
   * master list.
   */
  include?: string[];
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
  /**
   * When `true`, this section absorbs all files from the VCS master list
   * that are not claimed by any other section. At most one catch-all section
   * is allowed per project. A catch-all section must not specify `include`
   * patterns; it may optionally specify `exclude` patterns to drop specific
   * files from the remaining pool.
   */
  catch_all?: boolean;
}

export interface CxRepomixConfig {
  style: CxStyle;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
}

export interface CxFilesConfig {
  /**
   * Glob patterns that add files to the VCS master list even if they are not
   * tracked by the VCS (e.g. generated outputs that are deliberately
   * git-ignored). Applied after VCS discovery, before global excludes.
   *
   * The standard value is an empty array — rely on the VCS to define the
   * canonical file set.
   */
  include: string[];
  /**
   * Glob patterns that unconditionally remove files from the master list.
   * Acts as a security override: even VCS-tracked files are stripped before
   * any section sorting begins.
   */
  exclude: string[];
  followSymlinks: boolean;
  unmatched: CxUnmatchedMode;
}

export interface CxDedupConfig {
  mode: CxDedupMode;
  order: "config" | "lexical";
  requireExplicitOwnership: boolean;
}

export interface CxManifestConfig {
  format: "json";
  pretty: boolean;
  includeFileSha256: boolean;
  includeOutputSha256: boolean;
  includeOutputSpans: boolean;
  includeSourceMetadata: boolean;
  /**
   * When enabled, the bundle planner pulls in notes linked from bundled source
   * files so note context travels with the code that references it.
   */
  includeLinkedNotes?: boolean;
}

export interface CxHandoverConfig {
  includeRepoHistory: boolean;
  repoHistoryCount: number;
}

export interface CxNotesConfig {
  requireCognitionScore?: number;
  strictNotesMode: boolean;
  failOnDriftPressuredNotes: boolean;
  appliesToSections: string[];
  profiles: Record<string, CxNotesExtractProfileConfig>;
}

export interface CxNotesExtractLlmConfig {
  systemRole: string;
  instructions: string;
  targetFormat: CxNotesDocumentFormat;
  documentKind: string;
  audience: string;
  tone: string;
  mustCiteNoteTitles: boolean;
  mustPreserveUncertainty: boolean;
  mustNotInventFacts: boolean;
  mustIncludeProvenance: boolean;
  mustSurfaceConflicts: boolean;
}

export interface CxNotesExtractProfileConfig {
  description: string;
  outputFormat: CxNotesExtractFormat;
  targetPaths: string[];
  includeTags: string[];
  excludeTags: string[];
  requiredNotes: string[];
  includeTargets: Array<"current" | "v0.4" | "backlog">;
  sectionOrder: string[];
  sectionTags: Record<string, string[]>;
  llm: CxNotesExtractLlmConfig;
}

export interface CxScannerConfig {
  mode: CxScannerMode;
  ids: CxScannerId[];
  includePostPackArtifacts: boolean;
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
export interface CxMcpConfig {
  /**
   * MCP tool access control policy.
   *
   * - "default"      — deny mutate, allow read/observe/plan
   * - "strict"       — allow only read/observe (CI/CD safe)
   * - "unrestricted" — allow all (local development)
   *
   * Default: "default"
   */
  policy?: "default" | "strict" | "unrestricted";

  /**
   * Enable audit logging to .cx/audit.log.
   * Default: true
   */
  auditLogging?: boolean;

  /**
   * Explicitly enable mutate-capability MCP tools.
   *
   * Even when `policy` is `"unrestricted"`, mutate tools remain hidden
   * unless this flag is set to `true`. This prevents accidental exposure
   * of write operations when policy is relaxed for other reasons.
   *
   * Default: false
   */
  enableMutation?: boolean;
}

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
  /** Source for assets.layout. Never "CX_STRICT" — CX_STRICT does not affect layout. */
  assetsLayout: "compiled default" | "cx.toml" | "env var" | "cli flag";
}

export interface CxConfig {
  schemaVersion: 1;
  projectName: string;
  sourceRoot: string;
  outputDir: string;
  output: CxOutputConfig;
  repomix: CxRepomixConfig;
  files: CxFilesConfig;
  dedup: CxDedupConfig;
  manifest: CxManifestConfig;
  handover: CxHandoverConfig;
  notes: CxNotesConfig;
  scanner: CxScannerConfig;
  checksums: CxChecksumsConfig;
  tokens: CxTokensConfig;
  assets: CxAssetsConfig;
  behavior: CxBehaviorConfig;
  behaviorSources: CxBehaviorSources;
  mcp: CxMcpConfig;
  sections: Record<string, CxSectionConfig>;
}

export interface CxConfigInput {
  extends?: unknown;
  schema_version?: unknown;
  project_name?: unknown;
  source_root?: unknown;
  output_dir?: unknown;
  output?: Record<string, unknown>;
  repomix?: Record<string, unknown>;
  files?: Record<string, unknown>;
  dedup?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  handover?: Record<string, unknown>;
  notes?: Record<string, unknown>;
  scanner?: Record<string, unknown>;
  checksums?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  display?: unknown;
  assets?: Record<string, unknown>;
  config?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
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
