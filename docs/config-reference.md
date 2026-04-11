# CX Configuration Reference

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
