---
id: 20260420110800
title: Kernel vs Extension Boundary
tags: ["architecture", "boundary", "plugins"]
target: v0.4
---
The system enforces a strict separation between kernel and extensions.

## Kernel owns

- rendering (xml, markdown, json, plain)
- span mapping
- structured plan
- hashing
- manifest
- extraction safety

## Extensions may

- scan
- analyze
- report
- provide alternate views

## Extensions may NOT

- alter file ordering
- modify spans
- change hashing inputs
- redefine proof semantics

## Why

Proof must remain stable and auditable.

## Links

- [[Render Kernel Constitution]]
- [[Plugin System Model]]
- [[System Trust Contract]]
