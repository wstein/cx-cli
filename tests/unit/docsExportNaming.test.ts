// test-lane: unit

import { describe, expect, test } from "vitest";
import { resolveDocsExportExtension } from "../../src/docs/export.js";

describe("docs export naming", () => {
  test("uses .mmd for multimarkdown exports", () => {
    expect(resolveDocsExportExtension("multimarkdown")).toBe(".mmd");
  });

  test("uses .md for other markdown flavors", () => {
    expect(resolveDocsExportExtension("commonmark")).toBe(".md");
    expect(resolveDocsExportExtension("gfm")).toBe(".md");
    expect(resolveDocsExportExtension("gitlab")).toBe(".md");
    expect(resolveDocsExportExtension("strict")).toBe(".md");
  });
});
