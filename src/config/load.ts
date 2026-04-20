import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse as parseToml } from "smol-toml";
import { CxError } from "../shared/errors.js";
import { DEFAULT_BEHAVIOR_VALUES, DEFAULT_CONFIG_VALUES } from "./defaults.js";
import {
  type CxEnvOverrides,
  getCLIOverrides,
  readEnvOverrides,
} from "./env.js";
import { assertSafeProjectName } from "./projectName.js";
import type {
  CxAssetsLayout,
  CxBehaviorConfig,
  CxBehaviorSources,
  CxConfig,
  CxConfigDuplicateEntryMode,
  CxConfigInput,
  CxDedupMode,
  CxHandoverConfig,
  CxOutputExtensionsConfig,
  CxRepomixMissingExtensionMode,
  CxSectionConfig,
  CxStyle,
} from "./types.js";

const RESERVED_SECTION_NAMES = new Set(["manifest", "assets", "bundle"]);
const VALID_STYLES = new Set<CxStyle>(["xml", "markdown", "json", "plain"]);
const VALID_DEDUP_MODES = new Set<CxDedupMode>(["fail", "warn", "first-wins"]);
const VALID_REPOMIX_MISSING = new Set<CxRepomixMissingExtensionMode>([
  "fail",
  "warn",
]);
const VALID_CONFIG_DUPLICATE = new Set<CxConfigDuplicateEntryMode>([
  "fail",
  "warn",
  "first-wins",
]);
const VALID_UNMATCHED_MODES = new Set<"ignore" | "fail">(["ignore", "fail"]);
const VALID_ASSET_MODES = new Set<"copy" | "ignore" | "fail">([
  "copy",
  "ignore",
  "fail",
]);
const VALID_ASSET_LAYOUTS = new Set<CxAssetsLayout>(["flat", "deep"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneRawValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneRawValue(entry));
  }

  if (isPlainObject(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = cloneRawValue(entry);
    }
    return clone;
  }

  return value;
}

function mergeRawValues(baseValue: unknown, overrideValue: unknown): unknown {
  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    return [
      ...baseValue.map((entry) => cloneRawValue(entry)),
      ...overrideValue.map((entry) => cloneRawValue(entry)),
    ];
  }

  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const merged: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(baseValue),
      ...Object.keys(overrideValue),
    ]);

    for (const key of keys) {
      const baseEntry = baseValue[key];
      const overrideEntry = overrideValue[key];

      if (overrideEntry === undefined) {
        merged[key] = cloneRawValue(baseEntry);
        continue;
      }

      if (baseEntry === undefined) {
        merged[key] = cloneRawValue(overrideEntry);
        continue;
      }

      merged[key] = mergeRawValues(baseEntry, overrideEntry);
    }

    return merged;
  }

  return overrideValue === undefined
    ? cloneRawValue(baseValue)
    : cloneRawValue(overrideValue);
}

function mergeInheritedConfig(
  baseConfig: CxConfigInput,
  childConfig: CxConfigInput,
): CxConfigInput {
  const merged = mergeRawValues(baseConfig, childConfig);

  if (!isPlainObject(merged)) {
    throw new CxError("cx.toml inheritance produced an invalid config shape.");
  }

  delete merged.extends;
  return merged as CxConfigInput;
}

async function loadConfigInput(
  configPath: string,
  allowExtends: boolean,
): Promise<CxConfigInput> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseToml(raw) as CxConfigInput;
  const configDir = path.dirname(path.resolve(configPath));

  if (parsed.extends !== undefined) {
    const extendsPath = expectString(parsed.extends, "extends");

    if (!allowExtends) {
      throw new CxError(
        "Deep configuration chaining is forbidden. Base configs must not declare extends.",
      );
    }

    const inheritedPath = path.resolve(configDir, extendsPath);
    const baseConfig = await loadConfigInput(inheritedPath, false);
    return mergeInheritedConfig(baseConfig, parsed);
  }

  return parsed;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CxError(`${label} must be a non-empty string.`);
  }
  return value;
}

