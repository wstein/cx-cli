---
id: 20260425130400
aliases: ["cx ask", "cx evidence bundles"]
tags: ["cx", "notes", "llm", "retrieval", "stable"]
target: current
---

`cx notes ask` answers questions from bounded evidence bundles rather than from free-form repository search alone.

## What

A repository question should resolve to a curated bundle of:

- matched notes
- matched specs
- matched code
- matched tests
- matched docs

## Why

Humans and LLMs both need evidence boundaries to reduce hallucination, ambiguity, and stale answers.

## How

`cx notes ask "<question>"` outputs both an answer scaffold and an evidence bundle with provenance and confidence markers.

## Links

- [[CX Notes Graph Is the Repository Cognition Layer]]
- [[CX Notes Extract Is the Retrieval Workhorse]]
- [[CX Docs Compile From Notes and Code]]
