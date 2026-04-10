Below is a concrete deliverable for **`cx`**.

It is designed as a **separate tool** that depends on Repomix as a library, uses Repomix’s documented high-level and low-level library entry points, supports standard Repomix output styles, and keeps generated section files fully compatible with normal Repomix consumers. Repomix’s own docs show `runCli(...)` library usage, lower-level APIs such as `searchFiles`, `collectFiles`, `processFiles`, and support for output styles including `xml`, `markdown`, `json`, and `plain`. The uploaded snapshot also shows Repomix’s internal architecture split across CLI, config, file processing, output styles, and packager modules, which is a good fit for `cx` to sit above rather than inside.    

---

# CX Architecture Specification

## 1. Purpose

`cx` is a deterministic **context bundler** built on top of Repomix.

Its responsibilities are:

* split a project into multiple **non-overlapping sections**
* render one **standard Repomix output file per section**
* copy selected **binary/raw assets** into the bundle
* generate a **manifest** and **sha256 checksum file**
* support **extract**, **verify**, **validate**, and **list**
* use **its own TOML config**
* never shell out to `repomix`
* never patch or fork Repomix

## 2. Non-goals

`cx` v1 does not:

* replace Repomix
* invent a new packed text format for source sections
* rely on `.repomix.config.*`
* guess file boundaries by scanning emitted text
* mutate Repomix renderer output
* support overlapping section membership by default

## 3. Design principles

### 3.1 Repomix stays authoritative for section outputs

Each section output file is produced through Repomix library APIs and remains standard Repomix output.

### 3.2 `cx` owns orchestration

`cx` decides:

* which files belong to which section
* which files are raw assets
* how bundle metadata is represented
* how integrity is checked
* how extraction is performed

### 3.3 Determinism first

Given the same source tree, config, and Repomix version, `cx bundle` should produce the same:

* section membership
* section output names
* manifest ordering
* checksum file ordering

### 3.4 No ambiguous overlap

A file may belong to **at most one text section**. If not, fail by default.

### 3.5 Explicit metadata

No post-hoc guessing of output spans. If line spans are recorded, they must be computed during controlled rendering/assembly.

---

## 4. System context

### Inputs

* source repository path
* `cx.toml`
* optional CLI overrides

### Outputs

A bundle directory like:

```text
myproject-bundle/
  myproject-repomix-docs.xml.txt
  myproject-repomix-src.xml.txt
  myproject-repomix-test.xml.txt
  myproject-assets/
    images/
      logo.png
  myproject-manifest.toon
  myproject.sha256
```

### External dependency

* `repomix` Node package, used as a dependency and library, not as a subprocess. Repomix’s library integration points are already documented in its own docs. 

---

## 5. High-level architecture

```text
cx CLI
  -> config loader
  -> planner
       -> source file discovery
       -> text/binary classification
       -> section membership resolution
       -> overlap detection
       -> bundle plan
  -> repomix facade
       -> render section outputs via Repomix library
       -> optional output span tracking
  -> asset copier
  -> manifest builder
  -> checksum writer
  -> validator / verifier / extractor
```

### Main subsystems

```text
cli/
config/
planning/
repomix/
manifest/
assets/
extract/
verify/
shared/
```

---

## 6. Core data flow

### `bundle`

1. Load and validate `cx.toml`
2. Discover candidate files under source root
3. Apply global excludes
4. Classify files as text or asset
5. Resolve section membership
6. Fail on overlap or unresolved required files
7. Render each text section through Repomix library
8. Copy assets as raw files
9. Build manifest
10. Write `sha256` sidecar
11. Validate finished bundle

### `extract`

1. Read manifest
2. Validate bundle structure
3. Parse each section output using style-specific extractor
4. Restore source files
5. Copy assets back
6. Optionally verify hashes during restore

### `verify`

1. Parse manifest
2. Recompute hashes
3. Verify section outputs and assets exist
4. Verify manifest-to-files consistency
5. Optionally verify extracted contents against original tree

---

## 7. Integration boundary with Repomix

`cx` integrates with Repomix through a thin adapter.

### Required capabilities from Repomix

* library entry point for higher-level operation, such as `runCli(...)`
* lower-level APIs such as `searchFiles`, `collectFiles`, `processFiles`
* supported output styles: `xml`, `markdown`, `json`, `plain`  

### Preferred integration mode

Use lower-level exports where possible:

* `searchFiles`
* `collectFiles`
* `processFiles`

