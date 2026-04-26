---
id: 20260420120900
title: Contributor Constraints
tags: ["governance", "contrib"]
---
The system must guide contributors strictly.

## Rules

- do not modify kernel invariants
- do not bypass tests
- do not introduce implicit behavior
- respect doc hierarchy

## Why

Complex systems fail from uncontrolled contributions.

## How

- preserve explicit boundaries between proof, hypothesis, and memory
- prefer tightening contracts over adding implicit fallback behavior
- keep docs and notes aligned with the current operating model

## Links

- [[System Trust Contract]]
- [[Developer Command Workflow]]
- `docs/modules/ROOT/pages/repository/docs/governance.adoc`
- [[Test Strategy Hardening]]
