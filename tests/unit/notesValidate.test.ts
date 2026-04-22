// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  NOTE_VALIDATION_LIMITS,
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
target: current
---

# Valid Note

This note is valid for cognition routing now.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.id).toBe("20250113143015");
    expect(result.notes[0]?.target).toBe("current");
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
target: current
---

# Test

This note has a real summary paragraph.
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "Missing required frontmatter field: id",
    );
  });

  test("missing frontmatter target produces error", () => {
    const result = validateNoteDocuments([
      doc(
        "no-status.md",
        `---
id: 20250113143015
aliases: []
tags: []
---

# Test

This note has a real summary paragraph now.
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "Missing required frontmatter field: target",
    );
  });

  test("invalid target value produces error", () => {
    const result = validateNoteDocuments([
      doc(
        "bad-status.md",
        `---
id: 20250113143015
aliases: []
tags: []
target: draft
---

# Test

This note has a real summary paragraph now.
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "target must be one of current, v0.4, v0.5, v0.6, or backlog",
    );
  });

  test("accepts v0.5 as a planned note target", () => {
    const result = validateNoteDocuments([
      doc(
        "v0-5-note.md",
        `---
id: 20250113143015
aliases: []
tags: ["planning"]
target: v0.5
---

This note is planned for the v0.5 line and remains reviewable.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.target).toBe("v0.5");
  });

  test("accepts v0.6 as a planned note target", () => {
    const result = validateNoteDocuments([
      doc(
        "v0-6-note.md",
        `---
id: 20250113143016
aliases: []
tags: ["planning"]
target: v0.6
---

This note is planned for the v0.6 line and remains reviewable.
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.target).toBe("v0.6");
  });

  test("trims whitespace-only aliases", () => {
    const result = validateNoteDocuments([
      doc(
        "trim.md",
        `---
id: 20250113143015
aliases: ["valid", "   ", "other"]
tags: []
target: current
---

# Test

This note has a real summary paragraph.
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
target: current
---

# Extracted From Heading

Body text now contains enough routing words.
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
target: current
title: "From Frontmatter"
---

# This H1 is ignored

Body text now contains enough routing words.
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
target: current
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
target: current
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
target: current
---

# Note

This note is valid and should still trigger duplicate ID detection.
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
target: current
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

  test("requires a non-empty summary paragraph", () => {
    const result = validateNoteDocuments([
      doc(
        "missing-summary.md",
        `---
id: 20260413123031
aliases: []
tags: []
target: current
---

## Links

- [[Other Note]]
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "Missing required summary paragraph",
    );
    expect(result.errors[0]?.error).toContain("Why this protects you:");
  });

  test("rejects summary paragraphs that are too short to route from", () => {
    const result = validateNoteDocuments([
      doc(
        "short-summary.md",
        `---
id: 20260413123034
aliases: []
tags: []
target: current
---

Too short.

## Links

- [[Other Note]]
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain("Summary paragraph is too short");
  });

  test("rejects untouched template boilerplate", () => {
    const result = validateNoteDocuments([
      doc(
        "template-body.md",
        `---
id: 20260413123035
aliases: []
tags: []
target: current
---

This note explains a real repository concern with enough words to pass routing.

## What

State the durable fact, mechanism, decision, or failure mode.

## Why

Explain the invariant, constraint, or tradeoff this note protects.

## How

Describe how an operator, reviewer, or later agent should apply it.
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "Untouched template guidance detected",
    );
  });

  test("records cognition signals for valid notes", () => {
    const result = validateNoteDocuments([
      doc(
        "cognition.md",
        `---
id: 20260413123036
aliases: []
tags: []
target: current
---

This note preserves durable guidance for the manifest trust path in this repository.

## What

Track the trust contract for note-derived reasoning.

## Why

It helps later automation distinguish proof from memory.

## How

Carry the note metadata into manifests and review it in CI.

## Links

- [[Repository Cognition Layer]]
- [[System Trust Contract]]
`,
      ),
    ]);

    expect(result.valid).toBe(true);
    expect(result.notes[0]?.cognition.score).toBeGreaterThanOrEqual(60);
    expect(result.notes[0]?.cognition.stalenessLabel).toBe("fresh");
    expect(result.notes[0]?.cognition.trustLevel).toBe("conditional");
  });

  test("rejects notes that exceed the body character limit", () => {
    const result = validateNoteDocuments([
      doc(
        "oversized.md",
        `---
id: 20260413123032
aliases: []
tags: []
target: current
---

${Array.from(
  { length: NOTE_VALIDATION_LIMITS.maxBodyCharacters / 5 + 10 },
  () => "word",
).join(" ")}
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      `exceeds ${NOTE_VALIDATION_LIMITS.maxBodyCharacters} characters`,
    );
  });

  test("rejects notes that exceed the body line limit", () => {
    const oversizedBody = Array.from(
      { length: NOTE_VALIDATION_LIMITS.maxBodyLines + 1 },
      (_, index) => `Line ${index + 1}`,
    ).join("\n");
    const result = validateNoteDocuments([
      doc(
        "too-many-lines.md",
        `---
id: 20260413123033
aliases: []
tags: []
target: current
---

${oversizedBody}
`,
      ),
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      `exceeds ${NOTE_VALIDATION_LIMITS.maxBodyLines} lines`,
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
target: current
---

Plain body only now contains enough routing words.
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
target: current
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
