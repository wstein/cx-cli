# CX Configuration Reference

## Behavioral Settings

Behavioral settings are Category B settings: configurable behaviors that control
how `cx` handles common friction points. They are distinct from Category A
invariants, which are always hard failures and cannot be configured away.

> **Category A invariants — not configurable:**
>
> - Section overlap (when `dedup.mode = "fail"`, the compiled default)
> - Asset collision between a section and an asset rule
> - Missing core adapter contract (`mergeConfigs` not exported)
>
> No env var, TOML key, or CLI flag affects these. They always cause a non-zero exit.

### Precedence chain

Settings are resolved in this order (highest priority first):

```text
CLI flag > CX_* env var > project cx.toml > compiled default
```

Every resolved Category B setting is logged at `Info` level to stderr, including
the source from which it was resolved. This provides an audit trail in CI logs.

### CX_STRICT shorthand

Setting `CX_STRICT=true` (or `CX_STRICT=1`) forces every Category B setting to
`"fail"`, overriding any `cx.toml` values. It does not affect Category A
invariants. Use it in CI pipelines for a single assertion point:

```dockerfile
ENV CX_STRICT=true
```

`CX_STRICT` takes precedence over all per-area env vars. Per-area vars are
ignored when `CX_STRICT` is active.

### Settings table

| Setting                       | TOML key                    | Env var                          | Default | Allowed values                |
| ----------------------------- | --------------------------- | -------------------------------- | ------- | ----------------------------- |
| Overlap / dedup resolution    | `dedup.mode`                | `CX_DEDUP_MODE`                  | `fail`  | `fail`, `warn`, `first-wins`  |
| Repomix missing cx extension  | `repomix.missing_extension` | `CX_REPOMIX_MISSING_EXTENSION`   | `warn`  | `fail`, `warn`                |
| Duplicate config entries      | `config.duplicate_entry`    | `CX_CONFIG_DUPLICATE_ENTRY`      | `fail`  | `fail`, `warn`, `first-wins`  |

**`dedup.mode`** controls what happens when the same source file matches more
than one section:

- `"fail"` — planning aborts with an actionable error. Use `cx doctor` to
  resolve the overlap.
- `"warn"` — conflicts are reported to stderr and planning continues with
  first-section-wins resolution.
- `"first-wins"` — conflicts are resolved silently.

**`repomix.missing_extension`** controls what happens when the cx-specific
Repomix adapter extensions (`packStructured` / `renderWithMap`) are missing
but the core contract (`mergeConfigs`) is met:

- `"fail"` — rendering aborts with exit 5. Useful for strict CI environments
  that require full span capture or token-count accuracy.
- `"warn"` — a warning is emitted and rendering continues using the `pack()`
  degraded path (default; existing setups are unaffected).

**`config.duplicate_entry`** controls what happens when the same glob pattern
appears more than once in an `include` or `exclude` array:

- `"fail"` — loading aborts and lists the offending patterns.
- `"warn"` — a warning is emitted and the array is deduplicated (first
  occurrence wins).
- `"first-wins"` — the array is deduplicated silently.

### Example: cx.toml

```toml
[dedup]
mode = "warn"                     # overlaps are warnings, not failures

[repomix]
missing_extension = "fail"        # require the cx adapter extension in CI

[config]
duplicate_entry = "first-wins"    # silently deduplicate repeated patterns
```

### Example: Docker environment

Env vars work standalone — no `cx.toml` mount required:

```dockerfile
ENV CX_STRICT=true
```

Or per-area:

```dockerfile
ENV CX_DEDUP_MODE=warn
ENV CX_REPOMIX_MISSING_EXTENSION=fail
ENV CX_CONFIG_DUPLICATE_ENTRY=first-wins
```

### Inspecting effective settings

Use `cx config show-effective` to dump all Category B settings with their
resolved values and sources. Works without a `cx.toml`:

```text
$ cx config show-effective
Effective behavioral settings
Config file : cx.toml
CX_STRICT   : false

Setting                    Value       Source
-------------------------  ----------  ----------------
dedup.mode                 fail        compiled default
repomix.missing_extension  warn        compiled default
config.duplicate_entry     fail        compiled default

Category A invariants (section overlap when dedup.mode=fail, asset
collision, missing core adapter contract) are never configurable.
```

Add `--json` for machine-readable output.

---

## Safe project names

The `project_name` field must be filesystem-safe and follow a narrow naming policy:

