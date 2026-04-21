---
id: 20260421120200
title: cx notes extract should emit LLM centric structured bundles
aliases: [LLM bundle output, notes extract output format, structured prompt bundle]
tags: [cx, notes, llm, output, formats]
target: current
---
# cx notes extract should emit LLM centric structured bundles

`cx notes extract` emits LLM-centric structured bundles because the command's primary consumer is not a human reader but a constrained synthesis step that needs canonical content, explicit instructions, and durable section boundaries.

## What

The preferred output of `cx notes extract` is a structured bundle designed for LLM ingestion.

Suitable formats include:
- LLM-oriented Markdown
- plaintext with explicit tagged sections
- XML with tagged semantic sections

The output should contain:
- bundle metadata
- profile metadata
- authoring contract
- required document sections
- ordered canonical notes
- provenance

The output is not intended to be polished human documentation.

## Why

Human-friendly documents and LLM-friendly inputs are different artifacts.

A human-readable architecture guide needs narrative flow, but an LLM bundle needs:
- structure
- explicit instruction boundaries
- deterministic ordering
- source traceability
- machine-friendly segmentation

Producing an LLM-centric bundle keeps the extraction layer honest about its real consumer and avoids conflating prompt material with final docs.

## How

Support explicit output modes such as:
- `llm-markdown`
- `llm-xml`
- `plain`

Prefer structured section markers over free-form prose.

The bundle should be easy to diff, easy to validate, and easy to hand to
a later manual LLM synthesis step or equivalent downstream workflow.

Do not optimize the extraction output for casual human reading at the expense of machine structure.

## Links

- [[cx notes extract compiles canonical notes into profile scoped LLM bundles]]
- [[XML Handover Tag Semantics]]
- [[Shared Handover Uses Same Output Family As Section Outputs]]
