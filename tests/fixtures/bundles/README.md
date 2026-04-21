# Notes Extract Bundle Fixtures

These files are downstream-tooling sample bundles for `cx notes extract`.

They exist so tests and experiments can use stable examples of the
shipped bundle surface without needing to regenerate a bundle first.

Current fixtures:

- `notes-arc42-example.md`
- `notes-arc42-example.xml`
- `notes-arc42-example.json`
- `notes-arc42-example.txt`

Rules:

- keep `notes-arc42-example.json` parseable with
  `parseNotesExtractBundleContent(...)`
- keep the non-JSON fixtures aligned with the human-facing render output
- keep them aligned with the built-in `arc42` profile contract
- treat `.xml` as xml-tagged plain text for LLMs, not as a strict XML
  document contract
