# Test Construction Guide

Use the shared helpers first. They keep the suite deterministic, reduce
process-global leakage, and make failures easier to read.

Every `*.test.ts` file must start with a lane header on line 1:
`// test-lane: unit|integration|adversarial|contract`.

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
  example, stalled startup, delayed failures, malformed startup payloads,
  malformed tool-result payloads, and interrupted runtime responses).

## `verify --against` Audit Rule

- Every test that calls `runVerifyCommand(... againstDir: ...)` must include an
  inline rationale comment immediately above the test:
  `// verify-against-integration: <reason>`.
- Keep an up-to-date audit table in `tests/VERIFY_AGAINST_AUDIT.md` so each
  `--against` integration test has explicit scope and rationale.
- Every audit row must include an explicit injected seam counterpart reference
  (unit test file + case) so integration coverage and injected verification stay
  paired.
- CI emits a machine-readable audit report for PR automation with
  `bun run ci:report:verify-against` (`.ci/verify-against-policy-report.json`).
- Contract coverage enforces both requirements via
  `tests/contracts/verifyAgainstIntegration.contract.test.ts`.

### Lane Matrix

| Path | Primary lane | Notes |
| --- | --- | --- |
| `tests/unit` | Unit | Pure logic and helper seams; prefer in-memory fixtures, including parser/preference checks via `loadCxConfigFromTomlString()`. |
| `tests/config` | Integration | Keep only on-disk config and schema boundaries here; move pure parser/default/merge behavior to `tests/unit`. |
| `tests/mcp` | Integration + Adversarial | MCP tool wiring and boundary fault behavior (startup/runtime timeouts, malformed payloads, interrupted responses). |
| `tests/notes` | Integration | Keep notes CRUD/CLI/note-graph workflows realistic; keep parser/validation logic in `tests/unit/note*`. |
| `tests/planning` | Unit | Plan/provenance logic with deterministic fixtures. |
| `tests/manifest` | Unit/Integration | Schema/render round-trips plus manifest file compatibility checks. |
| `tests/repomix` | Integration | Adapter/runtime resolution against real module boundaries. |
| `tests/bundle` | Integration | Real workspace and artifact workflow tests; keep filesystem-backed. |
| `tests/cli` | Process/Integration | Command entrypoint behavior, user-facing JSON/human output contracts. |
| `tests/contracts` | Contract | CI/docs/script/operator surface invariants. |
| `tests/shared` | Unit | Shared primitives and utility behavior. |
| `tests/vcs` | Unit/Integration | VCS adapters, dispatch rules, and command integration edges. |
| `tests/init` | Integration | Template generation and initialization outcomes. |

### Lane Decision Checklist

- Choose `unit` when behavior can run in-memory with injected seams and no
  workspace/process boundary setup.
- Choose `integration` when the filesystem, command wiring, module resolution,
  or config file boundary is part of the behavior under test.
- Choose `adversarial` when the test intentionally simulates degraded,
  malformed, stalled, interrupted, or hostile boundary behavior.
- Choose `contract` when the test protects operator-facing promises (docs,
  workflow wiring, schema guarantees, release or CI policy).

## Fast Lane Guardrails

- `ci:test:fast` is the unit-only lane (`tests/unit`) and must stay focused.
- CI enforces lane composition with `bun run ci:guard:fast-lane`.
- CI tracks `ci:test:fast` duration with `bun run ci:test:fast:monitored`.
- Runtime drift is warning-first; failure requires sustained significant
  regressions (consecutive fail-signal streaks).
- The fast-lane file budget is controlled by `FAST_LANE_MAX_FILES` (default:
  `95`). Raise it only when the team intentionally accepts a slower fast lane.

## Focused MCP Cockpit

- Use `bun run test:vitest:mcp` for a narrow MCP-heavy lane when debugging MCP startup, policy, audit, or transport behavior.
- Use `bun run test:vitest:mcp:ui` when you need interactive reruns, UI coverage, or import-graph inspection for the MCP stack.
- Use `bun run test:vitest:mcp:adversarial` or `bun run test:vitest:mcp:adversarial:ui` when the failure is explicitly hostile or degraded boundary behavior, such as startup hangs or malformed runtime payloads.
- Keep this cockpit focused on MCP-facing suites. It is a debugging surface, not a replacement for the Bun verification lanes or the repository-wide Vitest coverage lane.

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
