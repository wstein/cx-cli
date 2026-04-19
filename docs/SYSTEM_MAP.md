<!-- Source: SYSTEM_MAP.md | Status: SUPPORTING | Stability: STABLE -->

# CX System Map

Use this page when you need one mental anchor before reading the deeper docs.

```text
Live Code ──cx mcp────► Notes ──cx bundle────► Bundle ──cx verify────► Trusted Handoff
   │                     │                      │                      │
   │                     │                      │                      │
Hypothesis           Memory                Snapshot                 Proof
Track B              Cognition Layer       Track A                 Trust Gate
```

## Read It Left To Right

1. Run `cx mcp` when you need fast interactive help on live code.
2. Use `cx notes` to preserve reasoning that should survive the current session.
3. Run `cx bundle` when the work must become a reproducible artifact.
4. Run `cx verify` when later humans or CI need proof instead of trust-by-habit.

## Read It Top To Bottom

- **MCP** is the live investigation surface.
- **Notes** are the durable cognition layer.
- **Bundle** is the frozen snapshot.
- **Verify** is the proof gate.

## Learn Later

- [OPERATING_MODES.md](OPERATING_MODES.md) maps the right tool to the current job.
- [MENTAL_MODEL.md](MENTAL_MODEL.md) defines the canonical semantics.
- [SYSTEM_CONTRACTS.md](SYSTEM_CONTRACTS.md) defines cognition quality, hard boundaries, and trust propagation.