This gives `cx` control over section planning while still relying on Repomix for compatible output rendering. Repomix’s release notes and library guide indicate expanded core exports for direct library use.  

### Adapter contract

`cx` never imports deep private Repomix files directly.
It only uses public package exports.

---

# CX Implementation Specification

## 8. Repository layout for `cx`

```text
cx/
  package.json
  tsconfig.json
  src/
    index.ts
    cli/
      main.ts
      parseArgs.ts
      exitCodes.ts
      commands/
        bundleCommand.ts
        extractCommand.ts
        verifyCommand.ts
        validateCommand.ts
        listCommand.ts
        inspectCommand.ts
        initCommand.ts
    config/
      cxConfigTypes.ts
      cxConfigSchema.ts
      cxConfigLoad.ts
      cxConfigDefaults.ts
    planning/
      discoverFiles.ts
      classifyFiles.ts
      resolveSections.ts
      detectOverlaps.ts
      buildBundlePlan.ts
      stableSort.ts
    repomix/
      repomixFacade.ts
      repomixOptionsMap.ts
      renderSection.ts
      renderSpans.ts
    manifest/
      manifestTypes.ts
      manifestBuilder.ts
      toonWriter.ts
      sha256Writer.ts
    assets/
      copyAssets.ts
      restoreAssets.ts
    extract/
      extractBundle.ts
      parsers/
        parseXmlRepomix.ts
        parseMarkdownRepomix.ts
        parseJsonRepomix.ts
        parsePlainRepomix.ts
    verify/
      validateBundle.ts
      verifyBundle.ts
      verifyHashes.ts
      verifyManifest.ts
    shared/
      fs.ts
      paths.ts
      hashing.ts
      glob.ts
      mime.ts
      errors.ts
      result.ts
  tests/
    cli/
    config/
    planning/
    repomix/
    manifest/
    extract/
    verify/
    fixtures/
```

---

## 9. Phased implementation plan

## Phase 1

* local source path only
* styles: `xml`, `markdown`
* text sections
* asset copy
* manifest toon
* sha256 sidecar
* commands: `bundle`, `list`, `validate`, `verify`
* strict overlap fail

## Phase 2

* `extract`
* `json` and `plain` support
* line span support
* richer metadata
* `inspect`

## Phase 3

* remote repositories
* optional compression
* include-diffs or other advanced Repomix features if exposed and stable
* parallel rendering and extraction optimizations

---

## 10. Section planning algorithm

### Inputs

* source root
* global include/exclude
* section definitions
* asset rules

### Output

`BundlePlan`

### Rules

1. Discover all files under source root
2. Exclude ignored paths
3. Classify files:

   * text candidate
   * raw asset
   * skipped
4. For text candidates, evaluate section membership
5. Detect multiple matches
6. If multiple matches and dedup mode is `fail`, abort
7. Produce deterministic plan

### Membership formula

```text
section_match(file, section) =
  any(section.include) && !any(section.exclude)
```

### Overlap rule

```text
count(matching_sections(file)) <= 1
```

Else fail.

### Asset conflict rule

A file cannot be both:

* a section text member
* and an asset

Else fail.

---

## 11. Rendering model

## Section output files

Each section is rendered to one Repomix-compatible output file:

Examples:

* `myproject-repomix-docs.xml.txt`
* `myproject-repomix-src.md`
* `myproject-repomix-tests.json`

### File naming

Recommended scheme:

```text
{project}-repomix-{section}.{style-ext}
```

Mapping:

* `xml` -> `xml.txt`
* `markdown` -> `md`
* `json` -> `json`
* `plain` -> `txt`

### Output span tracking

If line spans are enabled, they are recorded during a controlled rendering stage, never guessed from regex scanning.

If exact spans cannot be computed for a style with the chosen integration method, `cx` must omit them rather than fabricate them.

---

## 12. Extraction model

### Supported extraction sources

* section text outputs
* copied raw assets

### Extraction target

* source tree reconstruction under a destination directory

### Extraction guarantees

* text files restored byte-for-byte from section entries
* raw assets restored byte-for-byte from copied bundle assets
* hashes verified if present

### Style-specific extractors

* XML parser
* Markdown parser
* JSON parser
* Plain parser

Each parser must target standard Repomix format, not a `cx` variant.

---

## 13. Validation and verification

## `validate`

Checks bundle self-consistency:

* manifest parses
* schema version supported
* output files exist
* section names unique
* assets exist
* checksum file syntax valid

