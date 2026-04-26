---
id: 20260420120200
title: Trust Model Formalization
tags: ["trust", "manifest", "security"]
---
Trust is not implicit. It must be explicit and machine-readable.

## Trust levels

- source tree: trusted
- notes: conditional
- agent output: untrusted_until_verified
- bundle: trusted

## What

Trust must be encoded in:

- manifest
- CI validation
- CLI output

## Why

Automation must not guess trust.

## Rule

If trust is not recorded, it is not guaranteed.

## Links

- [[System Trust Contract]]
- [[Friday Night Monday Morning Provenance]]
