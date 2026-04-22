// test-lane: unit

import { describe, expect, test } from "vitest";
import { detectDocsExportLeaks } from "../../src/docs/export.js";

describe("detectDocsExportLeaks", () => {
  test("flags source-flavored markdown link destinations", () => {
    const markdown = [
      "[Manual](manual:operator-manual.html)",
      "[Repo](ROOT:page$repository/docs/governance.html#mcp-tool-stability)",
      "[Source](manual:operator-manual.adoc)",
      "[Raw](xref:manual:operator-manual.adoc#quick-operator-path)",
    ].join("\n");

    expect(detectDocsExportLeaks(markdown)).toEqual([
      {
        destination: "manual:operator-manual.html",
        reason: "module_qualified_html",
      },
      {
        destination:
          "ROOT:page$repository/docs/governance.html#mcp-tool-stability",
        reason: "antora_family",
      },
      {
        destination: "manual:operator-manual.adoc",
        reason: "adoc_link",
      },
      {
        destination: "xref:manual:operator-manual.adoc#quick-operator-path",
        reason: "raw_xref",
      },
    ]);
  });

  test("ignores clean review-export destinations", () => {
    const markdown = [
      "[Manual](manual.mmd#operator-manual)",
      "[Architecture](architecture.mmd#system-map)",
      "[Governance](repository/docs/governance.html#mcp-tool-stability)",
    ].join("\n");

    expect(detectDocsExportLeaks(markdown)).toEqual([]);
  });
});
