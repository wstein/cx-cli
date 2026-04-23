// test-lane: unit

import { describe, expect, test } from "vitest";
import { analyzeDocsExportMarkdown } from "../../src/docs/export.js";

describe("analyzeDocsExportMarkdown", () => {
  test("flags unresolved review-link destinations", () => {
    const markdown = [
      "[Manual](manual:operator-manual.html)",
      "[Repo](ROOT:page$repository/docs/governance.html#mcp-tool-stability)",
      "[Source](manual:operator-manual.adoc)",
      "[Raw](xref:manual:operator-manual.adoc#quick-operator-path)",
    ].join("\n");

    expect(analyzeDocsExportMarkdown(markdown)).toMatchObject({
      status: "flagged",
      diagnostics: [
        {
          destination: "manual:operator-manual.html",
          code: "module_qualified_html",
          severity: "error",
        },
        {
          destination:
            "ROOT:page$repository/docs/governance.html#mcp-tool-stability",
          code: "antora_family",
          severity: "error",
        },
        {
          destination: "manual:operator-manual.adoc",
          code: "adoc_link",
          severity: "error",
        },
        {
          destination: "xref:manual:operator-manual.adoc#quick-operator-path",
          code: "raw_xref",
          severity: "error",
        },
      ],
    });
  });

  test("ignores clean review-export destinations", () => {
    const markdown = [
      "[Manual](manual.mmd#operator-manual)",
      "[Architecture](architecture.mmd#system-map)",
      "[Governance](repository/docs/governance.html#mcp-tool-stability)",
    ].join("\n");

    expect(analyzeDocsExportMarkdown(markdown)).toEqual({
      status: "clean",
      diagnostics: [],
    });
  });
});
