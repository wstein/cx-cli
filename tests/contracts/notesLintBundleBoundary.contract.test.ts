// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("notes lint bundle boundary", () => {
  test("bundle command does not import notes lint", async () => {
    const bundleSource = await fs.readFile(
      path.join(process.cwd(), "src/cli/commands/bundle.ts"),
      "utf8",
    );
    expect(bundleSource).not.toContain("notes/lint");
    expect(bundleSource).not.toContain("lintNotes");
    expect(bundleSource).not.toContain("applyLintFixes");
  });
});
