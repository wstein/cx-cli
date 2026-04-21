---
id: 20260421103600
title: XML In cx Means XML Tagged LLM Content
aliases: [xml meaning in cx, xml tagged llm content, xml in cx is not strict xml]
tags: [xml, llm, formats, contracts, output]
target: current
---
# XML In cx Means XML Tagged LLM Content

In `cx`, `xml` means xml-tagged plain text for LLM-facing artifacts unless a surface explicitly declares a stricter machine contract, because most `cx` xml outputs are semantic prompt structures rather than full XML serialization boundaries.

## What

When `cx` exposes an `xml` output for handover or notes-extract workflows,
the intended contract is:

- plain text first
- stable XML-like tag sections
- LLM-friendly semantic anchors
- reviewable diff-friendly structure

It is not automatically:

- a strict XML document
- a schema-governed interchange format
- a promise of XML parser compatibility for the whole artifact

## Why

Calling these artifacts `xml` is still useful because the tag vocabulary
signals structure clearly to humans and models.

But treating every `xml` surface as a true XML serialization contract
would overstate what the repository is actually promising and would blur
the difference between:

- semantic LLM guidance artifacts
- strict machine interchange formats

That distinction keeps bundle and handover formats honest about their
real consumers.

## How

Read `xml` in `cx` as xml-tagged LLM content by default.

Only treat a surface as a strict XML contract if the docs, tests, and
implementation say so explicitly.

For notes extraction specifically, `.llm.xml` means xml-tagged plain text
with embedded machine payload markers, not a full XML document contract.

## Links

- [[XML Handover Tag Semantics]] - Shared handover already uses XML-style tags as semantic anchors rather than full serialization.
- [[cx notes extract should emit LLM centric structured bundles]] - Notes extraction uses xml-tagged bundles for LLM-facing structure.
- [[Manual LLM Synthesis Workflow For Notes Extract Bundles]] - Manual synthesis consumes the xml-tagged bundle as a prompt artifact.
- [[Top-Level JSON Payload Contracts]] - JSON remains the stricter machine contract where that boundary is intended.
