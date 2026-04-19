---
id: 20260420122100
title: Shared Handover Includes Recent Repository History
tags: ["handover", "repo-history", "context"]
status: design
---
The shared handover artifact should carry a short bounded repository history so agents and operators can see recent project motion without needing a separate artifact or a broad repository scan.

## What

Include a recent repository history block in the shared handover artifact:

- last 20 commits
- no diffs
- bounded message length
- deterministic ordering

The goal is to give agents a compact sense of project motion without expanding artifact count.

## Why

A short recent history helps an LLM understand:

- active themes
- recent refactors
- naming drift
- current development priorities

This context is often more useful than broad repository scans.

## How

Default policy:

- include last 20 commits
- subject line only by default
- truncate deterministically
- omit diffs
- keep newest/oldest ordering fixed and documented

## Rule

Repository history must stay small and deterministic. It is context, not a changelog replacement.

## Links

- [[System Trust Contract]]
- [[Release Candidate on Develop]]
- [[Token Accounting]]
