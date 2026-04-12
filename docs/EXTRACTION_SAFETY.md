# Extraction Safety

## Why This Document Exists

`cx` is a deterministic bundler, not an archiver.

For packed text files, the bundle contract is the normalized packed representation emitted by Repomix, not the original source file bytes. That means verification and extraction work against the rendered bundle content, which is what downstream automation actually consumes.

Text extraction uses the manifest's `outputStartLine` and `outputEndLine` values as the primary locator for XML, Markdown, and plain sections. JSON sections stay direct because the packed content is already stored as structured values in a single JSON object and does not carry span metadata.

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

## What "Degraded" Usually Means

A degraded file usually means the stored section output and the parsed recovery path no longer agree on the normalized packed content.

That can happen if:

- the section wrapper no longer matches the manifest span metadata
- the stored output was edited after bundling
- the packed slice itself differs from the manifest hash

It should not be caused by ordinary source-byte differences that do not affect the packed output.

## Why `--allow-degraded` Is Risky

The real risk is not byte-perfect source recovery. The risk is that downstream tooling may treat a fallback reconstruction as if it were the canonical packed representation.

If a degraded file loses or gains even one logical line:

- its packed-content hash no longer matches the manifest
- absolute output line numbers can shift
- span-based slicing tools can target the wrong lines
- generated patches or follow-up prompts can reference the wrong code

In other words, `--allow-degraded` can turn one localized representation issue into a broader mapping error.

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
