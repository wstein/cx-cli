// test-lane: unit
import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  type NoteDocument,
  validateNoteDocuments,
  validateNotes,
} from "../../src/notes/validate.js";

function doc(fileName: string, content: string): NoteDocument {
  return {
    filePath: path.posix.join("notes", fileName),
    content,
  };
}

describe("validateNoteDocuments", () => {
  test("accepts valid note ids and parses metadata", () => {
    const result = validateNoteDocuments([
      doc(
        "valid-id.md",
        `---
id: 20250113143015
aliases: ["alias-a"]
tags: ["tag-a"]
---

# Valid Note

This note is valid.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.id).toBe("20250113143015");
    expect(result.notes[0]?.aliases).toEqual(["alias-a"]);
    expect(result.notes[0]?.tags).toEqual(["tag-a"]);
  });

  test("missing frontmatter id produces error", () => {
    const result = validateNoteDocuments([
      doc(
        "no-id.md",
        `---
aliases: []
tags: []
---

# Test
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "Missing required frontmatter field: id",
    );
  });

  test("trims whitespace-only aliases", () => {
    const result = validateNoteDocuments([
      doc(
        "trim.md",
        `---
id: 20250113143015
aliases: ["valid", "   ", "other"]
tags: []
---

# Test
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.aliases).toEqual(["valid", "other"]);
  });

  test("extracts title from H1 when frontmatter title is absent", () => {
    const result = validateNoteDocuments([
      doc(
        "h1-title.md",
        `---
id: 20250113143015
aliases: []
tags: []
---

# Extracted From Heading

Body text.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.title).toBe("Extracted From Heading");
  });

  test("uses frontmatter title when provided", () => {
    const result = validateNoteDocuments([
      doc(
        "fm-title.md",
        `---
id: 20250113143015
aliases: []
tags: []
title: "From Frontmatter"
---

# This H1 is ignored

Body.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.title).toBe("From Frontmatter");
  });

  test("rejects non-array aliases", () => {
    const result = validateNoteDocuments([
      doc(
        "bad-aliases.md",
        `---
id: 20250113143015
aliases: "not-an-array"
tags: []
---

# Test
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain("must be an array");
  });

  test("invalid ID format includes timestamp guidance", () => {
    const result = validateNoteDocuments([
      doc(
        "bad-id.md",
        `---
id: not-a-timestamp
aliases: []
tags: []
---

# Test
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain("Invalid note ID format");
    expect(result.errors[0]?.error).toContain("YYYYMMDDHHMMSS");
  });

  test("duplicate IDs are reported across documents", () => {
    const note = `---
id: 20250113143015
aliases: []
tags: []
---

# Note
`;
    const result = validateNoteDocuments([
      doc("note-a.md", note),
      doc("note-b.md", note),
    ]);

    expect(result.valid).toBe(false);
    expect(result.duplicateIds).toHaveLength(1);
    expect(result.duplicateIds[0]?.id).toBe("20250113143015");
    expect(result.duplicateIds[0]?.files).toEqual([
      "notes/note-a.md",
      "notes/note-b.md",
    ]);
  });

  test("extracts summary from body paragraph before links section", () => {
    const result = validateNoteDocuments([
      doc(
        "summary.md",
        `---
id: 20260413123030
aliases: []
tags: []
---

# Summary Note

This note explains the first useful idea.
It should become the manifest summary.

## Links

- [[Other Note]]
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.summary).toBe(
      "This note explains the first useful idea. It should become the manifest summary.",
    );
  });

  test("derives title from filename when frontmatter and H1 are absent", () => {
    const result = validateNoteDocuments([
      doc(
        "20260413120130-vcs-master-base.md",
        `---
id: 20260413120130
aliases: []
tags: []
---

Plain body only.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.title).toBe("vcs-master-base");
  });

  test("invalid date components in ids are rejected", () => {
    const invalidIds = [
      "20251313143015",
      "20250132143015",
      "20250113256015",
      "20250113136015",
      "20250113143060",
    ];

    const result = validateNoteDocuments(
      invalidIds.map((id) =>
        doc(
          `${id}.md`,
          `---
id: ${id}
aliases: []
tags: []
---

# Invalid Timestamp
`,
        ),
      ),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(invalidIds.length);
    for (const issue of result.errors) {
      expect(issue.error).toContain("Invalid note ID format");
    }
  });
});

describe("validateNotes", () => {
  let tempRoot: string | undefined;

  afterEach(async () => {
    if (tempRoot !== undefined) {
      await fs.rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  test("returns an empty valid result when notes directory is missing", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-missing-"));
    const result = await validateNotes("nonexistent", tempRoot);

    expect(result.valid).toBe(true);
    expect(result.notes).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.duplicateIds).toEqual([]);
  });
});