## `verify`

Everything in `validate`, plus:

* hashes match actual files
* manifest file rows match real bundle contents
* optional content extraction matches manifest-declared per-file hashes

### Optional source-tree verification

```bash
cx verify myproject-bundle --against ./myproject
```

This mode compares:

* source file hash
* restored text file hash
* restored asset hash

---

# Full CX CLI Specification

## 14. Command summary

```bash
cx init
cx bundle
cx extract
cx verify
cx validate
cx list
cx inspect
cx version
cx help
```

---

## 15. `cx init`

Creates a starter `cx.toml`.

### Usage

```bash
cx init
cx init --name myproject
cx init --style xml
cx init --force
```

### Options

* `--name <name>`
* `--style <xml|markdown|json|plain>`
* `--force`
* `--stdout`

### Exit codes

* `0` success
* `2` invalid target path
* `3` file exists and `--force` not set

---

## 16. `cx bundle`

Create a bundle directory from a project.

### Usage

```bash
cx bundle
cx bundle --config cx.toml
cx bundle --source .
cx bundle --output dist/myproject-bundle
cx bundle --style xml
cx bundle --section docs
cx bundle --no-assets
cx bundle --dry-run
```

### Options

* `--config <path>`
* `--source <dir>`
* `--output <dir>`
* `--style <xml|markdown|json|plain>`
* `--section <name>` repeatable
* `--no-assets`
* `--dry-run`
* `--json`
* `--verbose`

### Behavior

* loads config
* computes bundle plan
* optionally filters to selected sections
* renders outputs
* writes manifest and checksums
* validates result

### Exit codes

* `0` success
* `2` config invalid
* `4` overlap detected
* `5` render failure
* `6` write failure
* `7` validation failure

---

## 17. `cx extract`

Restore files from a bundle.

### Usage

```bash
cx extract dist/myproject-bundle --to restored/
cx extract dist/myproject-bundle --section src --to restored/
cx extract dist/myproject-bundle --file src/index.ts --to restored/
cx extract dist/myproject-bundle --assets-only --to restored/
```

### Arguments

* `<bundle-dir>`

### Options

* `--to <dir>` required
* `--section <name>` repeatable
* `--file <path>` repeatable
* `--assets-only`
* `--verify`
* `--overwrite`
* `--json`

### Exit codes

* `0` success
* `2` invalid bundle
* `8` extraction parse failure
* `9` destination conflict
* `10` verification failure

---

## 18. `cx verify`

Verify a bundle’s integrity.

### Usage

```bash
cx verify dist/myproject-bundle
cx verify dist/myproject-bundle --against .
cx verify dist/myproject-bundle --section src
```

### Options

* `--against <source-dir>`
* `--section <name>` repeatable
* `--json`
* `--strict`

### Exit codes

* `0` success
* `2` invalid bundle
* `10` integrity failure

---

## 19. `cx validate`

Validate structure and schema without full content proof.

### Usage

```bash
cx validate dist/myproject-bundle
cx validate dist/myproject-bundle --json
```

### Exit codes

* `0` valid
* `2` invalid schema or structure

---

## 20. `cx list`

List bundle contents.

### Usage

```bash
cx list dist/myproject-bundle
cx list dist/myproject-bundle --section docs
cx list dist/myproject-bundle --assets
cx list dist/myproject-bundle --format table
```

### Options

* `--section <name>`
* `--assets`
* `--files`
* `--format <text|json|table>`
* `--long`

---

## 21. `cx inspect`

Show the computed plan without writing files.

### Usage

```bash
cx inspect
cx inspect --config cx.toml
cx inspect --section src
cx inspect --json
```

### Output

* section members
* overlaps
* unmatched files
* assets
* planned output names

---

## 22. `cx version`

Show:

* `cx` version
* Node version
* Repomix package version resolved at runtime

---

# CX TOML Schema

## 23. Top-level schema

```toml
schema_version = 1
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
exclude = [
  ".git/**",
  "node_modules/**",
  "dist/**"
]
follow_symlinks = false
unmatched = "ignore" # ignore | fail

[dedup]
mode = "fail"        # fail | first-wins
order = "config"     # config | lexical

[manifest]
format = "toon"
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true

[checksums]
algorithm = "sha256"
file_name = "{project}.sha256"

[assets]
include = ["**/*.{png,jpg,jpeg,gif,webp,svg,pdf}"]
exclude = []
mode = "copy"        # copy | ignore | fail
target_dir = "{project}-assets"

[sections.docs]
include = ["docs/**", "README.md", "*.md"]
exclude = ["docs/tmp/**"]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []

[sections.tests]
include = ["tests/**", "spec/**"]
exclude = []
```

