---
id: 20260419173000
title: Pages Smoke Validation Workflow
aliases: []
tags: [ci, pages, validation]
---
The Pages publish path should validate the staged `dist/site/` tree with a small smoke checker before the workflow pushes `gh-pages`. That validation should stay non-blocking inside the publish path while also existing as a dedicated workflow, so operators get fast feedback without turning a deploy warning into a hidden blind spot.

This matters because Pages assembly and Pages publication are different contracts. A smoke check proves the staged tree still contains the expected root links, schema index, coverage entrypoint, and `.nojekyll` marker even when workflow logic changes.

How to apply it:

- build the public tree with `bun run pages:build`
- validate it with `bun run pages:smoke`
- keep the publish-workflow smoke step non-blocking, but run the same checker in a dedicated `Pages Smoke` workflow for earlier visibility

## Links

- [.github/workflows/pages-smoke.yml](../.github/workflows/pages-smoke.yml)
- [.github/workflows/publish-schemas.yml](../.github/workflows/publish-schemas.yml)
- [scripts/check-pages-site.js](../scripts/check-pages-site.js)
- [[Unified Pages Site Assembly]]
- [[Pages Coverage Publish Gate]]
