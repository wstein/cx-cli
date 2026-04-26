---
id: 20260420122300
title: Shared Handover Is The First Native Render Migration Candidate
tags: ["migration", "render", "handover"]
---
The shared handover artifact is now the first native kernel-rendered artifact, proving the render migration with a real deterministic output before full section rendering moves over.

## What

Before replacing section rendering, implement the new native render path for the shared handover artifact.

## Why

This is the safest first migration target because the handover artifact is:

- small
- deterministic
- low token cost
- structurally important
- less risky than full section rendering

It exercises the new rendering architecture without immediately taking over the full proof path.

## How

Migration sequence:

1. replace the old bundle-index text builder with native handover rendering
2. keep style parity with existing bundle output family
3. add bounded repository history
4. validate naming and manifest wiring
5. use this as the first production path of the native render library

## Rule

Use the handover artifact to prove the native rendering architecture before moving full section rendering onto it.

## Links

- [[Native Render Migration Strategy]]
- [[Repomix Decommission Strategy]]
- [[Render Kernel Constitution]]
