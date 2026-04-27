---
id: 20260427101500
title: Starter Config As Teaching Surface
aliases: ["starter cx.toml teaching surface"]
tags: ["config", "docs", "onboarding"]
---
The starter `cx.toml` is not only a default; it is the first executable explanation of CX section ownership.

A good starter config should teach:

- sections classify files that are already in the master list
- `files.include` expands the master list, while section `include` only assigns ownership
- catch-all sections are useful but should be visibly intentional
- overlap failures protect manifest clarity and token accounting

The template should stay small enough to copy, but explicit enough that first-time operators learn why broad globs and duplicate ownership are risky.

## Links

- [[Section Ownership and Overlaps]]
- [[Planning Boundary Enforcement]]
- [[Config Merge Model]]