function expectBoolean(
  value: unknown,
  label: string,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new CxError(`${label} must be a boolean.`);
  }

  return value;
}

function expectPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new CxError(`${label} must be a positive integer.`);
  }
  return value;
}

function expectStringArray(
  value: unknown,
  label: string,
  defaultValue: string[] = [],
): string[] {
  if (value === undefined) {
    return [...defaultValue];
  }

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.length === 0)
  ) {
    throw new CxError(`${label} must be an array of non-empty strings.`);
  }

  return [...value];
}

function expectEnum<T extends string>(
  value: unknown,
  label: string,
  validValues: Set<T>,
  defaultValue: T,
): T {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !validValues.has(value as T)) {
    throw new CxError(
      `${label} must be one of: ${[...validValues].join(", ")}.`,
    );
  }

  return value as T;
}

function expectFileExtension(value: unknown, label: string): string {
  const extension = expectString(value, label);
  if (!extension.startsWith(".")) {
    throw new CxError(`${label} must start with '.'.`);
  }
  if (/[/\\]/.test(extension)) {
    throw new CxError(`${label} must not contain path separators.`);
  }
  if (extension.length < 2) {
    throw new CxError(
      `${label} must include at least one character after '.'.`,
    );
  }
  return extension;
}

function parseOutputExtensions(
  output: Record<string, unknown>,
): CxOutputExtensionsConfig {
  const defaults = DEFAULT_CONFIG_VALUES.output.extensions;
  const extensionsRaw = output.extensions;
  if (extensionsRaw === undefined) {
    return { ...defaults };
  }
  if (
    typeof extensionsRaw !== "object" ||
    extensionsRaw === null ||
    Array.isArray(extensionsRaw)
  ) {
    throw new CxError("output.extensions must be a table.");
  }

  const extensions = extensionsRaw as Record<string, unknown>;
  const validKeys = new Set(["xml", "json", "markdown", "plain"]);
  for (const key of Object.keys(extensions)) {
    if (!validKeys.has(key)) {
      throw new CxError(
        "output.extensions supports only: xml, json, markdown, plain.",
      );
    }
  }

  return {
    xml: expectFileExtension(
      extensions.xml ?? defaults.xml,
      "output.extensions.xml",
    ),
    json: expectFileExtension(
      extensions.json ?? defaults.json,
      "output.extensions.json",
    ),
    markdown: expectFileExtension(
      extensions.markdown ?? defaults.markdown,
      "output.extensions.markdown",
    ),
    plain: expectFileExtension(
      extensions.plain ?? defaults.plain,
      "output.extensions.plain",
    ),
  };
}

function parseHandoverConfig(
  handover: Record<string, unknown>,
): CxHandoverConfig {
  return {
    includeRepoHistory: expectBoolean(
      handover.include_repo_history,
      "handover.include_repo_history",
      DEFAULT_CONFIG_VALUES.handover.includeRepoHistory,
    ),
    repoHistoryCount:
      handover.repo_history_count === undefined
        ? DEFAULT_CONFIG_VALUES.handover.repoHistoryCount
        : expectPositiveInteger(
            handover.repo_history_count,
            "handover.repo_history_count",
          ),
  };
}

/**
 * Emit a warning to stderr. Used for Category B "warn" mode results.
 */
function emitWarning(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}

/**
 * Deduplicate a string array, reporting duplicates according to the configured mode.
 *
 * - "fail"       — throw CxError on the first duplicate found.
 * - "warn"       — emit a warning to stderr and return deduplicated array.
 * - "first-wins" — silently return deduplicated array.
 */
function deduplicatePatterns(
  patterns: string[],
  label: string,
  mode: CxConfigDuplicateEntryMode,
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const pattern of patterns) {
    if (seen.has(pattern)) {
      duplicates.push(pattern);
    } else {
      seen.add(pattern);
    }
  }

  if (duplicates.length === 0) return patterns;

  const listed = duplicates.map((p) => `"${p}"`).join(", ");
  const message = `${label} contains duplicate pattern(s): ${listed}.`;

  if (mode === "fail") {
    throw new CxError(message);
  }

  if (mode === "warn") {
    emitWarning(message);
  }

  return [...seen];
}

