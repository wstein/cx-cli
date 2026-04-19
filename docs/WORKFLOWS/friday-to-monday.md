<!-- Source: WORKFLOWS/friday-to-monday.md | Status: CANONICAL | Stability: STABLE -->

# Friday To Monday Workflow

See: [../MENTAL_MODEL.md](../MENTAL_MODEL.md)

This is the canonical end-to-end workflow for a team that investigates with MCP on Friday night and trusts a promotable artifact on Monday morning.

## Friday Night: Dirty Local Code, Fast AI Help

It is late on Friday. The developer has local tracked changes that are not ready to commit, but still needs fast AI help on the live code.

That is a Track B problem, not a clean promotion problem.

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
notes_read(id="20260413153522")
read(path="src/cli/commands/bundle.ts", startLine=230, endLine=320)
bundle()
```

What happens here:

- `doctor_mcp` confirms the live workspace boundary.
- `inspect` and `bundle()` preview the plan without writing artifact files.
- `notes_search` and `notes_read` reuse durable reasoning before the agent broad-scans the workspace.
- `read` and search tools keep the work grounded in the current repository state.

If the developer intentionally enables note mutation in a trusted local session, that workflow belongs in [safe-note-mutation.md](safe-note-mutation.md), not in the default Friday-night exploratory flow.

Why this protects you: the developer gets live reasoning help without pretending the current checkout is already a clean, promotable artifact.

## Friday Night Closeout: Optional Local Review Bundle

Sometimes the developer still wants a temporary local snapshot for review, even though the checkout is dirty.

That is the exceptional case for a local override:

```bash
cx bundle --config cx.toml --force
```

This is acceptable only as a local review aid. The manifest records `forced_dirty` so nobody has to guess later whether the bundle came from a clean source state.

Why this protects you: the override does not erase the provenance problem. It records it. A local operator can still inspect the snapshot, but Monday automation does not have to mistake it for a clean promotion artifact.

## Friday Closeout: Freeze The Real Handoff

Once the code is committed or the working tree is otherwise returned to a promotable state, switch to Track A and write the actual handoff:

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

## Monday Morning: CI Trusts Only The Clean Path

On Monday, CI should trust only the clean, promotable path. It should validate or verify the artifact built from committed source state, not a `forced_dirty` local convenience bundle.

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

- Dirty-state refusal on Friday means the workspace was not stable enough to freeze as a promotable artifact.
- `forced_dirty` on Friday means the bundle was only suitable for explicit local review, not for clean CI trust.
- Checksum failure on Monday means the artifact set in hand is no longer provably the one written on Friday.
- Degraded extraction means the bundle can no longer reconstruct text deterministically enough for safe automation.

Those failures are not friction for its own sake. They are the mechanisms that keep Friday intent queryable and safe on Monday.
