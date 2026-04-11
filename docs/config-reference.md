# CX Configuration Reference

## Safe project names

The `project_name` field must be filesystem-safe and follow a narrow naming policy:

- Allowed characters: letters, numbers, dot (`.`), underscore (`_`), hyphen (`-`).
- Must start with a letter or number.
- Used to derive bundle artifacts such as `project-manifest.toon`, `project.sha256`, and `project-repomix-<section>.<ext>`.

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

## Token Estimation

Token estimation is configurable through the `[tokens]` table:

```toml
[tokens]
algorithm = "chars_div_4"
```

Supported algorithms:

- `chars_div_4`: estimate tokens as `ceil(characters / 4)`
- `chars_div_3`: estimate tokens as `ceil(characters / 3)`

The chosen algorithm is stored in the manifest and reused by bundle consumers such as `cx list`.

## List Display Thresholds

`cx list` color temperatures are configurable through `[display.list]`:

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

These thresholds and the grayscale palette are stored in the manifest so `cx list` can render consistent temperatures from bundle data alone.

## Extract Status Semantics

`cx` uses four production statuses for bundle-side recovery:

- `intact`: reconstructed text matches the manifest hash exactly.
- `copied`: the file is restored directly from stored asset content.
- `degraded`: the file is visible in bundle output but does not match the manifest hash exactly.
- `blocked`: the file cannot be reconstructed from bundle output.

By default, `cx extract` restores `intact` text files and `copied` assets only. Restoring `degraded` files requires `--allow-degraded`.

## Bundle invariants

A generated bundle must satisfy these invariants:

- Exactly one manifest file must exist in the bundle directory.
- The checksum file must list:
  - the manifest file
  - every section output file
  - every stored asset file
- Every manifest file row records the source file `time` used by `cx list` and restored by `cx extract`.
- `cx verify` fails if the checksum file omits any expected artifact, if a stored file hash does not match, or if `--against` detects source-tree drift.
- Section output names are deterministic and derived from `project_name` plus the section name.

When `manifest.include_output_spans = true`, `cx bundle` computes per-file spans using absolute line numbers in the rendered section output. `output_start_line` is the first bare content line of the file block, and `output_end_line` is the last bare content line. XML/Markdown/JSON/plain wrapper lines are not part of the span itself, but wrapper lines that appear earlier in the output file affect the absolute start and end positions.

For details on how `cx` validates and verifies bundles, see `src/bundle/verify.ts` and `src/bundle/validate.ts`.
