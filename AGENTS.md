# AGENTS.md

Agent context for OpenAI Codex. This file is read automatically by the Codex sandbox at session start.

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

## Sandbox Awareness
The Codex sandbox has network access disabled by default during code execution.
- Do not make HTTP requests in tests — mock all external calls.
- Do not rely on system-installed tools; use project-local tooling and Bun.
- The sandbox resets between sessions — do not rely on persistent state outside the repo.

## Task Execution Guidance
- Break implementation work into multiple phases.
- After each phase, prepare changes that can be described with a conventional commit style message.
- Avoid backward compatibility work unless explicitly requested.
- Do not write PoC or MVP quality code; produce production-ready implementation.
- Preserve manual edits and do not revert or undo them.
- Keep the codebase clean and focused; avoid introducing technical debt.
- Use `bd` for task tracking and workflow management.
- Polish language, fix typos, and keep documentation accurate.

## Conventions Inferred from Codebase
**Commit prefix style:** `chore(ci)`, `fix`, `docs`, `feat(devcontainer)`, `feat(init)` (follow this pattern)
**Common file extensions:** `.ts`, `.md`, `.json`, `.yml`, `[no_ext]`

## apply_patch Usage
When modifying files, prefer `apply_patch` over full-file writes for surgical changes:
- Keep patches small and focused on the minimal diff.
- After applying a patch, run the test command to verify correctness.
- Use `apply_patch` with `create` action for new files and `modify` for existing ones.
- For large structural refactors, consider writing the full new file instead of a complex patch.

## Approval Gates
Before marking a task complete, verify ALL of the following:
- [ ] Tests pass
- [ ] No unintended files modified (`git diff --stat`)
- [ ] New code has corresponding tests for behavior changes
- [ ] Commit message follows the repository prefix convention

## Anti-Patterns to Avoid
- **Do not** make network calls in the sandbox.
- **Do not** commit secrets, API keys, or credentials.
- **Do not** delete tests to make the suite pass.
- **Do not** modify test fixtures or golden files without understanding why.
- **Do not** introduce new dependencies without justification.
- **Do not** skip linting or type-checking steps.

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
