// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { collectNoteContradictions } from "../../src/notes/contradictions.js";
import { validateNotes } from "../../src/notes/validate.js";

describe("note contradictions", () => {
  it("detects conflicts between note claims and repository state", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "notes-contradict-"),
    );
    const notesDir = path.join(tempDir, "notes");
    const srcDir = path.join(tempDir, "src");
    await fs.mkdir(notesDir, { recursive: true });
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(
      path.join(srcDir, "present.ts"),
      "export const ok = true;\n",
    );

    await fs.writeFile(
      path.join(notesDir, "present-claim.md"),
      `---
id: 20260418150000
title: Present Claim
status: current
---

This note tracks a code path claim with enough routing words today.

The file [[src/missing.ts]] is present and required before release.
`,
      "utf8",
    );
    await fs.writeFile(
      path.join(notesDir, "missing-claim.md"),
      `---
id: 20260418150001
title: Missing Claim
status: current
---

This note tracks the opposite code path claim with enough routing words today.

The file [[src/present.ts]] is missing from the repository right now.
`,
      "utf8",
    );

    try {
      const validation = await validateNotes("notes", tempDir);
      const issues = await collectNoteContradictions(
        validation.notes,
        tempDir,
        [
          {
            fromNoteId: "20260418150000",
            fromTitle: "Present Claim",
            reference: "src/missing.ts",
            path: "src/missing.ts",
            status: "missing",
          },
        ],
      );

      expect(issues).toHaveLength(2);
      expect(issues.map((issue) => issue.kind)).toEqual([
        "code_state_conflict",
        "code_state_conflict",
      ]);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("detects sibling notes that disagree about the same code path", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "notes-contradict-"),
    );
    const notesDir = path.join(tempDir, "notes");
    await fs.mkdir(notesDir, { recursive: true });

    await fs.writeFile(
      path.join(notesDir, "positive.md"),
      `---
id: 20260418150010
title: Positive Claim
status: current
---

This note claims a file state with enough routing words today.

The file [[src/shared.ts]] is present and active in the repository.
`,
      "utf8",
    );
    await fs.writeFile(
      path.join(notesDir, "negative.md"),
      `---
id: 20260418150011
title: Negative Claim
status: current
---

This note claims the opposite state with enough routing words today.

The file [[src/shared.ts]] is missing and no longer exists.
`,
      "utf8",
    );

    try {
      const validation = await validateNotes("notes", tempDir);
      const issues = await collectNoteContradictions(
        validation.notes,
        tempDir,
        [],
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]?.kind).toBe("sibling_claim_conflict");
      expect(issues[0]?.conflictingNoteId).toBe("20260418150011");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
