---
id: 20260419093000
aliases: ["Test Strategy Hardening", "Adversarial Test Matrix"]
tags: ["testing", "quality", "architecture"]
---

# Test Strategy Hardening

## Why this exists

The suite had excellent real-world coverage but too much unit-level dependence
on filesystem setup. That made core logic tests slower and more fragile than
they needed to be.

## Strategy

1. Keep pure logic tests in memory.
2. Use property-based tests for multi-layer configuration precedence.
3. Treat protocol boundaries as adversarial and test degraded startup paths.

## Applied changes

- Notes validation now has an in-memory validation path used by unit tests.
- Config resolution has a property-based override matrix exercising CLI, env,
  and file conflicts with strict-mode source attribution.
- MCP startup tests now include stalled and malformed-boundary behaviors with
  timeout assertions.

## Boundary guidance

- Unit tests should avoid disk I/O unless the file boundary itself is the
  behavior under test.
- Integration tests should continue validating workspace and bundle flows
  against real files.
- MCP boundary tests should simulate hangs, delayed throws, and malformed
  startup errors so CLI behavior degrades safely.

## PR checklist guardrails

- Every `*.test.ts` file should start with `// test-lane: ...` and match the
  lane matrix in `tests/README.md`.
- Every new test should follow the lane decision checklist in
  `tests/README.md` so unit versus integration boundaries stay explicit.
- CI should run `bun run ci:guard:fast-lane` so the fast lane remains
  unit-only and does not silently bloat.
- CI should track fast-lane runtime drift with
  `bun run ci:test:fast:monitored` and warn before failing on sustained major
  regressions.
- PRs should include explicit unit/integration/adversarial checklist results so
  lane intent is visible during review.
- If a lane is intentionally skipped, the PR should explain why.

## Verify --against boundary audit

- Every `runVerifyCommand(... againstDir: ...)` test now requires an inline
  rationale tag: `// verify-against-integration: <reason>`.
- The audit ledger at `tests/VERIFY_AGAINST_AUDIT.md` explains why each
  `--against` case remains full integration instead of injected verification.
- Each audit row must reference a concrete injected unit seam counterpart to
  keep the integration lane anchored to deterministic unit failure coverage.
- CI now emits a machine-readable audit report at
  `.ci/verify-against-policy-report.json` via
  `bun run ci:report:verify-against` for PR bots and automation tooling.
- Contract enforcement in
  `tests/contracts/verifyAgainstIntegration.contract.test.ts` prevents drift
  between test code and the audit ledger.

## Links

- [[tests/README.md]]
- [[tests/VERIFY_AGAINST_AUDIT.md]]
- [[.github/pull_request_template.md]]
- [[src/notes/validate.ts]]
- [[tests/unit/configLoad.property.test.ts]]
- [[tests/mcp/server.run.test.ts]]
