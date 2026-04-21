---
id: 20260421162000
title: Manual LLM Synthesis Workflow For Notes Extract Bundles
aliases: [manual llm synthesis workflow, notes extract manual llm step, external docs synthesis workflow]
tags: [notes, llm, docs, workflow, governance]
target: current
---
# Manual LLM Synthesis Workflow For Notes Extract Bundles

The first implementation boundary for notes-driven docs synthesis is `cx notes extract` followed by a manual LLM step because the repository wants deterministic prompt bundles in version control without claiming that model invocation or final document writing is a repository-owned command yet.

## What

The workflow is:

1. select a built-in or configured extraction profile
2. run `cx notes extract --profile <name> --format markdown|xml|plain`
3. hand the emitted bundle to the chosen LLM manually
4. review the generated draft as a downstream artifact
5. edit or reject the draft before it becomes repository documentation

The extracted bundle is the reviewable contract artifact.

The LLM invocation remains external to `cx` in `v1`.

In that workflow, `--format xml` means xml-tagged plain text for the
model step. It does not mean that the repository is promising a strict
xml-schema document.

## Why

This protects the repository boundary in three ways:

- canonical truth remains in `notes/**`
- prompt construction remains deterministic and reviewable
- final docs remain human-reviewed downstream artifacts

If `cx` claimed the synthesis step too early, the CLI would imply an automation boundary that the repository has not yet formalized or tested.

## How

Treat the extracted bundle as the only repository-owned machine artifact for the synthesis step.

Use the manual LLM workflow like this:

- extract a profile-scoped bundle
- keep the bundle alongside the review context if needed
- invoke the model outside `cx`
- preserve provenance in the generated draft where practical
- review the draft against the canonical notes before merging

Do not treat ad hoc prompt fragments, copied note snippets, or operator memory as a substitute for the extracted bundle contract.

## Links

- [[cx notes extract compiles canonical notes into profile scoped LLM bundles]]
- [[cx notes extract should emit LLM centric structured bundles]]
- [[cx notes extract should remain extraction not final documentation generation]]
- [[cx notes extract should preserve provenance into downstream docs workflows]]
