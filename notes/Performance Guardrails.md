---
id: 20260420120800
title: Performance Guardrails
tags: ["ci", "performance"]
status: current
---
Performance must be enforced, not assumed.

## Metrics

- fast-lane runtime
- bundle runtime
- verify runtime

## Rule

CI must fail on significant regression.

## Why

Complex systems degrade silently without guardrails.

## How

- track fast-lane timing drift over time
- keep slow bundle and verify paths visible in focused lanes
- treat regression thresholds as governance, not optional dashboards

## Links

- [[Test Strategy Hardening]]
- [[GitHub Actions Triggers]]
- [[Developer Command Workflow]]
- `scripts/ci-observability-report.js`