---

## 24. TOML schema rules

### Required

* `schema_version`
* `project_name`
* `source_root`
* at least one section

### Defaults

* `repomix.style = "xml"`
* `dedup.mode = "fail"`
* `manifest.format = "toon"`
* `checksums.algorithm = "sha256"`
* `files.unmatched = "ignore"`
* `assets.mode = "copy"`

### Constraints

* section names must be unique
* `include` cannot be empty
* no reserved section names: `manifest`, `assets`, `bundle`
* `project_name` must be filesystem-safe
* per-section style defaults to global style

---

# Manifest Schema

## 25. Manifest design goals

The manifest is the authoritative bundle description.

It must describe:

* bundle metadata
* tool versions
* section outputs
* raw assets
* packed file list
* optional render spans
* hashes
* deterministic ordering

You asked specifically for **TOON table format for file list**, so the file list should be represented as a proper table section.

---

## 26. Manifest logical schema

### Root blocks

* `bundle`
* `tooling`
* `settings`
* `sections`
* `assets`
* `files` table

---

## 27. Example `myproject-manifest.toon`

```toon
bundle
  schema_version 1
  bundle_version 1
  project_name myproject
  source_root .
  output_dir dist/myproject-bundle
  created_at 2026-04-10T20:45:00Z

tooling
  cx_version 0.1.0
  repomix_version 1.13.1
  checksum_algorithm sha256

settings
  global_style xml
  dedup_mode fail
  unmatched ignore
  assets_mode copy

section docs
  style xml
  output_file myproject-repomix-docs.xml.txt
  output_sha256 22c6...
  file_count 12

section src
  style xml
  output_file myproject-repomix-src.xml.txt
  output_sha256 aa92...
  file_count 84

section tests
  style xml
  output_file myproject-repomix-tests.xml.txt
  output_sha256 ff17...
  file_count 23

asset
  source_path images/logo.png
  stored_path myproject-assets/images/logo.png
  sha256 12ab...
  size_bytes 48921
  media_type image/png

table files
  path kind section stored_in sha256 size_bytes media_type output_file output_start_line output_end_line
  README.md text docs packed 1a2b... 1932 text/markdown myproject-repomix-docs.xml.txt 58 124
  docs/intro.md text docs packed 3c4d... 8123 text/markdown myproject-repomix-docs.xml.txt 125 244
  src/index.ts text src packed abcd... 833 text/typescript myproject-repomix-src.xml.txt 211 267
  tests/index.test.ts text tests packed ef01... 1199 text/typescript myproject-repomix-tests.xml.txt 90 141
  images/logo.png asset - copied 12ab... 48921 image/png - - -
end
```

---

## 28. File table columns

Required columns:

* `path`
* `kind` = `text | asset`
* `section`
* `stored_in` = `packed | copied`
* `sha256`
* `size_bytes`
* `media_type`

Optional columns:

* `output_file`
* `output_start_line`
* `output_end_line`
* `token_count`
* `char_count`
* `language`
* `notes`

### Column rules

* asset rows use `section = -`
* asset rows use `output_file = -`
* missing spans use `-`

---

## 29. Checksum sidecar format

Example `myproject.sha256`:

```text
22c6...  myproject-repomix-docs.xml.txt
aa92...  myproject-repomix-src.xml.txt
ff17...  myproject-repomix-tests.xml.txt
12ab...  myproject-assets/images/logo.png
0baf...  myproject-manifest.toon
```

Ordering must be lexical by relative path.

---

# TypeScript Module Skeleton

## 30. Public types

