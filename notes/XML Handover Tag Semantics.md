---
id: 20260420134100
aliases: []
tags: ["handover", "xml", "llm"]
---
XML-style shared handover tags are semantic LLM anchors, not a full XML serialization contract.

## What

The XML-flavored shared handover stays primarily plain text. It uses a small set of rare XML tag sections such as `<section_inventory>` and `<recent_repository_history>` to mark important semantic regions for human and model readers. Section handover prologs follow the same sparse-anchor philosophy with tags such as `<section_identity>` and `<authoritative_semantics>`.

## Why

Full XML serialization would overstate the contract and make the handover read like a machine-native document. The shared handover is a guidance artifact, so sparse tags give structure cues without pretending the whole file is governed by XML parsing rules.

## How

Keep XML handover output readable as plain text first. Add only stable, high-signal tag blocks for shared semantics, and lock that vocabulary with contract tests. Do not treat the XML-style handover as a generic XML schema surface.

## Links

- [[Shared Handover Uses Same Output Family As Section Outputs]] - The handover follows the output family while keeping guidance-first semantics.
- [[Shared Handover Includes Recent Repository History]] - History blocks are sparse semantic anchors rather than full XML serialization.
- [[Top-Level JSON Payload Contracts]] - JSON artifacts use schema contracts where machine-readable structure is the actual surface.
- [[Render Kernel Constitution]] - The kernel owns the deterministic artifact contract and presentation boundaries.
