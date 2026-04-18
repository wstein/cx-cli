# Test Construction Guide

Use the shared helpers first. They keep the suite deterministic, reduce
process-global leakage, and make failures easier to read.

## Workspace Setup

- Use `tests/helpers/workspace/createWorkspace.ts` for temp repositories.
- Use `writeFiles()` or `copyFixture()` through the workspace helpers instead of
  hand-rolling directories in each test.

## Config Setup

- Use `tests/helpers/config/buildConfig.ts` for runtime config objects.
- Use `tests/helpers/config/toToml.ts` only when the command under test needs an
  on-disk `cx.toml`.
- Keep raw inline TOML for parser and schema-edge tests only.

## CLI Output

- Prefer `tests/helpers/cli/createBufferedCommandIo.ts` for command tests.
- Pass `cwd` or a command-specific workspace root explicitly instead of using
  `process.chdir()` for ordinary command execution.
- Use `tests/helpers/cli/captureCli.ts` only for true process-level or
  interactive integration tests.
- Reserve `captureCli()` for true process-level or interactive behavior only;
  prefer buffered `CommandIo` injection everywhere else.
- Use `tests/helpers/cli/parseJsonOutput.ts` for JSON assertions instead of
  manual parsing boilerplate.
- Use `tests/helpers/cli/createBufferedCommandIo.ts` for direct command tests
  that can inject `CommandIo` without touching process globals.
- Do not patch `process.stdout.write`, `process.stderr.write`, or `console.log`
  in normal tests.

## Test Boundaries

- Keep pure behavior in unit tests and avoid filesystem-backed module fixtures
  unless resolution itself is the subject.
- For parser or validator units, prefer in-memory fixtures and pure helpers over
  temp-directory file setup.
- Reserve contract tests for operator-visible JSON, manifest, and docs
  guarantees.
- Isolate true filesystem/module-resolution coverage in clearly named
  integration tests.
- Keep startup and transport anomaly handling in explicit boundary tests (for
  example, stalled startup, delayed failures, and malformed protocol payloads).

### Lane Matrix

| Path | Primary lane | Notes |
| --- | --- | --- |
| `tests/unit` | Unit | Pure logic and helper seams; prefer in-memory fixtures. |
| `tests/config` | Unit/Integration | Parser and precedence logic; use property matrices for override conflicts. |
| `tests/mcp` | Integration + Adversarial | MCP tool wiring and boundary fault behavior (timeouts, malformed startup payloads). |
| `tests/notes` | Unit/Integration | Keep parser/validation in-memory; keep CLI and note-graph workflows realistic. |
| `tests/planning` | Unit | Plan/provenance logic with deterministic fixtures. |
| `tests/manifest` | Unit/Integration | Schema/render round-trips plus manifest file compatibility checks. |
| `tests/repomix` | Integration | Adapter/runtime resolution against real module boundaries. |
| `tests/bundle` | Integration | Real workspace and artifact workflow tests; keep filesystem-backed. |
| `tests/cli` | Process/Integration | Command entrypoint behavior, user-facing JSON/human output contracts. |
| `tests/contracts` | Contract | CI/docs/script/operator surface invariants. |
| `tests/shared` | Unit | Shared primitives and utility behavior. |
| `tests/vcs` | Unit/Integration | VCS adapters, dispatch rules, and command integration edges. |
| `tests/init` | Integration | Template generation and initialization outcomes. |

## Property Matrices

- Use `fast-check` for combinatorial override behavior where input vectors
  multiply quickly (CLI flags, env vars, and cx.toml values).
- For high-volume config property lanes, call `loadCxConfig(..., { emitBehaviorLogs: false })`
  to keep CI output focused on assertion failures instead of precedence trace noise.
- Assert precedence and invariants as properties, not only as hand-picked
  examples.
- Keep generated inputs semantically valid so shrinking produces minimal,
  actionable failures.

## Notes

- Prefer explicit assertions over broad snapshots when validating planning or
  manifest details.
- If a test needs linked-note enrichment, assert the resulting provenance so the
  operator surface stays visible and intentional.
