import type { CxConfig, CxStyle } from "./types.js";

export const DEFAULT_STYLE: CxStyle = "xml";

export const DEFAULT_CONFIG_TEMPLATE = `schema_version = 1
project_name = "myproject"
source_root = "."
output_dir = "dist/myproject-bundle"

[repomix]
style = "xml"
compress = false
remove_comments = false
remove_empty_lines = false
show_line_numbers = false
include_empty_directories = false
security_check = true

[files]
exclude = [".git/**", "node_modules/**", "dist/**"]
follow_symlinks = false
unmatched = "ignore"

[dedup]
mode = "fail"
order = "config"

[manifest]
format = "json"
pretty = true
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = false
include_source_metadata = true

# Set pretty = false to produce compact single-line manifests (smaller files, CI-friendly).

[checksums]
algorithm = "sha256"
file_name = "{project}.sha256"

[tokens]
algorithm = "chars_div_4"

[display.list]
bytes_warm = 4096
bytes_hot = 65536
tokens_warm = 512
tokens_hot = 2048
mtime_warm_minutes = 60
mtime_hot_hours = 24
time_palette = [255, 254, 253, 252, 251, 250, 249, 248, 247, 246]

[assets]
include = ["**/*.{png,jpg,jpeg,gif,webp,svg,pdf}"]
exclude = []
mode = "copy"
target_dir = "{project}-assets"

[sections.docs]
include = ["docs/**", "README.md", "*.md"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []
`;

export const DEFAULT_CONFIG_VALUES: Omit<
  CxConfig,
  "schemaVersion" | "projectName" | "sourceRoot" | "outputDir" | "sections"
> = {
  repomix: {
    style: "xml",
    compress: false,
    removeComments: false,
    removeEmptyLines: false,
    showLineNumbers: false,
    includeEmptyDirectories: false,
    securityCheck: true,
  },
  files: {
    exclude: [".git/**", "node_modules/**", "dist/**"],
    followSymlinks: false,
    unmatched: "ignore",
  },
  dedup: {
    mode: "fail",
    order: "config",
  },
  manifest: {
    format: "json",
    pretty: true,
    includeFileSha256: true,
    includeOutputSha256: true,
    includeOutputSpans: false,
    includeSourceMetadata: true,
  },
  checksums: {
    algorithm: "sha256",
    fileName: "{project}.sha256",
  },
  tokens: {
    algorithm: "chars_div_4",
  },
  display: {
    list: {
      bytesWarm: 4096,
      bytesHot: 65536,
      tokensWarm: 512,
      tokensHot: 2048,
      mtimeWarmMinutes: 60,
      mtimeHotHours: 24,
      timePalette: [255, 254, 253, 252, 251, 250, 249, 248, 247, 246],
    },
  },
  assets: {
    include: ["**/*.{png,jpg,jpeg,gif,webp,svg,pdf}"],
    exclude: [],
    mode: "copy",
    targetDir: "{project}-assets",
  },
};
