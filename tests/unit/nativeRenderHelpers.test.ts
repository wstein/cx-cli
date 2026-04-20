// test-lane: unit

import { describe, expect, test } from "vitest";

import {
  buildDirectoryStructureText,
  buildJsonSummary,
  buildPlainBlockHeading,
  buildPlainSummaryText,
  chooseMarkdownFence,
  normalizedLogicalLineCount,
  PLAIN_LONG_SEPARATOR,
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

  test("renders the plain summary with the current adapter wording", () => {
    expect(buildPlainSummaryText()).toContain(
      "The content has been processed where security check has been disabled.",
    );
    expect(buildPlainBlockHeading("Files")).toBe(
      [PLAIN_LONG_SEPARATOR, "Files", PLAIN_LONG_SEPARATOR].join("\n"),
    );
  });

  test("renders the json summary with deterministic field text", () => {
    const summary = buildJsonSummary("cx section handover", [
      "src/index.ts",
      "src/util.ts",
    ]);

    expect(summary.fileSummary.notes).toContain(
      "Content has been formatted for parsing in json style",
    );
    expect(summary.directoryStructure).toBe("src/\n  index.ts\n  util.ts");
    expect(summary.userProvidedHeader).toBe("cx section handover");
  });
});
