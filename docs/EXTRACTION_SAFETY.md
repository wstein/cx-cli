# Extraction Safety

## Why This Document Exists

`cx extract` does more than copy files out of a directory. For packed text files, it reconstructs source content from the rendered section outputs and then checks that reconstructed text against the manifest SHA-256.

That means extraction has real integrity semantics. When `cx` blocks or warns, it is protecting you from writing approximate content as if it were exact.

## Status Meanings

`cx` uses four statuses during recovery:

| Status | Meaning |
| --- | --- |
| `intact` | Reconstructed text matches the manifest hash exactly |
| `copied` | Asset is restored directly from stored bundle content |
| `degraded` | Text can be reconstructed, but its hash does not match the manifest |
| `blocked` | Exact reconstruction is not possible from the bundle output |

## The Default Safety Rule

By default, `cx extract` writes:

- `intact` text files
- `copied` assets

It refuses to write `degraded` text files unless you explicitly pass:

```bash
cx extract dist/demo-bundle --to /tmp/restore --allow-degraded
```

## What "Degraded" Usually Means

A degraded file often differs in small ways:

- trailing newline removed
- whitespace normalized
- wrapper parsing changed formatting
- section output no longer round-trips to the original exact text

Those changes can look harmless to a human and still be unsafe for automation.

## Why `--allow-degraded` Is Risky

The real danger is not only that the file changed. The danger is that downstream systems may still trust the original manifest coordinates and hashes.

If a degraded file loses or gains even one line:

- its own content no longer matches the manifest
- every absolute output line number after that point can shift
- span-based slicing tools can target the wrong lines
- generated patches or follow-up prompts can reference the wrong code

In other words, `--allow-degraded` can turn one localized mismatch into a broader mapping error.

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
3. decide whether you need human-readable recovery or exact machine-safe recovery
4. only use `--allow-degraded` if approximate output is acceptable

If exactness matters, rebuild the bundle from the original source tree instead of forcing degraded recovery.

## Practical Examples

Human review:

```bash
cx extract dist/demo-bundle --to /tmp/review --file docs/summary.md --allow-degraded
```

This can be acceptable if the file is only being read by a person.

Automation:

```bash
cx extract dist/demo-bundle --to /tmp/runner --verify
```

If this reports degraded text, do not append `--allow-degraded` just to make the job pass. Rebuild or re-bundle from the trusted source instead.
