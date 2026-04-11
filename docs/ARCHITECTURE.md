# CX Architecture

`cx` is a deterministic context bundler built on top of Repomix through a narrow adapter boundary.

## Core Model

- Project configuration lives in `cx.toml`.
- User interface preferences for `cx list` live in `~/.config/cx/cx.toml` or `$XDG_CONFIG_HOME/cx/cx.toml`.
- Planning is deterministic and resolves source files, sections, assets, and conflicts before rendering.
- Rendering uses public Repomix exports only.
- Bundle structure is defined by the JSON manifest and checksum sidecar.

## Bundle Responsibilities

- Store exact token counts for sections and files.
- Store exact output spans only when the adapter can produce them.
- Store source metadata needed for validation, verification, and extraction.
- Exclude user-specific display preferences such as heat thresholds and grayscale palettes.

## Failure Model

- Section overlap and asset conflicts are hard failures.
- Missing core adapter capabilities are hard failures.
- Missing exact span support is a warning-only degradation.
- Degraded extraction requires explicit opt-in.

## Command Surface

- `bundle`, `validate`, `verify`, `extract`, and `render` operate on deterministic bundle data.
- `doctor` handles overlap diagnosis and guided recovery.
- `adapter` reports Repomix runtime and capability diagnostics.
- `list` combines bundle metadata with user-level display preferences at read time.