```ts
// src/config/cxConfigTypes.ts
export type CxStyle = 'xml' | 'markdown' | 'json' | 'plain';
export type CxDedupMode = 'fail' | 'first-wins';
export type CxUnmatchedMode = 'ignore' | 'fail';
export type CxAssetsMode = 'copy' | 'ignore' | 'fail';

export interface CxSectionConfig {
  include: string[];
  exclude?: string[];
  style?: CxStyle;
}

export interface CxRepomixConfig {
  style: CxStyle;
  compress?: boolean;
  removeComments?: boolean;
  removeEmptyLines?: boolean;
  showLineNumbers?: boolean;
  includeEmptyDirectories?: boolean;
  securityCheck?: boolean;
}

export interface CxFilesConfig {
  exclude?: string[];
  followSymlinks?: boolean;
  unmatched?: CxUnmatchedMode;
}

export interface CxDedupConfig {
  mode?: CxDedupMode;
  order?: 'config' | 'lexical';
}

export interface CxManifestConfig {
  format?: 'toon';
  includeFileSha256?: boolean;
  includeOutputSha256?: boolean;
  includeOutputSpans?: boolean;
  includeSourceMetadata?: boolean;
}

export interface CxChecksumsConfig {
  algorithm?: 'sha256';
  fileName?: string;
}

export interface CxAssetsConfig {
  include?: string[];
  exclude?: string[];
  mode?: CxAssetsMode;
  targetDir?: string;
}

export interface CxConfig {
  schemaVersion: 1;
  projectName: string;
  sourceRoot: string;
  outputDir: string;
  repomix: CxRepomixConfig;
  files?: CxFilesConfig;
  dedup?: CxDedupConfig;
  manifest?: CxManifestConfig;
  checksums?: CxChecksumsConfig;
  assets?: CxAssetsConfig;
  sections: Record<string, CxSectionConfig>;
}
```

---

## 31. Planning types

```ts
// src/planning/buildBundlePlan.ts
export type PlannedFileKind = 'text' | 'asset';

export interface PlannedSourceFile {
  relativePath: string;
  absolutePath: string;
  kind: PlannedFileKind;
  mediaType: string;
  sizeBytes: number;
  matchedSection?: string;
}

export interface PlannedSection {
  name: string;
  style: 'xml' | 'markdown' | 'json' | 'plain';
  outputFile: string;
  files: PlannedSourceFile[];
}

export interface PlannedAsset {
  relativePath: string;
  absolutePath: string;
  storedPath: string;
  mediaType: string;
  sizeBytes: number;
}

export interface BundlePlan {
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  sections: PlannedSection[];
  assets: PlannedAsset[];
  unmatchedFiles: string[];
}
```

---

## 32. Manifest types

```ts
// src/manifest/manifestTypes.ts
export interface OutputSpan {
  path: string;
  outputFile: string;
  startLine?: number;
  endLine?: number;
  startOffset?: number;
  endOffset?: number;
}

export interface SectionOutputRecord {
  name: string;
  style: 'xml' | 'markdown' | 'json' | 'plain';
  outputFile: string;
  outputSha256: string;
  fileCount: number;
}

export interface AssetRecord {
  sourcePath: string;
  storedPath: string;
  sha256: string;
  sizeBytes: number;
  mediaType: string;
}

export interface ManifestFileRow {
  path: string;
  kind: 'text' | 'asset';
  section: string | '-';
  storedIn: 'packed' | 'copied';
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  outputFile?: string | '-';
  outputStartLine?: number | '-';
  outputEndLine?: number | '-';
}

export interface CxManifest {
  schemaVersion: 1;
  bundleVersion: 1;
  projectName: string;
  sourceRoot: string;
  createdAt: string;
  cxVersion: string;
  repomixVersion: string;
  checksumAlgorithm: 'sha256';
  sections: SectionOutputRecord[];
  assets: AssetRecord[];
  files: ManifestFileRow[];
}
```

---

## 33. CLI entry point

```ts
// src/cli/main.ts
import { runBundleCommand } from './commands/bundleCommand.js';
import { runExtractCommand } from './commands/extractCommand.js';
import { runVerifyCommand } from './commands/verifyCommand.js';
import { runValidateCommand } from './commands/validateCommand.js';
import { runListCommand } from './commands/listCommand.js';
import { runInspectCommand } from './commands/inspectCommand.js';
import { runInitCommand } from './commands/initCommand.js';

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case 'init':
      return runInitCommand(rest);
    case 'bundle':
      return runBundleCommand(rest);
    case 'extract':
      return runExtractCommand(rest);
    case 'verify':
      return runVerifyCommand(rest);
    case 'validate':
      return runValidateCommand(rest);
    case 'list':
      return runListCommand(rest);
    case 'inspect':
      return runInspectCommand(rest);
    case 'version':
      console.log('cx 0.1.0');
      return 0;
    default:
      console.error(`Unknown command: ${command ?? '(none)'}`);
      return 2;
  }
}
```

---

## 34. Config loader

