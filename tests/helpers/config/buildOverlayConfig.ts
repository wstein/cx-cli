import type {
  CxAssetsConfig,
  CxChecksumsConfig,
  CxDocsConfig,
  CxFilesConfig,
  CxManifestConfig,
  CxMcpConfig,
  CxOutputConfig,
  CxRepomixConfig,
  CxTokensConfig,
} from "../../../src/config/types.js";
import type { BuildSectionOptions } from "./buildConfig.js";

export interface BuildOverlayConfigOptions {
  extendsPath?: string;
  output?: Partial<CxOutputConfig>;
  repomix?: Partial<CxRepomixConfig> & {
    missingExtension?: "fail" | "warn";
  };
  files?: Partial<CxFilesConfig>;
  manifest?: Partial<CxManifestConfig>;
  checksums?: Partial<CxChecksumsConfig>;
  tokens?: Partial<CxTokensConfig>;
  assets?: Partial<CxAssetsConfig>;
  docs?: Partial<CxDocsConfig>;
  mcp?: Partial<CxMcpConfig>;
  dedup?: {
    mode?: "fail" | "warn" | "first-wins";
    order?: "config" | "lexical";
  };
  behavior?: {
    configDuplicateEntry?: "fail" | "warn" | "first-wins";
  };
  sections?: Record<string, BuildSectionOptions>;
}

function addIfDefined(
  destination: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) {
    destination[key] = value;
  }
}

export function buildOverlayConfig(
  options: BuildOverlayConfigOptions = {},
): Record<string, unknown> {
  const overlay: Record<string, unknown> = {
    extends: options.extendsPath ?? "cx.toml",
  };

  if (options.output?.extensions) {
    overlay.output = {
      extensions: { ...options.output.extensions },
    };
  }

  if (options.repomix) {
    const repomix: Record<string, unknown> = {};
    addIfDefined(repomix, "style", options.repomix.style);
    addIfDefined(repomix, "show_line_numbers", options.repomix.showLineNumbers);
    addIfDefined(
      repomix,
      "include_empty_directories",
      options.repomix.includeEmptyDirectories,
    );
    addIfDefined(repomix, "security_check", options.repomix.securityCheck);
    addIfDefined(
      repomix,
      "missing_extension",
      options.repomix.missingExtension,
    );
    if (Object.keys(repomix).length > 0) {
      overlay.repomix = repomix;
    }
  }

  if (options.files) {
    const files: Record<string, unknown> = {};
    addIfDefined(files, "include", options.files.include);
    addIfDefined(files, "exclude", options.files.exclude);
    addIfDefined(files, "follow_symlinks", options.files.followSymlinks);
    addIfDefined(files, "unmatched", options.files.unmatched);
    if (Object.keys(files).length > 0) {
      overlay.files = files;
    }
  }

  if (options.dedup) {
    overlay.dedup = {
      ...(options.dedup.mode !== undefined ? { mode: options.dedup.mode } : {}),
      ...(options.dedup.order !== undefined
        ? { order: options.dedup.order }
        : {}),
    };
  }

  if (options.manifest) {
    const manifest: Record<string, unknown> = {};
    addIfDefined(manifest, "pretty", options.manifest.pretty);
    addIfDefined(
      manifest,
      "include_file_sha256",
      options.manifest.includeFileSha256,
    );
    addIfDefined(
      manifest,
      "include_output_sha256",
      options.manifest.includeOutputSha256,
    );
    addIfDefined(
      manifest,
      "include_output_spans",
      options.manifest.includeOutputSpans,
    );
    addIfDefined(
      manifest,
      "include_source_metadata",
      options.manifest.includeSourceMetadata,
    );
    addIfDefined(
      manifest,
      "include_linked_notes",
      options.manifest.includeLinkedNotes,
    );
    if (Object.keys(manifest).length > 0) {
      overlay.manifest = manifest;
    }
  }

  if (options.checksums) {
    const checksums: Record<string, unknown> = {};
    addIfDefined(checksums, "file_name", options.checksums.fileName);
    if (Object.keys(checksums).length > 0) {
      overlay.checksums = checksums;
    }
  }

  if (options.tokens) {
    overlay.tokens = {
      ...(options.tokens.encoding !== undefined
        ? { encoding: options.tokens.encoding }
        : {}),
    };
  }

  if (options.assets) {
    const assets: Record<string, unknown> = {};
    addIfDefined(assets, "include", options.assets.include);
    addIfDefined(assets, "exclude", options.assets.exclude);
    addIfDefined(assets, "mode", options.assets.mode);
    addIfDefined(assets, "target_dir", options.assets.targetDir);
    addIfDefined(assets, "layout", options.assets.layout);
    if (Object.keys(assets).length > 0) {
      overlay.assets = assets;
    }
  }

  if (options.docs) {
    const docs: Record<string, unknown> = {};
    addIfDefined(docs, "target_dir", options.docs.targetDir);
    addIfDefined(docs, "root_level", options.docs.rootLevel);
    if (Object.keys(docs).length > 0) {
      overlay.docs = docs;
    }
  }

  if (options.behavior?.configDuplicateEntry !== undefined) {
    overlay.config = {
      duplicate_entry: options.behavior.configDuplicateEntry,
    };
  }

  if (options.mcp) {
    const mcp: Record<string, unknown> = {};
    addIfDefined(mcp, "policy", options.mcp.policy);
    addIfDefined(mcp, "audit_logging", options.mcp.auditLogging);
    if (Object.keys(mcp).length > 0) {
      overlay.mcp = mcp;
    }
  }

  if (options.sections) {
    const sections: Record<string, unknown> = {};
    for (const [name, section] of Object.entries(options.sections)) {
      const nextSection: Record<string, unknown> = {};
      addIfDefined(nextSection, "include", section.include);
      addIfDefined(nextSection, "exclude", section.exclude);
      addIfDefined(nextSection, "style", section.style);
      addIfDefined(nextSection, "priority", section.priority);
      addIfDefined(nextSection, "catch_all", section.catchAll);
      sections[name] = nextSection;
    }
    overlay.sections = sections;
  }

  return overlay;
}
