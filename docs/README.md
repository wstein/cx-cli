# CX Docs Folder

`docs/` now holds the canonical Antora component for the curated documentation site.

## Layout

- `antora.yml` defines the Antora component descriptor
- `modules/ROOT/pages/` contains the front door, shared pages, repository-reference pages, and the Run / Understand split
- `modules/onboarding/pages/` contains first-contact orientation and the docs-index surface
- `modules/manual/pages/` contains the Run track for operator workflows, command references, audited overrides, and release guidance
- `modules/architecture/pages/` contains the Understand track for the arc42 spine, mental model, and focused architecture contracts
- `modules/ROOT/partials/` contains shared local primers and reusable fragments
- `modules/*/nav.adoc` defines the curated site navigation for each published module
- `ui/` contains the local Antora UI bundle
- `packages/` is reserved for future package-level docs assets

## Architecture spine

The curated architecture corpus uses arc42 as its spine inside the Antora site:

- introduction and goals
- constraints
- context and scope
- solution strategy
- building block view
- runtime view
- deployment view
- cross-cutting concepts
- decisions and history
- quality requirements
- risks
- glossary

Those chapters live under `docs/modules/architecture/pages/`.

## Boundaries

- `docs/` is for curated canonical documentation only
- `notes/` remains the separate cognition layer and is not part of the Antora site
- repository-root Markdown like `README.md` and `CHANGELOG.md` may still be projected into the published docs as repository companions, but they are not part of the curated `docs/` source tree

## Start points

- Source front door: [docs/modules/ROOT/pages/index.adoc](modules/ROOT/pages/index.adoc)
- Run track: [docs/modules/manual/pages/index.adoc](modules/manual/pages/index.adoc)
- Understand track: [docs/modules/architecture/pages/index.adoc](modules/architecture/pages/index.adoc)
- Published docs: https://wstein.github.io/cx-cli/docs/
- Single-file exports are emitted at `dist/antora/cx/0.4/_exports/manual.html` and `dist/antora/cx/0.4/_exports/architecture.html`.
