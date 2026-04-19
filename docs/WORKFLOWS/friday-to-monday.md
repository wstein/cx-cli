<!-- Source: WORKFLOWS/friday-to-monday.md | Status: CANONICAL | Stability: STABLE -->

# Friday To Monday Workflow

See: [../MENTAL_MODEL.md](../MENTAL_MODEL.md)

This is the canonical end-to-end workflow for a team that investigates with MCP on Friday and trusts the bundle on Monday.

## Friday: Investigate In The Live Workspace

Use Track B while the work is still exploratory.

1. Confirm the recommended mode:

```bash
cx doctor workflow --task "understand the change, update notes, and prepare a handoff bundle"
```

2. Start the live MCP server:

```bash
cx mcp
```

3. Typical MCP call sequence:

```text
doctor_mcp()
inspect()
notes_search(query="dirty state", limit=5)
read(path="src/cli/commands/bundle.ts", startLine=230, endLine=320)
notes_new(title="Dirty State Guard", body="Unsafe tracked changes must block bundling because the artifact would not reflect a stable VCS snapshot.", tags=["workflow", "safety"])
notes_update(id="20260419090000", body="Add Friday handoff guidance and point operators to the canonical mental model.", tags=["workflow", "handoff"])
bundle()
```

What happens here:

- `doctor_mcp` confirms the live workspace boundary.
- `inspect` and `bundle()` preview the plan without writing artifact files.
- `notes_new` and `notes_update` preserve reasoning before handoff.
- `read` and search tools keep the work grounded in the current repository state.

## Friday Closeout: Freeze The Artifact

Once the investigation is complete, switch to Track A and write the actual handoff:

```bash
cx inspect --config cx.toml --token-breakdown
cx bundle --config cx.toml
cx verify dist/demo-bundle --against . --config cx.toml
```

Why this protects you: Friday's live workspace is still moving. The bundle is the moment where `cx` freezes that state into something Monday can verify instead of merely trust.

## What Travels Across The Weekend

The handoff is the bundle directory, not the MCP session:

- section outputs
- manifest
- lock file
- checksum sidecar
- copied assets

The notes you updated on Friday can also be included in the bundle plan, which keeps reasoning and artifact together.

## Monday: Verify Before You Trust

On Monday, treat the bundle as an artifact under test, not as an assumption.

Start with structure and integrity:

```bash
cx validate dist/demo-bundle
cx verify dist/demo-bundle --config cx.toml
```

If you have the expected source tree available, compare against it directly:

```bash
cx verify dist/demo-bundle --against /path/to/checkout --config cx.toml
```

If you need files back out for review or downstream work:

```bash
cx extract dist/demo-bundle --to /tmp/review --verify
```

Why this protects you: Monday's runner should prove that the artifact still matches Friday's bundle contract. Validation checks that the structure exists. Verification checks that the artifact set and, optionally, the source tree still agree. Extraction stays behind the same manifest and hash guardrails.

## Failure Interpretation

- Dirty-state refusal on Friday means the workspace was not stable enough to freeze.
- Checksum failure on Monday means the artifact set in hand is no longer provably the one written on Friday.
- Degraded extraction means the bundle can no longer reconstruct text deterministically enough for safe automation.

Those failures are not friction for its own sake. They are the mechanisms that keep Friday intent queryable and safe on Monday.
