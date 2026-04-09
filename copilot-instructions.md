# Copilot Instructions

GitHub Copilot context for this repository. Copilot uses this file to tailor suggestions to the project's conventions.

## Project Overview
**Primary languages:** TypeScript/JavaScript
**Package manager:** Bun
**CI:** GitHub Actions

## Build, Test, and Lint Commands
- `bun install`
- `bun run build` (`bun tsc`)
- `bun run test`
- `bun run lint` (`bun tsc --noEmit`)

## Directory Structure
**Top-level directories:** `.devcontainer`, `.github`, `.vscode`, `docs`, `notes`, `src`
**Source roots:** `src`
**Most-changed directories:** `src`, `README.md`, `.devcontainer`, `.github`, `docs`

## Coding Standards
- Use TypeScript module syntax compatible with Bun.
- Keep functions small, explicit, and easy to test.
- Use `const` for values that do not change.
- Keep naming clear and descriptive.
- Preserve existing formatting and style when making edits.

## Test Patterns
- Tests run via `bun test`.
- Test files follow `*.test.ts` naming and often sit alongside source code.
- Do not remove or silence tests to make CI pass.

## Task Execution Guidance
- Break work into multiple phases with focused scope.
- Prefer production-ready implementation over prototypes.
- Avoid backward compatibility unless requested.
- Do not revert manual edits or remove prior input.
- Keep changes small, targeted, and well-scoped.

## Conventions Inferred from Codebase
**Commit prefix style:** `chore(ci)`, `fix`, `docs`, `feat(devcontainer)`, `feat(init)` (follow this pattern)
**Common file extensions:** `.ts`, `.md`, `.json`, `.yml`, `[no_ext]`

## PR Review Checklist
Copilot should flag suggestions or changes that violate any of the following:

- [ ] All new public functions have type annotations and docstrings.
- [ ] No hardcoded secrets, credentials, or environment-specific paths.
- [ ] New behavior is covered by at least one test.
- [ ] Existing tests are not deleted or skipped to make CI pass.
- [ ] Dependencies added are justified and reflected in `package.json`.
- [ ] Commit messages follow the project prefix convention.
