# `runVerifyCommand --against` Integration Audit

This audit documents every test that invokes
`runVerifyCommand({ ..., againstDir: ... })` and explains why each case stays
as a full-path integration test instead of moving entirely to injected seams.

Pure failure classes, structured-plan drift handling, and selective filter edge
logic are already covered via injected seams in
`tests/unit/bundleVerifyFailures.test.ts`.
Read-only drift verification lanes in `tests/bundle/bundle.workflow.test.ts`
reuse an immutable drifted fixture to avoid repeated bundle setup work.

| File | Test | Why it remains full integration | Injected seam counterpart |
| --- | --- | --- | --- |
| `tests/bundle/bundle.workflow.test.ts` | `emits structured JSON for bundle and verify automation` | Verifies command-level JSON contract with real config loading, real workspace paths, and real `--against` selection wiring. | `tests/unit/bundleVerifyFailures.test.ts` (`skips aggregate render_plan_drift check for selective --against by file`) |
| `tests/bundle/bundle.workflow.test.ts` | `emits structured JSON failure payload for source-tree drift` | Requires a real on-disk source mutation after bundle creation and asserts user-facing JSON remediation output from the command boundary. | `tests/unit/bundleVerifyFailures.test.ts` (`fails when source-tree render plan hash drifts`) |
| `tests/bundle/bundle.workflow.test.ts` | `verifies a bundle against the original source tree` | Keeps one end-to-end success smoke lane for bundle artifacts, Repomix render path, and source-tree verification working together. | `tests/unit/bundleVerifyFailures.test.ts` (`requires loaded config for verify --against`) |
| `tests/bundle/bundle.workflow.test.ts` | `fails verify --against when the source tree drifts` | Confirms human-output command failure behavior for real source drift, including thrown error semantics across CLI wiring. | `tests/unit/bundleVerifyFailures.test.ts` (`fails when source-tree render plan hash drifts`) |
| `tests/bundle/bundle.workflow.test.ts` | `supports selective verify --against by file` | Validates file-level selector behavior on a real workspace where one path drifts and another remains valid. | `tests/unit/bundleVerifyFailures.test.ts` (`skips aggregate render_plan_drift check for selective --against by file`) |
| `tests/bundle/bundle.workflow.test.ts` | `supports selective verify --against by section` | Validates section-level selector behavior against actual manifest sections and filesystem state changes. | `tests/unit/bundleVerifyFailures.test.ts` (`skips aggregate render_plan_drift check for selective --against by section`) |
