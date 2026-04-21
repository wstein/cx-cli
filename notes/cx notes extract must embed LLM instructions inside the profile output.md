---
id: 20260421120300
title: cx notes extract must embed LLM instructions inside the profile output
aliases: [embedded prompt contract, profile instructions in output, LLM instructions in extraction bundle]
tags: [cx, notes, llm, profiles, prompts]
target: v0.4
---
# cx notes extract must embed LLM instructions inside the profile output

`cx notes extract` must embed LLM instructions inside the profile output because downstream narrative synthesis is only reproducible and reviewable when the authoring contract travels with the extracted note bundle instead of living in hidden scripts, CI jobs, or operator memory.

## What

Each extracted bundle should include the effective LLM instructions defined by the selected profile.

These instructions should cover:
- target document kind
- audience
- tone
- mandatory sections
- forbidden behaviors
- conflict handling
- uncertainty handling
- provenance disclosure rules

This makes the extraction artifact self-describing.

## Why

If the prompt contract exists only outside the bundle, then the actual documentation compiler is opaque and non-reproducible.

Embedding the instructions in the output keeps:
- note-to-doc compilation inspectable
- profiles reviewable in version control
- downstream LLM behavior easier to audit
- documentation workflow more deterministic

## How

When a profile is resolved, serialize the effective LLM contract into the output bundle under a dedicated section such as:
- `authoring-contract`
- `llm-instructions`
- `required-sections`

Do not rely on external prompt fragments that are invisible to repository review.

The instructions should constrain the LLM to synthesis and explanation, not canonical truth creation.

## Links

- [[cx notes extract profiles define scope structure and LLM contract]]
- [[cx notes extract should emit LLM centric structured bundles]]
- [[Contract Versioning Strategy]]
