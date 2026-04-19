---
id: 20260420120400
title: Internal API Stabilization
tags: ["architecture", "api", "refactor"]
status: design
---
The system must stabilize internal interfaces before adding plugins.

## Interfaces

- RenderEngine
- StructuredPlan
- TokenizerProvider
- ScannerPipeline

## What

CLI depends on interfaces, not implementations.

## Why

Without stable APIs:

- refactoring becomes fragile
- plugins become brittle
- tests become tightly coupled

## Rule

All new subsystems must implement defined interfaces.

## Links

- [[Render Kernel Constitution]]
