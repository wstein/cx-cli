---
id: 20260420191500
title: Scripts Directory Uses JavaScript Only
aliases: []
tags: ["scripts", "javascript", "typescript", "boundary"]
---
The `scripts/` directory must contain ECMAScript and JavaScript files only. It must not contain TypeScript source files.

## Rule

- allow `.js`, and supporting runtime assets when needed
- do not add `.ts`, `.mts`, or `.cts` files under `scripts/`
- keep script execution directly runnable by the checked-in Node runtime without a TypeScript compilation step

## Why

The `scripts/` directory is the repository's direct operational tooling surface.

Those files are used by:

- local release and verification flows
- CI jobs
- smoke scripts
- publish and Pages assembly workflows

That surface should stay runnable with the shipped runtime assumptions instead of depending on a separate TypeScript build step before operational scripts can execute.

## Non-goal

This rule does not ban TypeScript from the repository.

It only keeps the `scripts/` boundary simple, directly executable, and operationally predictable.

## Why this protects you

A JavaScript-only `scripts/` directory reduces bootstrap friction and avoids a class of failures where CI or release tooling depends on generated script output that is missing, stale, or built with different assumptions.

## Links

- [package.json](../package.json)
- [scripts/build-antora-site.js](../scripts/build-antora-site.js)
- [scripts/release.js](../scripts/release.js)
- [[Internal API Stabilization]]