function normalizeSection(
  sectionName: string,
  input: Record<string, unknown> | undefined,
  duplicateMode: CxConfigDuplicateEntryMode,
): CxSectionConfig {
  if (!input) {
    throw new CxError(`sections.${sectionName} must be a table.`);
  }

  const isCatchAll = expectBoolean(
    input.catch_all,
    `sections.${sectionName}.catch_all`,
    false,
  );

  if (isCatchAll && input.include !== undefined) {
    throw new CxError(
      `sections.${sectionName}: catch_all sections must not specify include patterns.`,
    );
  }

  const style =
    input.style === undefined
      ? undefined
      : expectEnum(
          input.style,
          `sections.${sectionName}.style`,
          VALID_STYLES,
          DEFAULT_CONFIG_VALUES.repomix.style,
        );

  const rawExclude = expectStringArray(
    input.exclude,
    `sections.${sectionName}.exclude`,
    [],
  );
  const exclude = deduplicatePatterns(
    rawExclude,
    `sections.${sectionName}.exclude`,
    duplicateMode,
  );

  const normalized: CxSectionConfig = { exclude };

  if (!isCatchAll) {
    const rawInclude = expectStringArray(
      input.include,
      `sections.${sectionName}.include`,
    );
    if (rawInclude.length === 0) {
      throw new CxError(
        `sections.${sectionName}.include must contain at least one pattern (or set catch_all = true).`,
      );
    }
    normalized.include = deduplicatePatterns(
      rawInclude,
      `sections.${sectionName}.include`,
      duplicateMode,
    );
  } else {
    normalized.catch_all = true;
  }

  if (style !== undefined) {
    normalized.style = style;
  }

  const priority =
    input.priority === undefined
      ? undefined
      : expectPositiveInteger(
          input.priority,
          `sections.${sectionName}.priority`,
        );

  if (priority !== undefined) {
    normalized.priority = priority;
  }

  return normalized;
}

function resolveTemplate(value: string, projectName: string): string {
  return value.replaceAll("{project}", projectName);
}

function expandEnvironmentVariables(value: string, label: string): string {
  return value.replaceAll(
    /\$(?:\{(?<braced>[A-Za-z_][A-Za-z0-9_]*)\}|(?<bare>[A-Za-z_][A-Za-z0-9_]*))/g,
    (_match, _braced, _bare, _offset, _input, groups) => {
      const variableName = String(groups?.braced ?? groups?.bare ?? "");
      const resolved = process.env[variableName];
      if (resolved === undefined) {
        throw new CxError(
          `${label} references undefined environment variable ${variableName}.`,
        );
      }
      return resolved;
    },
  );
}

