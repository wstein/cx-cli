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

## Bundle invariants

A generated bundle must satisfy these invariants:

- Exactly one manifest file must exist in the bundle directory.
- The checksum file must list:
  - the manifest file
  - every section output file
  - every stored asset file
- `cx verify` fails if the checksum file omits any expected artifact, if a stored file hash does not match, or if `--against` detects source-tree drift.
- Section output names are deterministic and derived from `project_name` plus the section name.

When `manifest.include_output_spans = true`, `cx bundle` computes content-only per-file spans and records them as `output_start_line` and `output_end_line` in the manifest. The line numbers track bare file content only, so XML, Markdown, JSON, and plain-text wrapper lines are excluded from the reported ranges.

For details on how `cx` validates and verifies bundles, see `src/bundle/verify.ts` and `src/bundle/validate.ts`.
