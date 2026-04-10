import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse as parseToml } from "smol-toml";
import { CxError } from "../shared/errors.js";
import { DEFAULT_CONFIG_VALUES } from "./defaults.js";
import { assertSafeProjectName } from "./projectName.js";
import type {
  CxConfig,
  CxConfigInput,
  CxSectionConfig,
  CxStyle,
} from "./types.js";

const RESERVED_SECTION_NAMES = new Set(["manifest", "assets", "bundle"]);
const VALID_STYLES = new Set<CxStyle>(["xml", "markdown", "json", "plain"]);
const VALID_DEDUP_MODES = new Set<"fail" | "first-wins">([
  "fail",
  "first-wins",
]);
const VALID_UNMATCHED_MODES = new Set<"ignore" | "fail">(["ignore", "fail"]);
const VALID_ASSET_MODES = new Set<"copy" | "ignore" | "fail">([
  "copy",
  "ignore",
  "fail",
]);

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

function normalizeSection(
  sectionName: string,
  input: Record<string, unknown> | undefined,
): CxSectionConfig {
  if (!input) {
    throw new CxError(`sections.${sectionName} must be a table.`);
  }

  const include = expectStringArray(
    input.include,
    `sections.${sectionName}.include`,
  );
  if (include.length === 0) {
    throw new CxError(
      `sections.${sectionName}.include must contain at least one pattern.`,
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

  const normalized: CxSectionConfig = {
    include,
    exclude: expectStringArray(
      input.exclude,
      `sections.${sectionName}.exclude`,
      [],
    ),
  };

  if (style !== undefined) {
    normalized.style = style;
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

export async function loadCxConfig(configPath: string): Promise<CxConfig> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseToml(raw) as CxConfigInput;
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
  const repomix = parsed.repomix ?? {};
  const files = parsed.files ?? {};
  const dedup = parsed.dedup ?? {};
  const manifest = parsed.manifest ?? {};
  const checksums = parsed.checksums ?? {};
  const assets = parsed.assets ?? {};
  const sectionsInput = parsed.sections;

  if (
    !sectionsInput ||
    typeof sectionsInput !== "object" ||
    Object.keys(sectionsInput).length === 0
  ) {
    throw new CxError("sections must define at least one section.");
  }

  const sections: Record<string, CxSectionConfig> = {};
  for (const [sectionName, sectionValue] of Object.entries(sectionsInput)) {
    if (RESERVED_SECTION_NAMES.has(sectionName)) {
      throw new CxError(
        `sections.${sectionName} uses a reserved section name.`,
      );
    }
    sections[sectionName] = normalizeSection(sectionName, sectionValue);
  }

  return {
    schemaVersion: 1,
    projectName,
    sourceRoot,
    outputDir,
    repomix: {
      style: expectEnum(
        repomix.style,
        "repomix.style",
        VALID_STYLES,
        DEFAULT_CONFIG_VALUES.repomix.style,
      ),
      compress: expectBoolean(
        repomix.compress,
        "repomix.compress",
        DEFAULT_CONFIG_VALUES.repomix.compress,
      ),
      removeComments: expectBoolean(
        repomix.remove_comments,
        "repomix.remove_comments",
        DEFAULT_CONFIG_VALUES.repomix.removeComments,
      ),
      removeEmptyLines: expectBoolean(
        repomix.remove_empty_lines,
        "repomix.remove_empty_lines",
        DEFAULT_CONFIG_VALUES.repomix.removeEmptyLines,
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
      exclude: expectStringArray(
        files.exclude,
        "files.exclude",
        DEFAULT_CONFIG_VALUES.files.exclude,
      ),
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
      mode: expectEnum(
        dedup.mode,
        "dedup.mode",
        VALID_DEDUP_MODES,
        DEFAULT_CONFIG_VALUES.dedup.mode,
      ),
      order: expectEnum(
        dedup.order,
        "dedup.order",
        new Set(["config", "lexical"]),
        DEFAULT_CONFIG_VALUES.dedup.order,
      ),
    },
    manifest: {
      format: "toon",
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
    },
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
    assets: {
      include: expectStringArray(
        assets.include,
        "assets.include",
        DEFAULT_CONFIG_VALUES.assets.include,
      ),
      exclude: expectStringArray(
        assets.exclude,
        "assets.exclude",
        DEFAULT_CONFIG_VALUES.assets.exclude,
      ),
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
    },
    sections,
  };
}