```ts
// src/config/cxConfigLoad.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { CxConfig } from './cxConfigTypes.js';
import { validateCxConfig } from './cxConfigSchema.js';

export async function loadCxConfig(configPath: string): Promise<CxConfig> {
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = parseToml(raw) as unknown;
  const config = validateCxConfig(parsed);
  config.sourceRoot = path.resolve(path.dirname(configPath), config.sourceRoot);
  config.outputDir = path.resolve(path.dirname(configPath), config.outputDir);
  return config;
}
```

---

## 35. Section resolution

```ts
// src/planning/resolveSections.ts
import picomatch from 'picomatch';
import type { CxConfig } from '../config/cxConfigTypes.js';

export interface SectionMatch {
  path: string;
  sectionNames: string[];
}

export function resolveSections(
  relativePaths: string[],
  config: CxConfig,
): SectionMatch[] {
  const result: SectionMatch[] = [];

  for (const filePath of relativePaths) {
    const matches: string[] = [];

    for (const [sectionName, section] of Object.entries(config.sections)) {
      const included = section.include.some((g) => picomatch(g)(filePath));
      const excluded = (section.exclude ?? []).some((g) => picomatch(g)(filePath));
      if (included && !excluded) {
        matches.push(sectionName);
      }
    }

    result.push({ path: filePath, sectionNames: matches });
  }

  return result;
}
```

---

## 36. Overlap detection

```ts
// src/planning/detectOverlaps.ts
import type { SectionMatch } from './resolveSections.js';

export function detectOverlaps(matches: SectionMatch[]): SectionMatch[] {
  return matches.filter((m) => m.sectionNames.length > 1);
}
```

---

## 37. Repomix facade

```ts
// src/repomix/repomixFacade.ts
import type { CxStyle } from '../config/cxConfigTypes.js';

export interface RepomixSectionInput {
  sourceRoot: string;
  sectionName: string;
  style: CxStyle;
  filePaths: string[];
  options: {
    compress?: boolean;
    removeComments?: boolean;
    removeEmptyLines?: boolean;
    showLineNumbers?: boolean;
    includeEmptyDirectories?: boolean;
    securityCheck?: boolean;
  };
}

export interface RepomixSectionOutput {
  sectionName: string;
  style: CxStyle;
  outputText: string;
  spans?: Array<{
    path: string;
    startLine?: number;
    endLine?: number;
  }>;
}

export async function renderRepomixSection(
  input: RepomixSectionInput,
): Promise<RepomixSectionOutput> {
  // Phase 1 placeholder:
  // integrate against public repomix exports only.
  // preferred: use low-level APIs if they allow explicit file set rendering.
  // fallback: use a controlled temp workspace or include set via public options.
  void input;

  return {
    sectionName: 'placeholder',
    style: 'xml',
    outputText: '',
  };
}
```

---

## 38. Bundle planner

```ts
// src/planning/buildBundlePlan.ts
import path from 'node:path';
import type { CxConfig } from '../config/cxConfigTypes.js';
import { resolveSections } from './resolveSections.js';
import { detectOverlaps } from './detectOverlaps.js';

export async function buildBundlePlan(
  config: CxConfig,
  relativePaths: string[],
): Promise<BundlePlan> {
  const matches = resolveSections(relativePaths, config);
  const overlaps = detectOverlaps(matches);

  if (overlaps.length > 0 && (config.dedup?.mode ?? 'fail') === 'fail') {
    const example = overlaps.slice(0, 10).map((o) => `${o.path}: ${o.sectionNames.join(', ')}`);
    throw new Error(`Section overlap detected:\n${example.join('\n')}`);
  }

  const sections = Object.entries(config.sections).map(([name, section]) => {
    const style = section.style ?? config.repomix.style;
    const sectionFiles = matches
      .filter((m) => m.sectionNames[0] === name)
      .map((m) => ({
        relativePath: m.path,
        absolutePath: path.join(config.sourceRoot, m.path),
        kind: 'text' as const,
        mediaType: 'text/plain',
        sizeBytes: 0,
        matchedSection: name,
      }));

    return {
      name,
      style,
      outputFile: `${config.projectName}-repomix-${name}.${style === 'markdown' ? 'md' : style === 'json' ? 'json' : style === 'plain' ? 'txt' : 'xml.txt'}`,
      files: sectionFiles,
    };
  });

  return {
    projectName: config.projectName,
    sourceRoot: config.sourceRoot,
    bundleDir: config.outputDir,
    sections,
    assets: [],
    unmatchedFiles: matches.filter((m) => m.sectionNames.length === 0).map((m) => m.path),
  };
}
```

