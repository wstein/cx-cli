<!-- Source: EXTRACTION_SAFETY.md | Status: CANONICAL | Stability: STABLE -->

# Extraction Safety

## Why This Document Exists

`cx` is a deterministic bundler, not an archiver.

For the broader document map and architecture context, see
[README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

For packed text files, the bundle contract is the normalized packed representation emitted by the renderer, not the original source file bytes. Verification and extraction therefore work against the rendered bundle content, which is what downstream automation actually consumes.

Text extraction uses the manifest's `outputStartLine` and `outputEndLine` values as the primary locator for XML, Markdown, and plain sections. JSON sections use direct object lookup because the packed content is already stored as structured values in a single JSON object. A bundle that contains text sections without span metadata is rejected at bundle time.

Extraction safety sits downstream of bundle safety. The bundle-time dirty-state taxonomy determines whether a bundle may exist at all, while this document explains what happens after a valid bundle has already been written.

In practical terms:

- `clean` and `safe_dirty` bundles are ordinary inputs to extraction.
- `unsafe_dirty` never reaches extraction because bundling aborts first.
- `forced_dirty` is a recorded audit state, not a relaxation of extraction rules.

If a bundle was forced dirty, extraction still uses the manifest as written. The presence of `forced_dirty` does not weaken hash checking or span validation; it simply tells reviewers that the bundle came from an explicitly overridden working tree.

If your promotion pipeline forbids operator overrides, quarantine the bundle
before extraction by parsing the manifest `dirtyState` field in CI. The
quarantine logic belongs upstream of extraction, not inside the extractor.

## Status Meanings

`cx` uses four statuses during recovery:

| Status | Meaning |
| --- | --- |
| `intact` | Reconstructed content matches the packed-content hash in the manifest |
| `copied` | Asset is restored directly from stored bundle content |
| `degraded` | Content can be reconstructed, but the packed slice does not match the manifest hash |
| `blocked` | Deterministic reconstruction is not possible from the stored section output or its span metadata |

## The Default Safety Rule

By default, `cx extract` writes:

- `intact` text files
- `copied` assets

It refuses to write `degraded` text files unless you explicitly pass:

```bash
cx extract dist/demo-bundle --to /tmp/restore --allow-degraded
```

## What The Hash Means

The manifest `sha256` for a packed text file is the hash of the normalized packed content stored in the section output.

That is deliberate:

- `cx verify --against` re-renders the selected source files through the Repomix adapter and compares packed-content hashes
- `cx extract` uses output spans to recover the packed slice and checks it against the packed-content hash recorded in the manifest
- `cx bundle` records the same packed-content hash that later commands rely on

If the bundle output changes, the hash changes. If the original source file bytes differ in a way that does not change the packed output, the bundle hash stays the same.

## Troubleshooting Hash Mismatches

When extraction reports `manifest_hash_mismatch`, the error table shows a short checksum prefix for both the expected and actual content. Use that as the first diagnostic signal, then decide whether the file should be reviewed or the bundle should be rebuilt.

Practical checks:

- compare the expected and actual checksum prefixes in the error table
- re-run `cx list --json` or `cx extract --json` if you need the full `expectedSha256` and `actualSha256` values
- confirm whether the section output changed because of a Repomix rendering option, a span mismatch, or an actual content edit
- rebuild the bundle if the packed content is supposed to be stable

If the mismatch is intentional and approximate recovery is acceptable, use `--allow-degraded`. Otherwise, treat it as a bundle integrity failure and regenerate the bundle.

Operational extract failures now surface the same guidance in both human and
JSON output: a suggested command, a docs reference, and next steps under
`error.remediation`. Treat that payload as the machine-readable recovery path
for dashboards and CI summaries.

## What "Degraded" Usually Means

A degraded file usually means the stored section output and the parsed recovery path no longer agree on the normalized packed content.

That can happen if:

- the section wrapper no longer matches the manifest span metadata
- the stored output was edited after bundling
- the packed slice itself differs from the manifest hash

It should not be caused by ordinary source-byte differences that do not affect the packed output.

## Why `--allow-degraded` Is Dangerous

> [!CAUTION]
> ### THE DISASTER SCENARIO
> Imagine your bundle is degraded by a single missing newline at the top of a file. Every line number in the manifest is now shifted by +1. 
>
> 1. You run an LLM agent that reads the degraded bundle.
> 2. The agent identifies a vulnerability it thinks is on line 42.
> 3. Because of the shift, line 42 in the agent's view is actually line 41 in the real file.
> 4. The agent issues a patch to "overwrite line 42".
> 5. **Result:** The agent blindly overwrites a critical database connection string on the real line 42 that it never even saw.
>
> Your production build breaks silently because the mechanical chain of causality was severed by a "minor" formatting difference.

### The Mechanical Chain of Causality

1. **Byte Shift:** A missing newline or encoding error shifts the character offsets of the entire file.
2. **Integer Drift:** The manifest records the `outputStartLine` based on the *expected* rendering, but the *actual* recovered slice starts one line earlier/later.
3. **Hash Mismatch:** `cx` detects that the recovered slice hash doesn't match the manifest and marks it `degraded`.
4. **Coordinate Failure:** If you bypass this with `--allow-degraded`, you are handing the LLM a map where every coordinate is off by one.
5. **Silent Corruption:** The LLM executes a tool (like `replace_repomix_span`) against these wrong coordinates, corrupting the file.

In other words, `--allow-degraded` can turn one localized representation issue into a broader mapping error. Treat a `degraded` signal as a hard stop.

## Safe And Unsafe Use Cases

Safe enough:

- a human wants to inspect the recovered file manually
- an operator needs approximate content for review, not automation
- the output is being treated as advisory, not authoritative

Unsafe:

- an automated runner depends on manifest hashes
- downstream tooling uses `outputStartLine` and `outputEndLine`
- another system slices code from the rendered bundle by absolute coordinates
- the extracted file will be treated as a source-of-truth artifact

## Recommended Operator Decision

If extraction reports degraded text:

1. stop the pipeline
2. inspect which files are degraded
3. decide whether you need human-readable recovery or deterministic machine-safe recovery
4. only use `--allow-degraded` if approximate output is acceptable

If deterministic recovery matters, rebuild the bundle from the original source tree instead of forcing degraded fallback.

## Practical Examples

Human review:

```bash
cx extract dist/demo-bundle --to /tmp/review --file docs/summary.md --allow-degraded
```

This is acceptable only if the file is being read by a person.

Automation:

```bash
cx extract dist/demo-bundle --to /tmp/runner --verify
```

If this reports degraded text, do not append `--allow-degraded` just to make the job pass. Rebuild or re-bundle from the trusted source instead.
