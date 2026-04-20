// test-lane: unit

import { describe, expect, test } from "vitest";

import {
  buildDirectoryStructureText,
  chooseMarkdownFence,
  normalizedLogicalLineCount,
  renderMarkdownFileBlock,
} from "../../src/render/native/common.js";

describe("native render helpers", () => {
  test("renders directory structures in deterministic tree order", () => {
    expect(
      buildDirectoryStructureText([
        "src/zeta.ts",
        "docs/guide.md",
        "src/nested/alpha.ts",
        "README.md",
      ]),
    ).toBe(
      [
        "docs/",
        "  guide.md",
        "src/",
        "  nested/",
        "    alpha.ts",
        "  zeta.ts",
        "README.md",
      ].join("\n"),
    );
  });

  test("uses at least four backticks for markdown file fences", () => {
    expect(chooseMarkdownFence("export const alpha = 1;\n")).toBe("````");
    expect(chooseMarkdownFence("```ts\nconst x = 1;\n```\n")).toBe("````");
    expect(chooseMarkdownFence("````nested````\n")).toBe("`````");
  });

  test("counts logical lines the same way the span contract expects", () => {
    expect(normalizedLogicalLineCount("")).toBe(1);
    expect(normalizedLogicalLineCount("alpha")).toBe(1);
    expect(normalizedLogicalLineCount("alpha\nbeta")).toBe(2);
    expect(normalizedLogicalLineCount("alpha\n")).toBe(1);
  });

  test("renders markdown file blocks with language-aware fences", () => {
    expect(
      renderMarkdownFileBlock({
        path: "src/index.ts",
        content: "export const ok = 1;\n",
        sha256: "a".repeat(64),
        tokenCount: 4,
        language: "typescript",
      }),
    ).toBe(
      [
        "## File: src/index.ts",
        "````typescript",
        "export const ok = 1;\n",
        "````",
      ].join("\n"),
    );
  });
});
