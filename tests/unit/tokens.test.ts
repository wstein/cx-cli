// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countTokens, countTokensForFiles } from "../../src/shared/tokens.js";

describe("shared token counting", () => {
  describe("countTokens", () => {
    it("counts tokens for cl100k_base encoding", () => {
      const text = "Hello world";
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for o200k_base encoding", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const result = countTokens(text, "o200k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for o200k_harmony encoding", () => {
      const text = "Sample text";
      const result = countTokens(text, "o200k_harmony");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for p50k_base encoding", () => {
      const text = "Another test";
      const result = countTokens(text, "p50k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for r50k_base encoding", () => {
      const text = "Test text";
      const result = countTokens(text, "r50k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for p50k_edit encoding", () => {
      const text = "Editing test";
      const result = countTokens(text, "p50k_edit");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("returns 0 for empty string", () => {
      const result = countTokens("", "cl100k_base");
      expect(result).toBe(0);
    });

    it("returns consistent count for same text", () => {
      const text = "Consistent test string";
      const result1 = countTokens(text, "cl100k_base");
      const result2 = countTokens(text, "cl100k_base");
      expect(result1).toBe(result2);
    });

    it("returns different counts for different text", () => {
      const result1 = countTokens("Short", "cl100k_base");
      const result2 = countTokens(
        "This is a much longer text with more words",
        "cl100k_base",
      );
      expect(result1).toBeLessThan(result2);
    });

    it("handles encoding name case-insensitively", () => {
      const text = "Test";
      const result = countTokens(text, "CL100K_BASE");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("throws on invalid encoding name", () => {
      const text = "Test";
      expect(() => countTokens(text, "invalid_encoding")).toThrow();
    });

    it("throws error with descriptive message on invalid encoding", () => {
      const text = "Test";
      try {
        countTokens(text, "fake_encoder");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(String(error)).toContain("Unknown tokenizer encoding");
      }
    });

    it("counts tokens for text with special characters", () => {
      const text = "Hello! @#$%^&*() World?";
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for text with newlines", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for text with tabs", () => {
      const text = "Column1\tColumn2\tColumn3";
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for text with Unicode characters", () => {
      const text = "Hello 世界 мир";
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for very long text", () => {
      const text = "word ".repeat(1000);
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(1000);
    });

    it("counts tokens for code-like text", () => {
      const code = 'function hello() {\n  console.log("world");\n}';
      const result = countTokens(code, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("counts tokens for JSON-like text", () => {
      const json = '{"name": "John", "age": 30, "city": "New York"}';
      const result = countTokens(json, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("returns consistent results across encodings", () => {
      const text = "Consistent test";
      const result1 = countTokens(text, "cl100k_base");
      const result2 = countTokens(text, "o200k_base");
      // Different encodings may have different token counts
      expect(result1).toBeGreaterThan(0);
      expect(result2).toBeGreaterThan(0);
    });

    it("handles text with multiple spaces", () => {
      const text = "Word1    Word2     Word3";
      const result = countTokens(text, "cl100k_base");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("throws for null encoding", () => {
      const text = "Test";
      expect(() => countTokens(text, null as unknown as string)).toThrow();
    });

    it("throws for undefined encoding", () => {
      const text = "Test";
      expect(() => countTokens(text, undefined as unknown as string)).toThrow();
    });

    it("counts tokens for files on disk", async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-tokens-"));
      try {
        const firstPath = path.join(root, "first.txt");
        const secondPath = path.join(root, "second.txt");
        await fs.writeFile(firstPath, "Hello world", "utf8");
        await fs.writeFile(secondPath, "Another file", "utf8");

        const counts = await countTokensForFiles(
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
});
