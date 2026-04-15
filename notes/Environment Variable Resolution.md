---
id: 20260415163500
aliases: ["cx env vars", "config precedence"]
tags: [config, env, behavior]
---

`cx` supports environment variable overrides for Category B behavioral settings, with a clear precedence chain.

The override layer is implemented in `src/config/env.ts`.

Key rules:
- **Precedence**: CLI flag > `CX_*` environment variable > project `cx.toml` > user `cx.toml` > compiled defaults.
- **CX_STRICT**: When `CX_STRICT=true` or `CX_STRICT=1`, all Category B settings are forced to `fail`, overriding individual `CX_DEDUP_MODE`, `CX_REPOMIX_MISSING_EXTENSION`, and `CX_CONFIG_DUPLICATE_ENTRY` values.
- **Category B settings**:
  - `CX_DEDUP_MODE` — valid values: `fail`, `warn`, `first-wins`
  - `CX_REPOMIX_MISSING_EXTENSION` — valid values: `fail`, `warn`
  - `CX_CONFIG_DUPLICATE_ENTRY` — valid values: `fail`, `warn`, `first-wins`
  - `CX_ASSETS_LAYOUT` — valid values: `flat`, `deep`
- **Validation**: Invalid env var values are rejected immediately with a clear error message.
- **CLI flag interaction**: CLI-level overrides set by `--strict` or `--lenient` take precedence over environment variables.

This model preserves user control while keeping the configuration path auditable and deterministic.

## Links

- [[CLI Command Lifecycle]] - CLI middleware applies the highest-precedence overrides.
- [[Config Inheritance and Overlays]] - Env vars are a layer above project config values.
- src/config/env.ts - Implementation of environment override parsing.
