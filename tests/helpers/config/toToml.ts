import type { CxConfig } from "../../../src/config/types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatTomlValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => formatTomlValue(entry)).join(", ")}]`;
  }

  throw new Error(`Unsupported TOML value: ${String(value)}`);
}

function sortKeys(keys: string[], path: string[]): string[] {
  const rootOrder = [
    "schema_version",
    "project_name",
    "source_root",
    "output_dir",
    "output",
    "repomix",
    "files",
    "dedup",
    "manifest",
    "handover",
    "notes",
    "scanner",
    "checksums",
    "tokens",
    "assets",
    "docs",
    "config",
    "mcp",
    "sections",
  ];
  const sectionOrder = ["include", "exclude", "style", "priority", "catch_all"];
  const commonOrder = [
    "xml",
    "json",
    "markdown",
    "plain",
    "style",
    "show_line_numbers",
    "include_empty_directories",
    "security_check",
    "missing_extension",
    "include",
    "exclude",
    "follow_symlinks",
    "unmatched",
    "mode",
    "order",
    "require_explicit_ownership",
    "format",
    "pretty",
    "include_file_sha256",
    "include_output_sha256",
    "include_output_spans",
    "include_source_metadata",
    "include_linked_notes",
    "include_repo_history",
    "repo_history_count",
    "require_cognition_score",
    "strict_notes_mode",
    "fail_on_drift_pressured_notes",
    "applies_to_sections",
    "profiles",
    "mode",
    "algorithm",
    "file_name",
    "encoding",
    "target_dir",
    "layout",
    "duplicate_entry",
    "policy",
    "audit_logging",
    "extensions",
  ];

  const order =
    path.length === 0
      ? rootOrder
      : path[0] === "sections"
        ? sectionOrder
        : commonOrder;

  return [...keys].sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });
}

function emitTable(
  lines: string[],
  path: string[],
  value: Record<string, unknown>,
): void {
  const entries = sortKeys(Object.keys(value), path).map(
    (key) => [key, value[key]] as const,
  );
  const scalarEntries = entries.filter(([, entry]) => !isPlainObject(entry));
  const tableEntries = entries.filter(([, entry]) => isPlainObject(entry));

  if (path.length > 0) {
    lines.push(`[${path.join(".")}]`);
  }

  for (const [key, entry] of scalarEntries) {
    lines.push(`${key} = ${formatTomlValue(entry)}`);
  }

  for (const [key, entry] of tableEntries) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    emitTable(lines, [...path, key], entry as Record<string, unknown>);
  }
}

function normalizeRuntimeConfig(config: CxConfig): Record<string, unknown> {
  const repomix: Record<string, unknown> = {
    style: config.repomix.style,
    show_line_numbers: config.repomix.showLineNumbers,
    include_empty_directories: config.repomix.includeEmptyDirectories,
    security_check: config.repomix.securityCheck,
  };

  if (config.behavior.repomixMissingExtension !== undefined) {
    repomix.missing_extension = config.behavior.repomixMissingExtension;
  }

  const sections: Record<string, unknown> = {};
  for (const [name, section] of Object.entries(config.sections)) {
    sections[name] = {
      ...(section.include !== undefined ? { include: section.include } : {}),
      exclude: section.exclude,
      ...(section.style !== undefined ? { style: section.style } : {}),
      ...(section.priority !== undefined ? { priority: section.priority } : {}),
      ...(section.catch_all !== undefined
        ? { catch_all: section.catch_all }
        : {}),
    };
  }

  return {
    schema_version: config.schemaVersion,
    project_name: config.projectName,
    source_root: config.sourceRoot,
    output_dir: config.outputDir,
    output: {
      extensions: { ...config.output.extensions },
    },
    repomix,
    files: {
      include: config.files.include,
      exclude: config.files.exclude,
      follow_symlinks: config.files.followSymlinks,
      unmatched: config.files.unmatched,
    },
    dedup: {
      mode: config.dedup.mode,
      order: config.dedup.order,
      require_explicit_ownership: config.dedup.requireExplicitOwnership,
    },
    manifest: {
      format: config.manifest.format,
      pretty: config.manifest.pretty,
      include_file_sha256: config.manifest.includeFileSha256,
      include_output_sha256: config.manifest.includeOutputSha256,
      include_output_spans: config.manifest.includeOutputSpans,
      include_source_metadata: config.manifest.includeSourceMetadata,
      include_linked_notes: config.manifest.includeLinkedNotes,
    },
    handover: {
      include_repo_history: config.handover.includeRepoHistory,
      repo_history_count: config.handover.repoHistoryCount,
    },
    notes: {
      ...(config.notes.requireCognitionScore !== undefined
        ? { require_cognition_score: config.notes.requireCognitionScore }
        : {}),
      strict_notes_mode: config.notes.strictNotesMode,
      fail_on_drift_pressured_notes: config.notes.failOnDriftPressuredNotes,
      ...(config.notes.appliesToSections.length > 0
        ? { applies_to_sections: config.notes.appliesToSections }
        : {}),
      frontmatter: {
        fields: Object.fromEntries(
          Object.entries(config.notes.frontmatter.fields).map(
            ([fieldName, rule]) => [
              fieldName,
              {
                required: rule.required,
                type: rule.type,
                values: rule.values,
              },
            ],
          ),
        ),
      },
    },
    scanner: {
      mode: config.scanner.mode,
      ids: config.scanner.ids,
      include_post_pack_artifacts: config.scanner.includePostPackArtifacts,
    },
    checksums: {
      algorithm: config.checksums.algorithm,
      file_name: config.checksums.fileName,
    },
    tokens: {
      encoding: config.tokens.encoding,
    },
    assets: {
      include: config.assets.include,
      exclude: config.assets.exclude,
      mode: config.assets.mode,
      target_dir: config.assets.targetDir,
      layout: config.assets.layout,
    },
    docs: {
      target_dir: config.docs.targetDir,
      root_level: config.docs.rootLevel,
    },
    config: {
      duplicate_entry: config.behavior.configDuplicateEntry,
    },
    mcp: {
      policy: config.mcp.policy,
      audit_logging: config.mcp.auditLogging,
    },
    sections,
  };
}

export function toToml(config: Record<string, unknown> | CxConfig): string {
  const document =
    "schemaVersion" in config
      ? normalizeRuntimeConfig(config as unknown as CxConfig)
      : config;
  const lines: string[] = [];
  emitTable(lines, [], document);
  return `${lines.join("\n")}\n`;
}
