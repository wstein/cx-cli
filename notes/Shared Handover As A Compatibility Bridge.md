---
id: 20260420122600
title: Shared Handover As A Compatibility Bridge
tags: ["migration", "compatibility", "handover"]
status: design
---
The shared handover is the ideal bridge artifact between the old Repomix-centered implementation and the new native render kernel because it is small enough to migrate first but important enough to prove the new architecture is real.

## What

The handover artifact can validate:

- new renderer shape
- style-aware output families
- manifest wiring
- bounded repo-history inclusion
- deterministic non-section rendering

## Why

It is small enough to migrate first, but important enough to prove the new architecture is real.

## How

Use the shared handover migration to establish:

- kernel-owned rendering for a real artifact
- compatibility tests for same-format output families
- naming transition away from "bundle index"

## Rule

The first migration target should prove architecture, not maximize blast radius.

## Links

- [[Shared Handover Uses Same Output Family As Section Outputs]]
- [[Shared Handover Includes Recent Repository History]]
- [[Repomix Decommission Strategy]]
