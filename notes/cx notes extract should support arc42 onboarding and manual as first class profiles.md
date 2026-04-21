---
id: 20260421120400
title: cx notes extract should support arc42 onboarding and manual as first class profiles
aliases: [first class extraction profiles, arc42 onboarding manual profiles, notes extract profile targets]
tags: [cx, notes, profiles, arc42, onboarding, manual]
target: current
---
# cx notes extract should support arc42 onboarding and manual as first class profiles

`cx notes extract` supports `arc42`, `onboarding`, and `manual` as first-class profiles because those outputs serve different readers, require different narrative structures, and should not be produced from one undifferentiated note dump.

## What

The first recommended extraction profiles are:

- `arc42`
- `onboarding`
- `manual`

Each profile should produce a differently shaped LLM bundle.

`arc42` emphasizes:
- architectural decisions
- constraints
- building blocks
- cross-cutting concepts
- quality and risks

`onboarding` emphasizes:
- mental models
- core workflow
- contributor entry points
- foundational concepts before deep edge cases

`manual` emphasizes:
- operational workflows
- commands
- validation
- troubleshooting
- supported behaviors and failure modes

## Why

One shared canonical note corpus can support multiple document products, but those products do not want the same shape, tone, or depth.

Making these profiles first-class avoids:
- one-size-fits-none bundles
- bloated prompts
- unstable document synthesis
- hidden per-target prompt logic

## How

Support profile selection explicitly in the CLI, for example:
- `cx notes extract --profile arc42`
- `cx notes extract --profile onboarding`
- `cx notes extract --profile manual`

Keep each profile version-controlled and reviewable.

Prefer explicit target-specific contracts over heuristic audience inference.

## Links

- [[cx notes extract profiles define scope structure and LLM contract]]
- [[arc42 as Architecture Spine]]
- [[Local Semantic Primers in Canonical Docs]]
- [[Documentation Surface Split for Antora]]
