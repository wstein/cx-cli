---
id: 20260421120100
title: cx notes extract profiles define scope structure and LLM contract
aliases: [notes extract profiles, profile contract for notes extraction, LLM profile contract]
tags: [cx, notes, profiles, llm, governance]
target: v0.4
---
# cx notes extract profiles define scope structure and LLM contract

Profiles for `cx notes extract` should define not only which notes are selected, but also the structure, intended document product, and LLM authoring contract for the emitted bundle. A profile is a compilation contract, not just a tag filter.

## What

A `cx notes extract` profile should define at least:

- profile name
- purpose
- output format
- target document kind
- target output paths
- include and exclude rules
- required notes
- deterministic ordering or grouping rules
- LLM authoring instructions
- audience and tone constraints
- provenance and disclosure requirements

Examples include:
- `arc42`
- `onboarding`
- `manual`

## Why

Simple tag filtering is not enough to build reliable downstream documentation bundles.

Different document products require different:
- note subsets
- ordering
- narrative priorities
- LLM instructions
- mandatory sections

Without explicit profile contracts, extraction behavior becomes implicit, non-reproducible, and hard to review.

## How

Treat each profile as a version-controlled configuration artifact.

The profile should shape:
1. selection
2. ordering
3. output structure
4. LLM constraints

The extracted bundle should contain the effective profile information so downstream compilation remains inspectable and reproducible.

Do not treat profile behavior as hidden application logic.

## Links

- [[cx notes extract compiles canonical notes into profile scoped LLM bundles]]
- [[arc42 as Architecture Spine]]
- [[Documentation Surface Split for Antora]]
- [cx.toml](../cx.toml)
