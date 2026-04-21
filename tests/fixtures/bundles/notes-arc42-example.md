<!-- cx-notes-llm-bundle:v1 -->
<!-- profile: arc42 -->
<!-- canonical: notes -->
<!-- source: notes/**/*.md -->
<!-- target_paths: docs/modules/architecture/pages/index.adoc -->

# CX Notes LLM Bundle

## Profile
- Name: arc42
- Description: Compile canonical notes into an arc42-oriented LLM bundle for architecture documentation.
- Output format: asciidoc
- Document kind: arc42 architecture
- Audience: architects-and-maintainers
- Tone: formal-technical
- Target paths: docs/modules/architecture/pages/index.adoc

## Authoring Contract
- System role: You are a senior software architect and technical writer.
- Update arc42-style architecture documentation in AsciiDoc. Treat the codebase and notes as the single source of truth. Do not invent new invariants. Surface conflicts explicitly. Prefer explanation over note concatenation. Update only the relevant chapters and use partials when useful.
- Must cite note titles: yes
- Must preserve uncertainty: yes
- Must not invent facts: yes
- Must include provenance: no
- Must surface conflicts: yes

## Required Sections
1. Introduction and Goals
2. Constraints
3. Solution Strategy
4. Building Block View
5. Runtime View
6. Cross-cutting Concepts
7. Quality Scenarios
8. Risks and Technical Debt
9. Reference Notes

## Provenance
- Canonical source: notes
- Source glob: notes/**/*.md
- Generation command: cx notes extract --profile arc42 --format markdown

## Canonical Notes

### Section: Introduction and Goals
- Section id: introduction-and-goals
- Note count: 1

#### Note: Render Kernel Constitution
- Note id: 20260421170000
- Path: notes/Render Kernel Constitution.md
- Target: current
- Tags: architecture, contract, kernel
- Aliases: (none)
- Code links: src/cli/main.ts
- Note links: src/cli/main.ts

##### Summary
The render kernel owns the production proof path and remains the canonical rendering boundary.

##### Summary
The render kernel owns the production proof path and remains the canonical rendering boundary.

##### What
The native kernel is the canonical rendering and verification boundary.

##### Why
This keeps production trust anchored in deterministic kernel artifacts.

##### How
Use oracle tooling only for parity diagnostics and reference comparison.

##### Links
- [[src/cli/main.ts]]

### Section: Constraints
- Section id: constraints
- Note count: 0

### Section: Solution Strategy
- Section id: solution-strategy
- Note count: 0

### Section: Building Block View
- Section id: building-block-view
- Note count: 0

### Section: Runtime View
- Section id: runtime-view
- Note count: 0

### Section: Cross-cutting Concepts
- Section id: cross-cutting-concepts
- Note count: 0

### Section: Quality Scenarios
- Section id: quality-scenarios
- Note count: 0

### Section: Risks and Technical Debt
- Section id: risks-and-technical-debt
- Note count: 0

### Section: Reference Notes
- Section id: reference-notes
- Note count: 0
