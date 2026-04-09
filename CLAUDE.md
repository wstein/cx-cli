# CLAUDE.md

Agent context for Claude Code. Keep this file up to date as the project evolves.

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

## Task Execution Guidance
- Break implementation work into multiple phases.
- After each phase, make changes that can be described with a conventional commit-style message.
- Avoid backward compatibility unless explicitly requested.
- Do not produce PoC or MVP quality code; implement production-ready behavior.
- Do not revert manual edits or undo existing work.
- Keep the codebase clean and focused; avoid introducing technical debt.
- Polish wording and fix typos in code and documentation.

## Conventions Inferred from Codebase
**Commit prefix style:** `chore(ci)`, `fix`, `docs`, `feat(devcontainer)`, `feat(init)` (follow this pattern)
**Common file extensions:** `.ts`, `.md`, `.json`, `.yml`, `[no_ext]`

## Claude Code Tips
- Use `/compact` when context grows large mid-session.
- Use `/review` before final commits.
- Use `/init` in a new checkout to re-read this file.
- Open multiple files in one message when changes span related areas.
- Prefer small, targeted edits over broad full-file rewrites.

## Style Guide
- Keep TypeScript code idiomatic and explicit.
- Prefer `const` and `readonly` for stable values.
- Keep functions small and easy to test.
- Use Bun-compatible module syntax and imports.

## Anti-Patterns to Avoid
- **Do not** make broad refactors outside the task scope.
- **Do not** remove or skip tests to make CI green.
- **Do not** add dependencies without justification.
- **Do not** leave `TODO` comments without a linked issue or clear next step.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