---

## 39. Manifest builder

```ts
// src/manifest/manifestBuilder.ts
import type { BundlePlan } from '../planning/buildBundlePlan.js';
import type { CxManifest, ManifestFileRow, SectionOutputRecord } from './manifestTypes.js';

export function buildManifest(params: {
  plan: BundlePlan;
  cxVersion: string;
  repomixVersion: string;
  sectionOutputs: SectionOutputRecord[];
  fileRows: ManifestFileRow[];
}): CxManifest {
  return {
    schemaVersion: 1,
    bundleVersion: 1,
    projectName: params.plan.projectName,
    sourceRoot: params.plan.sourceRoot,
    createdAt: new Date().toISOString(),
    cxVersion: params.cxVersion,
    repomixVersion: params.repomixVersion,
    checksumAlgorithm: 'sha256',
    sections: params.sectionOutputs,
    assets: params.plan.assets.map((a) => ({
      sourcePath: a.relativePath,
      storedPath: a.storedPath,
      sha256: '',
      sizeBytes: a.sizeBytes,
      mediaType: a.mediaType,
    })),
    files: params.fileRows,
  };
}
```

---

## 40. TOON writer

```ts
// src/manifest/toonWriter.ts
import type { CxManifest } from './manifestTypes.js';

export function renderManifestToon(manifest: CxManifest): string {
  const lines: string[] = [];

  lines.push('bundle');
  lines.push(`  schema_version ${manifest.schemaVersion}`);
  lines.push(`  bundle_version ${manifest.bundleVersion}`);
  lines.push(`  project_name ${manifest.projectName}`);
  lines.push(`  source_root ${manifest.sourceRoot}`);
  lines.push(`  created_at ${manifest.createdAt}`);
  lines.push('');

  lines.push('tooling');
  lines.push(`  cx_version ${manifest.cxVersion}`);
  lines.push(`  repomix_version ${manifest.repomixVersion}`);
  lines.push(`  checksum_algorithm ${manifest.checksumAlgorithm}`);
  lines.push('');

  for (const section of manifest.sections) {
    lines.push(`section ${section.name}`);
    lines.push(`  style ${section.style}`);
    lines.push(`  output_file ${section.outputFile}`);
    lines.push(`  output_sha256 ${section.outputSha256}`);
    lines.push(`  file_count ${section.fileCount}`);
    lines.push('');
  }

  for (const asset of manifest.assets) {
    lines.push('asset');
    lines.push(`  source_path ${asset.sourcePath}`);
    lines.push(`  stored_path ${asset.storedPath}`);
    lines.push(`  sha256 ${asset.sha256}`);
    lines.push(`  size_bytes ${asset.sizeBytes}`);
    lines.push(`  media_type ${asset.mediaType}`);
    lines.push('');
  }

  lines.push('table files');
  lines.push('  path kind section stored_in sha256 size_bytes media_type output_file output_start_line output_end_line');

  for (const row of manifest.files) {
    lines.push(
      `  ${row.path} ${row.kind} ${row.section} ${row.storedIn} ${row.sha256} ${row.sizeBytes} ${row.mediaType} ${row.outputFile ?? '-'} ${row.outputStartLine ?? '-'} ${row.outputEndLine ?? '-'}`
    );
  }

  lines.push('end');
  return lines.join('\n');
}
```

---

## 41. SHA-256 writer

```ts
// src/manifest/sha256Writer.ts
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function sha256File(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function writeSha256File(
  bundleDir: string,
  relativePaths: string[],
  outputFile: string,
): Promise<void> {
  const rows: string[] = [];

  for (const rel of [...relativePaths].sort()) {
    const hash = await sha256File(path.join(bundleDir, rel));
    rows.push(`${hash}  ${rel}`);
  }

  await fs.writeFile(path.join(bundleDir, outputFile), rows.join('\n') + '\n', 'utf8');
}
```

---

## 42. Bundle command skeleton