- Allowed characters: letters, numbers, dot (`.`), underscore (`_`), hyphen (`-`).
- Must start with a letter or number.
- Used to derive bundle artifacts such as `project-manifest.json`, `project.sha256`, and `project-repomix-<section>.<ext>`.

Invalid values are rejected when loading `cx.toml` or when running `cx init --name`.

## Path expansion

The configuration supports expanding paths before they are resolved:

- `~` and `~/...` are expanded to the current user home directory.
- `$VAR` and `${VAR}` are expanded from environment variables.
- `{project}` is replaced with the configured `project_name`.

The resolved paths are then normalized relative to the directory containing `cx.toml`.

Example:

```toml
source_root = "~/projects/$WORKSPACE/src"
output_dir = "dist/{project}-bundle"
```

## Token Counting

Exact token counting is configurable through the `[tokens]` table:

```toml
[tokens]
encoding = "o200k_base"
```

Rules:

- `encoding` must be a non-empty tokenizer encoding name understood by Repomix and `tiktoken`.
- `o200k_base` is the default and is a good fit for modern OpenAI models.

`cx bundle` stores the chosen `tokenEncoding` in the manifest and persists exact `tokenCount` values for every section and file. Downstream consumers such as `cx list` read those stored counts directly and never fall back to byte- or character-based guesses.

## User Display Settings

`cx list` uses user-level display settings from `~/.config/cx/cx.toml` by default. If `XDG_CONFIG_HOME` is set, `cx` reads `$XDG_CONFIG_HOME/cx/cx.toml` instead.

Example:

```toml
[display.list]
bytes_warm = 4096
bytes_hot = 65536
tokens_warm = 512
tokens_hot = 2048
mtime_warm_minutes = 60
mtime_hot_hours = 24
time_palette = [255, 254, 253, 252, 251, 250, 249, 248, 247, 246]
```

Rules:

- Each value must be a positive integer.
- `bytes_hot` must be greater than `bytes_warm`.
- `tokens_hot` must be greater than `tokens_warm`.
- `mtime_hot_hours` must represent a later threshold than `mtime_warm_minutes`.
- `time_palette` must contain 8 to 10 ANSI 256 grayscale codes in descending bright-to-dark order.

These settings are user preferences only. They are not accepted in project `cx.toml`, and they are not stored in the bundle manifest.

## Extract Status Semantics

`cx` uses four production statuses for bundle-side recovery:

- `intact`: reconstructed text matches the manifest hash exactly.
- `copied`: the file is restored directly from stored asset content.
- `degraded`: the file is visible in bundle output but does not match the manifest hash exactly.
- `blocked`: the file cannot be reconstructed from bundle output.

By default, `cx extract` restores `intact` text files and `copied` assets only. Restoring `degraded` files requires `--allow-degraded`.

## Bundle invariants

A generated bundle must satisfy these invariants:

- Exactly one `*-manifest.json` file must exist in the bundle directory.
- The checksum file must list:
  - the manifest JSON file
  - every section output file
  - every stored asset file
- Every manifest file row records the source file `time` used by `cx list` and restored by `cx extract`.
- The manifest does not store user-specific `cx list` heat-map settings.
- `cx verify` fails if the checksum file omits any expected artifact, if a stored file hash does not match, or if `--against` detects source-tree drift.
- Section output names are deterministic and derived from `project_name` plus the section name.

When `manifest.include_output_spans = true`, `cx bundle` computes per-file spans using absolute line numbers in the rendered section output only when the active adapter exposes exact span capture through `renderWithMap`. `output_start_line` is the first bare content line of the file block, and `output_end_line` is the last bare content line. XML/Markdown/JSON/plain wrapper lines are not part of the span itself, but wrapper lines that appear earlier in the output file affect the absolute start and end positions. If the adapter can render but cannot capture exact spans, bundling continues with a warning and the span fields remain `null`.

## Overlap Resolution

Section overlap remains a hard failure for planning and bundling when `dedup.mode = "fail"`, which is the default.

Use the doctor commands to diagnose and resolve conflicts without weakening that invariant:

- `cx doctor overlaps` lists every conflicted file, all matching sections, and the recommended owner.
- `cx doctor fix-overlaps --dry-run` prints the exact `exclude` updates without modifying `cx.toml`.
- `cx doctor fix-overlaps` writes the recommended `sections.<name>.exclude` entries to `cx.toml`.
- `cx doctor fix-overlaps --interactive` lets you choose the owning section for each conflicted file.

For details on how `cx` validates and verifies bundles, see `src/bundle/verify.ts` and `src/bundle/validate.ts`.
