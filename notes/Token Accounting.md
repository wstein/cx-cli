---
id: 20260415124500
aliases: ["Token Accounting", "o200k_base"]
tags: ["configuration", "tokens"]
status: current
---
`cx` calculates and persistently stores exact token counts for every section and file directly in the manifest. By default, it utilizes the `o200k_base` encoding, which is the recommended tokenizer for modern OpenAI chat and reasoning models like GPT-4o and o1. Recording these counts at bundle time ensures that downstream verification tooling and LLM agents can reuse the exact token accounting without relying on byte-based guesses or re-running tokenization in a different environment.

## Links
* [[Manifest-Side Note Summaries]]
* [[Deterministic Hashing Strategy]]
* [[Operational Bifurcation]]
