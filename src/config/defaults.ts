import { DEFAULT_LIST_DISPLAY_CONFIG } from "./display.js";
import type { CxConfig, CxStyle, CxUserConfig } from "./types.js";

export const DEFAULT_STYLE: CxStyle = "xml";

export const DEFAULT_BEHAVIOR_VALUES = {
  repomixMissingExtension: "warn" as const,
  configDuplicateEntry: "fail" as const,
};

export const DEFAULT_CONFIG_TEMPLATE = `#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "myproject"
source_root = "."
output_dir = "dist/myproject-bundle"

[output.extensions]
xml = ".xml.txt"
json = ".json.txt"
markdown = ".md"
plain = ".txt"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = true

[files]
# include is intentionally empty: the VCS-controlled file list is the master base.
# Add patterns here only to pull in generated or deliberately git-ignored files.
include = []
exclude = ["node_modules/**", "dist/**", "tmp/**"]
follow_symlinks = false
unmatched = "ignore"

[dedup]
mode = "fail"
order = "config"
require_explicit_ownership = false

[manifest]
format = "json"
pretty = true
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true
include_linked_notes = false

# Set pretty = false to produce compact single-line manifests (smaller files, CI-friendly).

[handover]
include_repo_history = true
repo_history_count = 25

[mcp]
policy = "default"
audit_logging = true
enable_mutation = true

[notes]
strict_notes_mode = false
fail_on_drift_pressured_notes = false
# require_cognition_score = 80
# applies_to_sections = ["docs"]
#
# Frontmatter values support exact strings, wildcards (* and ?), and regex literals.

[notes.frontmatter.fields.target]
required = true
type = "string"
values = ["current", "backlog", "/^v[0-9]+[.][0-9]+$/"]

[notes.frontmatter.fields.tags]
required = false
type = "string_array"
values = ["/^[a-z][a-z0-9-]*$/"]

[scanner]
mode = "warn"
ids = ["reference_secrets"]
include_post_pack_artifacts = false

[checksums]
algorithm = "sha256"
file_name = "{project}.sha256"

[tokens]
encoding = "o200k_base"

[assets]
include = ["**/*.{png,jpg,jpeg,gif,webp,svg,pdf}"]
exclude = []
mode = "copy"
target_dir = "{project}-assets"
layout = "flat"

[docs]
target_dir = "{project}-docs-exports"
root_level = 1

[sections.docs]
include = ["docs/**", "notes/**", "README.md", "*.md"]
exclude = []

[sections.repo]
include = [
  ".gitignore",
  ".github/workflows/ci.yml",
  "biome.json",
  "bin/cx",
  "cx.toml",
  "scripts/**",
  "schemas/**",
  "package.json",
  "tsconfig.json",
  "tsconfig.test.json",
]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []

[sections.tests]
include = ["tests/**"]
exclude = []
`;

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
        target: {
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