function expandHomeDirectory(value: string): string {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function resolveConfigPath(
  configDir: string,
  rawValue: unknown,
  label: string,
  projectName: string,
): string {
  const input = expectString(rawValue, label);
  const expanded = expandHomeDirectory(
    resolveTemplate(expandEnvironmentVariables(input, label), projectName),
  );
  return path.resolve(configDir, expanded);
}

type BehaviorSource = CxBehaviorSources[keyof CxBehaviorSources];
type BehaviorLogLevel = "info" | "warn";
type BehaviorLogFn =
  | ((level: BehaviorLogLevel, message: string) => void)
  | undefined;

function emitBehaviorLog(level: BehaviorLogLevel, message: string): void {
  const prefix = level === "info" ? "Info" : "Warning";
  process.stderr.write(`${prefix}: ${message}\n`);
}

/**
 * Resolve a single Category B setting by applying the precedence chain:
 *   cli flag > env var > cx.toml value > compiled default
 *
 * Logs the resolved source at Info level to stderr for pipeline auditability.
 * The log is suppressed when the value comes from the compiled default to
 * avoid noise in the common case where no overrides are active.
 *
 * When an env var or CLI flag wins over a conflicting explicit cx.toml value,
 * a Warning line is emitted so the operator can see the shadowing without
 * having to run `cx config` to discover it.
 *
 * Returns both the resolved value and its source so callers can record the
 * source in the lock file and show-effective output.
 */
function resolveCategory<T>(params: {
  label: string;
  cliValue: T | undefined;
  envValue: T | undefined;
  fileValue: T | undefined;
  defaultValue: T;
  strictEnvActive: boolean;
  log: BehaviorLogFn;
}): { value: T; source: BehaviorSource } {
  const {
    label,
    cliValue,
    envValue,
    fileValue,
    defaultValue,
    strictEnvActive,
    log,
  } = params;

  if (cliValue !== undefined) {
    log?.("info", `${label}="${String(cliValue)}" (from cli flag)`);
    if (fileValue !== undefined && fileValue !== cliValue) {
      log?.(
        "warn",
        `${label} in cx.toml ("${String(fileValue)}") is overridden by cli flag to "${String(cliValue)}"`,
      );
    }
    return { value: cliValue, source: "cli flag" };
  }

  if (envValue !== undefined) {
    const source: BehaviorSource = strictEnvActive ? "CX_STRICT" : "env var";
    log?.("info", `${label}="${String(envValue)}" (from ${source})`);
    if (fileValue !== undefined && fileValue !== envValue) {
      log?.(
        "warn",
        `${label} in cx.toml ("${String(fileValue)}") is overridden by ${source} to "${String(envValue)}"`,
      );
    }
    return { value: envValue, source };
  }

  if (fileValue !== undefined) {
    log?.("info", `${label}="${String(fileValue)}" (from cx.toml)`);
    return { value: fileValue, source: "cx.toml" };
  }

  return { value: defaultValue, source: "compiled default" };
}

export type LoadCxConfigOptions = {
  emitBehaviorLogs?: boolean;
};

function buildCxConfigFromParsedInput(
  parsed: CxConfigInput,
  configPath: string,
  envOverrides: CxEnvOverrides,
  cliOverrides: CxEnvOverrides,
  options: LoadCxConfigOptions,
): CxConfig {
  const configDir = path.dirname(path.resolve(configPath));
  const schemaVersion = parsed.schema_version;

  if (schemaVersion !== 1) {
    throw new CxError("schema_version must be 1.");
  }

  const projectName = expectString(parsed.project_name, "project_name");
  assertSafeProjectName(projectName);

  const sourceRoot = resolveConfigPath(
    configDir,
    parsed.source_root,
    "source_root",
    projectName,
  );
  const outputDir = resolveConfigPath(
    configDir,
    parsed.output_dir,
    "output_dir",
    projectName,
  );
  const output = parsed.output ?? {};
  const repomix = parsed.repomix ?? {};
  const files = parsed.files ?? {};
  const dedup = parsed.dedup ?? {};
  const manifest = parsed.manifest ?? {};
  const handover = parsed.handover ?? {};
  const checksums = parsed.checksums ?? {};
  const tokens = parsed.tokens ?? {};
  const assets = parsed.assets ?? {};
  const configSection = parsed.config ?? {};
  const mcp = parsed.mcp ?? {};
  const sectionsInput = parsed.sections;

  if (parsed.display !== undefined) {
    throw new CxError(
      "display settings are no longer supported in project cx.toml. Use ~/.config/cx/cx.toml instead.",
    );
  }

  if (
    !sectionsInput ||
    typeof sectionsInput !== "object" ||
    Object.keys(sectionsInput).length === 0
  ) {
    throw new CxError("sections must define at least one section.");
  }

  // --- Category B: resolve behavioral settings with full precedence chain ---
  const strictEnvActive =
    process.env.CX_STRICT === "true" || process.env.CX_STRICT === "1";
  const behaviorLog: BehaviorLogFn =
    options.emitBehaviorLogs === false ? undefined : emitBehaviorLog;

  const dedupModeFromFile =
    dedup.mode !== undefined
      ? expectEnum(
          dedup.mode,
          "dedup.mode",
          VALID_DEDUP_MODES,
          DEFAULT_CONFIG_VALUES.dedup.mode,
        )
      : undefined;

  const dedupResolved = resolveCategory({
    label: "dedup.mode",
    cliValue: cliOverrides.dedupMode,
    envValue: envOverrides.dedupMode,
    fileValue: dedupModeFromFile,
    defaultValue: DEFAULT_CONFIG_VALUES.dedup.mode,
    strictEnvActive,
    log: behaviorLog,
  });

  const repomixMissingExtensionFromFile =
    repomix.missing_extension !== undefined
      ? expectEnum(
          repomix.missing_extension,
          "repomix.missing_extension",
          VALID_REPOMIX_MISSING,
          DEFAULT_BEHAVIOR_VALUES.repomixMissingExtension,
        )
      : undefined;

  const repomixMissingResolved = resolveCategory({
    label: "repomix.missing_extension",
    cliValue: cliOverrides.repomixMissingExtension,
    envValue: envOverrides.repomixMissingExtension,
    fileValue: repomixMissingExtensionFromFile,
    defaultValue: DEFAULT_BEHAVIOR_VALUES.repomixMissingExtension,
    strictEnvActive,
    log: behaviorLog,
  });

  const configDuplicateEntryFromFile =
    configSection.duplicate_entry !== undefined
      ? expectEnum(
          configSection.duplicate_entry,
          "config.duplicate_entry",
          VALID_CONFIG_DUPLICATE,
          DEFAULT_BEHAVIOR_VALUES.configDuplicateEntry,
        )
      : undefined;

  const configDuplicateResolved = resolveCategory({
    label: "config.duplicate_entry",
    cliValue: cliOverrides.configDuplicateEntry,
    envValue: envOverrides.configDuplicateEntry,
    fileValue: configDuplicateEntryFromFile,
    defaultValue: DEFAULT_BEHAVIOR_VALUES.configDuplicateEntry,
    strictEnvActive,
    log: behaviorLog,
  });

  const assetsLayoutFromFile =
    assets.layout !== undefined
      ? expectEnum(
          assets.layout,
          "assets.layout",
          VALID_ASSET_LAYOUTS,
          DEFAULT_CONFIG_VALUES.assets.layout,
        )
      : undefined;

  const assetsLayoutResolved = resolveCategory({
    label: "assets.layout",
    cliValue: cliOverrides.assetsLayout,
    envValue: envOverrides.assetsLayout,
    fileValue: assetsLayoutFromFile,
    defaultValue: DEFAULT_CONFIG_VALUES.assets.layout,
    strictEnvActive,
    log: behaviorLog,
  });

  const behavior: CxBehaviorConfig = {
    repomixMissingExtension: repomixMissingResolved.value,
    configDuplicateEntry: configDuplicateResolved.value,
  };

  const behaviorSources: CxBehaviorSources = {
    dedupMode: dedupResolved.source,
    repomixMissingExtension: repomixMissingResolved.source,
    configDuplicateEntry: configDuplicateResolved.source,
    // Normalize "CX_STRICT" → "env var" for assetsLayout: CX_STRICT does not
    // control asset layout, so if both CX_STRICT and CX_ASSETS_LAYOUT are set,
    // the accurate source attribution is "env var".
    assetsLayout:
      assetsLayoutResolved.source === "CX_STRICT"
        ? "env var"
        : assetsLayoutResolved.source,
  };

  // --- Sections ---

  const sections: Record<string, CxSectionConfig> = {};
  for (const [sectionName, sectionValue] of Object.entries(sectionsInput)) {
    if (RESERVED_SECTION_NAMES.has(sectionName)) {
      throw new CxError(
        `sections.${sectionName} uses a reserved section name.`,
      );
    }
    sections[sectionName] = normalizeSection(
      sectionName,
      sectionValue,
      configDuplicateResolved.value,
    );
  }

  // --- Remaining config fields ---

  const filesInclude = deduplicatePatterns(
    expectStringArray(
      files.include,
      "files.include",
      DEFAULT_CONFIG_VALUES.files.include,
    ),
    "files.include",
    configDuplicateResolved.value,
  );

  const filesExclude = deduplicatePatterns(
    expectStringArray(
      files.exclude,
      "files.exclude",
      DEFAULT_CONFIG_VALUES.files.exclude,
    ),
    "files.exclude",
    configDuplicateResolved.value,
  );

  const assetsInclude = deduplicatePatterns(
    expectStringArray(
      assets.include,
      "assets.include",
      DEFAULT_CONFIG_VALUES.assets.include,
    ),
    "assets.include",
    configDuplicateResolved.value,
  );

  const assetsExclude = deduplicatePatterns(
    expectStringArray(
      assets.exclude,
      "assets.exclude",
      DEFAULT_CONFIG_VALUES.assets.exclude,
    ),
    "assets.exclude",
    configDuplicateResolved.value,
  );

  return {
    schemaVersion: 1,
    projectName,
    sourceRoot,
    outputDir,
    output: {
      extensions: parseOutputExtensions(output),
    },
    repomix: {
      style: expectEnum(
        repomix.style,
        "repomix.style",
        VALID_STYLES,
        DEFAULT_CONFIG_VALUES.repomix.style,
      ),
      showLineNumbers: expectBoolean(
        repomix.show_line_numbers,
        "repomix.show_line_numbers",
        DEFAULT_CONFIG_VALUES.repomix.showLineNumbers,
      ),
      includeEmptyDirectories: expectBoolean(
        repomix.include_empty_directories,
        "repomix.include_empty_directories",
        DEFAULT_CONFIG_VALUES.repomix.includeEmptyDirectories,
      ),
      securityCheck: expectBoolean(
        repomix.security_check,
        "repomix.security_check",
        DEFAULT_CONFIG_VALUES.repomix.securityCheck,
      ),
    },
    files: {
      include: filesInclude,
      exclude: filesExclude,
      followSymlinks: expectBoolean(
        files.follow_symlinks,
        "files.follow_symlinks",
        DEFAULT_CONFIG_VALUES.files.followSymlinks,
      ),
      unmatched: expectEnum(
        files.unmatched,
        "files.unmatched",
        VALID_UNMATCHED_MODES,
        DEFAULT_CONFIG_VALUES.files.unmatched,
      ),
    },
    dedup: {
      mode: dedupResolved.value,
      order: expectEnum(
        dedup.order,
        "dedup.order",
        new Set(["config", "lexical"]),
        DEFAULT_CONFIG_VALUES.dedup.order,
      ),
      requireExplicitOwnership: expectBoolean(
        dedup.require_explicit_ownership,
        "dedup.require_explicit_ownership",
        DEFAULT_CONFIG_VALUES.dedup.requireExplicitOwnership,
      ),
    },
    manifest: {
      format: "json",
      pretty: expectBoolean(
        manifest.pretty,
        "manifest.pretty",
        DEFAULT_CONFIG_VALUES.manifest.pretty,
      ),
      includeFileSha256: expectBoolean(
        manifest.include_file_sha256,
        "manifest.include_file_sha256",
        DEFAULT_CONFIG_VALUES.manifest.includeFileSha256,
      ),
      includeOutputSha256: expectBoolean(
        manifest.include_output_sha256,
        "manifest.include_output_sha256",
        DEFAULT_CONFIG_VALUES.manifest.includeOutputSha256,
      ),
      includeOutputSpans: expectBoolean(
        manifest.include_output_spans,
        "manifest.include_output_spans",
        DEFAULT_CONFIG_VALUES.manifest.includeOutputSpans,
      ),
      includeSourceMetadata: expectBoolean(
        manifest.include_source_metadata,
        "manifest.include_source_metadata",
        DEFAULT_CONFIG_VALUES.manifest.includeSourceMetadata,
      ),
      includeLinkedNotes: expectBoolean(
        manifest.include_linked_notes ??
          DEFAULT_CONFIG_VALUES.manifest.includeLinkedNotes,
        "manifest.include_linked_notes",
        false,
      ),
    },
    handover: parseHandoverConfig(handover),
    checksums: {
      algorithm: "sha256",
      fileName: resolveTemplate(
        expectString(
          checksums.file_name ?? DEFAULT_CONFIG_VALUES.checksums.fileName,
          "checksums.file_name",
        ),
        projectName,
      ),
    },
    tokens: {
      encoding: expectString(
        tokens.encoding ?? DEFAULT_CONFIG_VALUES.tokens.encoding,
        "tokens.encoding",
      ),
    },
    assets: {
      include: assetsInclude,
      exclude: assetsExclude,
      mode: expectEnum(
        assets.mode,
        "assets.mode",
        VALID_ASSET_MODES,
        DEFAULT_CONFIG_VALUES.assets.mode,
      ),
      targetDir: resolveTemplate(
        expectString(
          assets.target_dir ?? DEFAULT_CONFIG_VALUES.assets.targetDir,
          "assets.target_dir",
        ),
        projectName,
      ),
      layout: assetsLayoutResolved.value,
    },
    behavior,
    behaviorSources,
    mcp: {
      policy: expectEnum(
        mcp.policy,
        "mcp.policy",
        new Set(["default", "strict", "unrestricted"]),
        DEFAULT_CONFIG_VALUES.mcp.policy as "default",
      ) as "default" | "strict" | "unrestricted",
      auditLogging: expectBoolean(
        mcp.audit_logging,
        "mcp.audit_logging",
        DEFAULT_CONFIG_VALUES.mcp.auditLogging as boolean,
      ),
      enableMutation: expectBoolean(
        mcp.enable_mutation,
        "mcp.enable_mutation",
        DEFAULT_CONFIG_VALUES.mcp.enableMutation as boolean,
      ),
    },
    sections,
  };
}

/**
 * Load and validate a project cx.toml file.
 *
 * Precedence chain for Category B behavioral settings (highest first):
 *   cliOverrides > envOverrides > cx.toml value > compiled default
 *
 * @param configPath   - Absolute or relative path to cx.toml.
 * @param envOverrides - Overrides sourced from CX_* env vars.
 *                       Defaults to readEnvOverrides() from the live environment.
 *                       Pass an explicit value in tests to avoid process.env mutation.
 * @param cliOverrides - Overrides sourced from CLI flags (--strict / --lenient).
 *                       Defaults to getCLIOverrides(), set by setCLIOverrides() in
 *                       the yargs middleware before any command handler runs.
 * @param options      - Optional config-load behavior toggles.
 *                       Set emitBehaviorLogs=false for high-volume property tests.
 */
export async function loadCxConfig(
  configPath: string,
  envOverrides: CxEnvOverrides = readEnvOverrides(),
  cliOverrides: CxEnvOverrides = getCLIOverrides(),
  options: LoadCxConfigOptions = {},
): Promise<CxConfig> {
  const parsed = await loadConfigInput(configPath, true);
  return buildCxConfigFromParsedInput(
    parsed,
    configPath,
    envOverrides,
    cliOverrides,
    options,
  );
}

export async function loadCxConfigFromTomlString(
  configPath: string,
  rawToml: string,
  envOverrides: CxEnvOverrides = readEnvOverrides(),
  cliOverrides: CxEnvOverrides = getCLIOverrides(),
  options: LoadCxConfigOptions = {},
): Promise<CxConfig> {
  const parsed = parseToml(rawToml) as CxConfigInput;
  if (parsed.extends !== undefined) {
    throw new CxError(
      "loadCxConfigFromTomlString does not support extends; use loadCxConfig for inherited configs.",
    );
  }
  return buildCxConfigFromParsedInput(
    parsed,
    configPath,
    envOverrides,
    cliOverrides,
    options,
  );
}
