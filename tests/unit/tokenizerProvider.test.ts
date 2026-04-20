// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { defaultTokenizerProvider } from "../../src/shared/tokenizer.js";
import { countTokens } from "../../src/shared/tokens.js";

describe("defaultTokenizerProvider", () => {
  test("counts tokens through the provider interface", () => {
    const text = "Tokenizer providers stabilize the counting seam.";

    expect(defaultTokenizerProvider.countTokens(text, "o200k_base")).toBe(
      countTokens(text, "o200k_base"),
    );
  });

  test("counts tokens for files through the provider interface", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-tokenizer-"));

    try {
      const firstPath = path.join(root, "first.txt");
      const secondPath = path.join(root, "second.txt");
      await fs.writeFile(firstPath, "first", "utf8");
      await fs.writeFile(secondPath, "second file", "utf8");

      const counts = await defaultTokenizerProvider.countTokensForFiles(
        [firstPath, secondPath],
        "cl100k_base",
      );

      expect(counts.get(firstPath)).toBeGreaterThan(0);
      expect(counts.get(secondPath)).toBeGreaterThan(0);
      expect(counts.size).toBe(2);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
