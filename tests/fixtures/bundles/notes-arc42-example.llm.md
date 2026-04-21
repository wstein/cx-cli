<!-- cx-notes-llm-bundle:v1 -->
<!-- profile: arc42 -->
<!-- canonical: notes -->
<!-- source: notes/**/*.md -->
<!-- target_paths: docs/modules/ROOT/pages/architecture/index.adoc -->

# CX Notes LLM Bundle

## Profile
- Name: arc42
- Description: Compile canonical notes into an arc42-oriented LLM bundle for architecture documentation.
- Output format: asciidoc
- Document kind: arc42 architecture
- Audience: architects-and-maintainers
- Tone: formal-technical
- Target paths: docs/modules/ROOT/pages/architecture/index.adoc

## Authoring Contract
- System role: You are a senior software architect and technical writer.
- Write arc42-style architecture documentation in AsciiDoc. Use notes as canonical truth. Do not invent new invariants. Surface conflicts explicitly. Prefer explanation over note concatenation.
- Must cite note titles: yes
- Must preserve uncertainty: yes
- Must not invent facts: yes
- Must include provenance: yes
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

## Machine Payload
<!-- cx-notes-bundle-payload:start -->
```json
{
  "version": "1",
  "profile": {
    "name": "arc42",
    "description": "Compile canonical notes into an arc42-oriented LLM bundle for architecture documentation.",
    "outputFormat": "markdown",
    "targetPaths": [
      "docs/modules/ROOT/pages/architecture/index.adoc"
    ],
    "includeTargets": [
      "current",
      "v0.4"
    ],
    "includeTags": [],
    "excludeTags": [],
    "requiredNotes": [
      "Render Kernel Constitution"
    ],
    "requiredSections": [
      "introduction-and-goals",
      "constraints",
      "solution-strategy",
      "building-block-view",
      "runtime-view",
      "cross-cutting-concepts",
      "quality-scenarios",
      "risks-and-technical-debt",
      "reference-notes"
    ]
  },
  "authoringContract": {
    "systemRole": "You are a senior software architect and technical writer.",
    "instructions": "Write arc42-style architecture documentation in AsciiDoc. Use notes as canonical truth. Do not invent new invariants. Surface conflicts explicitly. Prefer explanation over note concatenation.",
    "targetFormat": "asciidoc",
    "documentKind": "arc42 architecture",
    "audience": "architects-and-maintainers",
    "tone": "formal-technical",
    "mustCiteNoteTitles": true,
    "mustPreserveUncertainty": true,
    "mustNotInventFacts": true,
    "mustIncludeProvenance": true,
    "mustSurfaceConflicts": true
  },
  "provenance": {
    "canonicalSource": "notes",
    "sourceGlob": "notes/**/*.md",
    "workspaceRoot": "/example/workspace",
    "generationCommand": "cx notes extract --profile arc42 --format markdown"
  },
  "sections": [
    {
      "id": "introduction-and-goals",
      "title": "Introduction and Goals",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "constraints",
      "title": "Constraints",
      "noteCount": 1,
      "noteIds": [
        "20260421170000"
      ]
    },
    {
      "id": "solution-strategy",
      "title": "Solution Strategy",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "building-block-view",
      "title": "Building Block View",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "runtime-view",
      "title": "Runtime View",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "cross-cutting-concepts",
      "title": "Cross-cutting Concepts",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "quality-scenarios",
      "title": "Quality Scenarios",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "risks-and-technical-debt",
      "title": "Risks and Technical Debt",
      "noteCount": 0,
      "noteIds": []
    },
    {
      "id": "reference-notes",
      "title": "Reference Notes",
      "noteCount": 0,
      "noteIds": []
    }
  ],
  "notes": [
    {
      "id": "20260421170000",
      "title": "Render Kernel Constitution",
      "path": "notes/Render Kernel Constitution.md",
      "target": "current",
      "aliases": [],
      "tags": [
        "architecture",
        "contract",
        "kernel"
      ],
      "summary": "The render kernel owns the production proof path and remains the canonical rendering boundary.",
      "codeLinks": [
        "src/cli/main.ts"
      ],
      "noteLinks": [],
      "sections": [
        {
          "key": "what",
          "title": "What",
          "content": "The native kernel is the canonical rendering and verification boundary."
        },
        {
          "key": "why",
          "title": "Why",
          "content": "This keeps production trust anchored in deterministic kernel artifacts."
        },
        {
          "key": "how",
          "title": "How",
          "content": "Use oracle tooling only for parity diagnostics and reference comparison."
        }
      ],
      "body": "The render kernel owns the production proof path and remains the canonical rendering boundary.\n\n## What\n\nThe native kernel is the canonical rendering and verification boundary.\n\n## Why\n\nThis keeps production trust anchored in deterministic kernel artifacts.\n\n## How\n\nUse oracle tooling only for parity diagnostics and reference comparison.\n",
      "assignedSection": "constraints",
      "assignedSectionTitle": "Constraints"
    }
  ]
}
```
<!-- cx-notes-bundle-payload:end -->

## Canonical Notes

### Section: Constraints
- Section id: constraints
- Note count: 1

#### Note: Render Kernel Constitution
- Note id: 20260421170000
- Path: notes/Render Kernel Constitution.md
- Target: current
- Tags: architecture, contract, kernel
- Aliases: (none)
- Code links: src/cli/main.ts
- Note links: (none)

##### Summary
The render kernel owns the production proof path and remains the canonical rendering boundary.

##### What
The native kernel is the canonical rendering and verification boundary.

##### Why
This keeps production trust anchored in deterministic kernel artifacts.

##### How
Use oracle tooling only for parity diagnostics and reference comparison.
