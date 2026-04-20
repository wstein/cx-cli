# Scripts Directory

`/scripts` is the repository's direct operational tooling surface.

## Rule

This directory must contain executable ECMAScript and JavaScript files only.
Do not add TypeScript source or declaration files here.

Allowed:

- `.js`
- supporting runtime assets if a script genuinely needs them

Not allowed:

- `.ts`
- `.mts`
- `.cts`
- `.d.ts`

## Why

These files are used directly by:

- local verification and release flows
- CI jobs
- smoke scripts
- Pages assembly and publishing

They should stay runnable by the checked-in Node runtime without requiring a TypeScript compilation step first.

## Guidance

- keep operational entrypoints in JavaScript
- keep type-heavy internal contracts in `src/` instead of `scripts/`
- if a script needs shared logic, prefer importing built runtime code or writing the script in straightforward JavaScript
