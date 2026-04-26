---
id: 20260421103600
title: XML In cx Means XML Tagged LLM Content
aliases: [xml meaning in cx, xml tagged llm content, xml in cx is not strict xml]
tags: [xml, llm, formats, contracts, output]
---
# XML In cx Means XML Tagged LLM Content

In `cx`, `xml` means xml-tagged plain text for LLM-facing artifacts unless a surface explicitly declares a stricter machine contract, because most `cx` xml outputs are semantic prompt structures rather than full XML serialization boundaries.

## What

When `cx` exposes an `xml` output for handover workflows, the intended
contract is:

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

The note graph no longer exposes a notes-extraction XML bundle surface. Treat
future XML outputs as surface-specific contracts rather than assuming a generic
notes bundle format exists.

## Links

- [[XML Handover Tag Semantics]] - Shared handover already uses XML-style tags as semantic anchors rather than full serialization.
- [[Top-Level JSON Payload Contracts]] - JSON remains the stricter machine contract where that boundary is intended.
