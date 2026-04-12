import { describe, expect, test } from "bun:test";

import { countTokens } from "../../src/shared/tokens.js";

const ENCODINGS = [
  "r50k_base",
  "p50k_base",
  "p50k_edit",
  "cl100k_base",
  "o200k_base",
  "o200k_harmony",
] as const;

const CORPUS = [
  "# Token corpus",
  "",
  "The quick brown fox jumps over the lazy dog.",
  "const emoji = '😀';",
  "export function greet(name: string): string {",
  "  return `hello, " + "$" + "{name}" + "`;",
  "}",
].join("\n");

describe("countTokens", () => {
  for (const encoding of ENCODINGS) {
    test(`supports ${encoding}`, () => {
      const firstCount = countTokens(CORPUS, encoding);
      const secondCount = countTokens(CORPUS, encoding);

      expect(firstCount).toBeGreaterThan(0);
      expect(secondCount).toBe(firstCount);
    });
  }
});