```ts
// src/cli/commands/bundleCommand.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadCxConfig } from '../../config/cxConfigLoad.js';
import { buildBundlePlan } from '../../planning/buildBundlePlan.js';
import { renderRepomixSection } from '../../repomix/repomixFacade.js';
import { buildManifest } from '../../manifest/manifestBuilder.js';
import { renderManifestToon } from '../../manifest/toonWriter.js';
import { writeSha256File } from '../../manifest/sha256Writer.js';

export async function runBundleCommand(argv: string[]): Promise<number> {
  const configPath = argv[0] ?? 'cx.toml';
  const config = await loadCxConfig(configPath);

  const relativePaths: string[] = []; // TODO: discover real files
  const plan = await buildBundlePlan(config, relativePaths);

  await fs.mkdir(plan.bundleDir, { recursive: true });

  const sectionOutputs = [];
  const fileRows = [];

  for (const section of plan.sections) {
    const rendered = await renderRepomixSection({
      sourceRoot: plan.sourceRoot,
      sectionName: section.name,
      style: section.style,
      filePaths: section.files.map((f) => f.relativePath),
      options: {
        compress: config.repomix.compress,
        removeComments: config.repomix.removeComments,
        removeEmptyLines: config.repomix.removeEmptyLines,
        showLineNumbers: config.repomix.showLineNumbers,
        includeEmptyDirectories: config.repomix.includeEmptyDirectories,
        securityCheck: config.repomix.securityCheck,
      },
    });

    await fs.writeFile(path.join(plan.bundleDir, section.outputFile), rendered.outputText, 'utf8');

    sectionOutputs.push({
      name: section.name,
      style: section.style,
      outputFile: section.outputFile,
      outputSha256: '',
      fileCount: section.files.length,
    });
  }

  const manifest = buildManifest({
    plan,
    cxVersion: '0.1.0',
    repomixVersion: 'unknown',
    sectionOutputs,
    fileRows,
  });

  const manifestText = renderManifestToon(manifest);
  const manifestName = `${plan.projectName}-manifest.toon`;
  await fs.writeFile(path.join(plan.bundleDir, manifestName), manifestText, 'utf8');

  const checksumName = `${plan.projectName}.sha256`;
  const checksumTargets = [
    ...plan.sections.map((s) => s.outputFile),
    manifestName,
  ];

  await writeSha256File(plan.bundleDir, checksumTargets, checksumName);
  return 0;
}
```

---

# Testing Specification

## 43. Required test classes

### Config

* valid minimal config
* missing required section
* invalid style
* invalid section name
* unresolved path template

### Planning

* exact single-section match
* overlap fail
* overlap first-wins
* asset/text conflict
* unmatched ignore
* unmatched fail

### Rendering

* section output names stable
* style mapping correct
* Repomix invocation arguments correct
* spans omitted when unavailable

### Manifest

* TOON rendering stable
* file table sorted deterministically
* hash sidecar sorted deterministically

### Extraction

* XML section extraction round-trip
* Markdown round-trip
* raw asset round-trip

### Verification

* checksum mismatch
* missing output file
* missing manifest
* incorrect file row

---

# Key decisions locked by this spec

## 44. Locked decisions

1. **`cx` is a separate package**
   It depends on Repomix and does not patch it.

2. **Repomix remains authoritative for section output syntax**
   Section files must remain standard Repomix outputs.

3. **`cx.toml` is the only config surface for `cx`**
   Repomix config files are not used.

4. **Section overlap fails by default**
   No silent dedup in v1.

5. **Assets are copied raw**
   They are not encoded into section outputs.

6. **Manifest is authoritative**
   File list is represented using a **TOON table**.

7. **Line spans are only stored when computed exactly**
   Never guessed by scanning output text.

---

# Recommended next implementation order

## 45. Build order

1. `cx init`
2. config schema + loader
3. file discovery + planner
4. overlap detection
5. basic Repomix adapter
6. manifest writer
7. checksum writer
8. `bundle`
9. `list`
10. `validate`
11. `verify`
12. `extract`

---

# Minimal example config

## 46. `cx.toml`

```toml
schema_version = 1
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
format = "toon"
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true

[checksums]
algorithm = "sha256"
file_name = "{project}.sha256"

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

[sections.tests]
include = ["tests/**", "spec/**"]
exclude = []
```

---

# Final note

This spec is deliberately strict. It makes `cx` a deterministic orchestration layer over Repomix rather than a forked variant of Repomix itself, which is exactly the safer architecture for the goals you described. It also aligns with Repomix’s existing library-oriented usage model and output-style support documented in the uploaded repository snapshot.  

I can turn this into the next concrete artifact as either a single `cx-spec.adoc` document or a starter TypeScript repository scaffold.
