import { DEFAULT_LIST_DISPLAY_CONFIG } from "./display.js";
import type { CxConfig, CxStyle, CxUserConfig } from "./types.js";

export const DEFAULT_STYLE: CxStyle = "xml";

export const DEFAULT_BEHAVIOR_VALUES = {
  repomixMissingExtension: "warn" as const,
  configDuplicateEntry: "fail" as const,
};

export const DEFAULT_CONFIG_VALUES: Omit<
  CxConfig,
  | "schemaVersion"
  | "projectName"
  | "sourceRoot"
  | "outputDir"
  | "sections"
  | "behaviorSources"
> = {
  output: {
    extensions: {
      xml: ".xml.txt",
      json: ".json.txt",
      markdown: ".md",
      plain: ".txt",
    },
  },
  repomix: {
    style: "xml",
    showLineNumbers: false,
    includeEmptyDirectories: false,
    securityCheck: true,
  },
  files: {
    include: [],
    exclude: ["node_modules/**", "dist/**", "tmp/**"],
    followSymlinks: false,
    unmatched: "ignore",
  },
  dedup: {
    mode: "fail",
    order: "config",
    requireExplicitOwnership: false,
  },
  manifest: {
    format: "json",
    pretty: true,
    includeFileSha256: true,
    includeOutputSha256: true,
    includeOutputSpans: true,
    includeSourceMetadata: true,
    includeLinkedNotes: false,
  },
  handover: {
    includeRepoHistory: true,
    repoHistoryCount: 25,
  },
  notes: {
    strictNotesMode: false,
    failOnDriftPressuredNotes: false,
    appliesToSections: [],
    frontmatter: {
      fields: {
        id: {
          required: true,
          type: "string",
          values: [],
        },
        aliases: { required: false, type: "string_array", values: [] },
        tags: { required: false, type: "string_array", values: [] },
        title: { required: false, type: "string", values: [] },
      },
    },
  },
  scanner: {
    mode: "warn",
    ids: ["reference_secrets"],
    includePostPackArtifacts: false,
  },
  checksums: {
    algorithm: "sha256",
    fileName: "{project}.sha256",
  },
  tokens: {
    encoding: "o200k_base",
  },
  assets: {
    include: ["**/*.{png,jpg,jpeg,gif,webp,svg,pdf}"],
    exclude: [],
    mode: "copy",
    targetDir: "{project}-assets",
    layout: "flat",
  },
  docs: {
    targetDir: "{project}-docs-exports",
    rootLevel: 1,
    logOutput: undefined,
  },
  behavior: {
    ...DEFAULT_BEHAVIOR_VALUES,
  },
  mcp: {
    policy: "default",
    auditLogging: true,
    enableMutation: true,
  },
};

export const DEFAULT_USER_CONFIG_PATH = "~/.config/cx/cx.toml";

export const DEFAULT_USER_CONFIG_TEMPLATE = `[display.list]
bytes_warm = 4096
bytes_hot = 65536
tokens_warm = 512
tokens_hot = 2048
mtime_warm_minutes = 60
mtime_hot_hours = 24
time_palette = [255, 254, 253, 252, 251, 250, 249, 248, 247, 246]
`;

export const DEFAULT_USER_CONFIG_VALUES: CxUserConfig = {
  display: {
    list: {
      ...DEFAULT_LIST_DISPLAY_CONFIG,
      timePalette: [...DEFAULT_LIST_DISPLAY_CONFIG.timePalette],
    },
  },
};
