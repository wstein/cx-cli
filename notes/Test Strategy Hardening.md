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

## Links

- [[tests/README.md]]
- [[src/notes/validate.ts]]
- [[tests/unit/configLoad.property.test.ts]]
- [[tests/mcp/server.run.test.ts]]
