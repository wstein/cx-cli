---
id: 20260430164125
title: MCP Audit Request Tracing
aliases: ["MCP request tracing", "audit request tracing"]
tags: [architecture, mcp, audit, observability]
---
# MCP Audit Request Tracing

MCP audit logging must capture the request the agent actually made, not only the policy decision that allowed or denied it.

The current audit log is strong at policy traceability because it records capability, policy name, and decision basis for each tool invocation. That is enough to explain why a tool was visible or blocked, but it is not enough to explain what the agent intended to do with the tool once it asked for access. Team review, incident response, and prompt-quality debugging all need a request-aware trace.

The durable design is to keep one audit ledger while extending each event with a request envelope and execution status. The ledger should record sanitized tool arguments, a human-readable agent reason, and stable correlation ids that tie events back to a session and user turn. It should also record whether the request later succeeded, failed, or timed out so "allowed" no longer implies "completed successfully."

Redaction is part of the contract, not a later hardening pass. Free-form fields such as note bodies, replacement text, prompts, and large content blobs should never be copied into the audit log verbatim. The log should keep structural metadata, path hints, hashes, lengths, and small previews where that improves reviewability without turning the audit trail into a replay channel or a secret sink.

Implementation belongs at the MCP tool registration boundary because that is the one place where every tool call has a normalized tool name, typed arguments, policy context, and final execution status.

## Links

- [[Agent Operating Model]] - The operator-facing integration layer that consumes the audit trail.
- [[MCP Tool Intent Taxonomy]] - Capability and intent groupings that shape audit classification.
- [[System Trust Contract]] - Why agent output remains untrusted until verified.
