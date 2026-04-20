import { DEFAULT_BEHAVIOR_VALUES } from "../../../src/config/defaults.js";
import type {
  CxAssetsConfig,
  CxChecksumsConfig,
  CxConfig,
  CxFilesConfig,
  CxHandoverConfig,
  CxManifestConfig,
  CxMcpConfig,
  CxNotesConfig,
  CxOutputConfig,
  CxRepomixConfig,
  CxScannerConfig,
  CxSectionConfig,
  CxTokensConfig,
} from "../../../src/config/types.js";

export interface BuildSectionOptions {
  include?: string[];
  exclude?: string[];
  style?: CxSectionConfig["style"];
  priority?: number;
  catchAll?: boolean;
}

export interface BuildConfigOptions {
  projectName?: string;
  sourceRoot?: string;
  outputDir?: string;
  output?: Partial<CxOutputConfig>;
  repomix?: Partial<CxRepomixConfig>;
  files?: Partial<CxFilesConfig>;
  manifest?: Partial<CxManifestConfig>;
  handover?: Partial<CxHandoverConfig>;
  notes?: Partial<CxNotesConfig>;
  scanner?: Partial<CxScannerConfig>;
  checksums?: Partial<CxChecksumsConfig>;
  tokens?: Partial<CxTokensConfig>;
  assets?: Partial<CxAssetsConfig>;
  mcp?: Partial<CxMcpConfig>;
  sections?: Record<string, BuildSectionOptions>;
  dedup?: Partial<CxConfig["dedup"]>;
}

function buildSections(
  sections: Record<string, BuildSectionOptions> | undefined,
): Record<string, CxSectionConfig> {
  const defaults: Record<string, BuildSectionOptions> = {
    docs: {
      include: ["README.md", "docs/**"],
      exclude: [],
    },
    src: {
      include: ["src/**"],
      exclude: [],
    },
  };

  const resolved = sections ?? defaults;
  const entries = Object.entries(resolved);
  const built: Record<string, CxSectionConfig> = {};

  for (const [name, section] of entries) {
    const builtSection: CxSectionConfig = {
      exclude: [...(section.exclude ?? [])],
    };

    if (section.style !== undefined) {
      builtSection.style = section.style;
    }

    if (section.priority !== undefined) {
      builtSection.priority = section.priority;
    }

    if (section.catchAll !== undefined) {
      builtSection.catch_all = section.catchAll;
    }

    if (!section.catchAll) {
      builtSection.include = [...(section.include ?? [])];
    }

    built[name] = builtSection;
  }

  return built;
}

export function buildConfig(options: BuildConfigOptions = {}): CxConfig {
  const projectName = options.projectName ?? "demo";
  const sourceRoot = options.sourceRoot ?? ".";
  const outputDir = options.outputDir ?? `dist/${projectName}-bundle`;

  return {
    schemaVersion: 1,
    projectName,
    sourceRoot,
    outputDir,
    output: {
      extensions: {
        xml: ".xml.txt",
        json: ".json.txt",
        markdown: ".md",
        plain: ".txt",
        ...(options.output?.extensions ?? {}),
      },
    },
    repomix: {
      style: "xml",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: false,
      ...options.repomix,
    },
    files: {
      include: [],
      exclude: ["dist/**"],
      followSymlinks: false,
      unmatched: "ignore",
      ...options.files,
    },
    dedup: {
      mode: "fail",
      order: "config",
      requireExplicitOwnership: false,
      ...options.dedup,
    },
    manifest: {
      format: "json",
      pretty: true,
      includeFileSha256: true,
      includeOutputSha256: true,
      includeOutputSpans: true,
      includeSourceMetadata: true,
      includeLinkedNotes: false,
      ...options.manifest,
    },
    handover: {
      includeRepoHistory: false,
      repoHistoryCount: 25,
      ...options.handover,
    },
    notes: {
      strictNotesMode: false,
      failOnDriftPressuredNotes: false,
      appliesToSections: [],
      ...options.notes,
    },
    scanner: {
      mode: "warn",
      ...options.scanner,
    },
    checksums: {
      algorithm: "sha256",
      fileName: `${projectName}.sha256`,
      ...options.checksums,
    },
    tokens: {
      encoding: "o200k_base",
      ...options.tokens,
    },
    assets: {
      include: ["**/*.png"],
      exclude: [],
      mode: "copy",
      targetDir: `${projectName}-assets`,
      layout: "flat",
      ...options.assets,
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_VALUES,
    },
    behaviorSources: {
      dedupMode: "compiled default",
      repomixMissingExtension: "compiled default",
      configDuplicateEntry: "compiled default",
      assetsLayout: "compiled default",
    },
    mcp: {
      policy: "default",
      auditLogging: true,
      ...options.mcp,
    },
    sections: buildSections(options.sections),
  };
}
