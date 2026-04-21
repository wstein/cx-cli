# Notes Extract Bundle Fixtures

These files are downstream-tooling sample bundles for `cx notes extract`.

They exist so tests and experiments can use stable, parseable examples of
the shipped bundle surface without needing to regenerate a bundle first.

Current fixtures:

- `notes-arc42-example.llm.md`
- `notes-arc42-example.llm.xml`
- `notes-arc42-example.llm.json`
- `notes-arc42-example.llm.txt`

Rules:

- keep them parseable with `parseNotesExtractBundleContent(...)`
- keep them aligned with the built-in `arc42` profile contract
- treat `.llm.xml` as xml-tagged plain text for LLMs, not as a strict XML
  document contract
