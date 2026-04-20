// test-lane: contract

import { describe, expect, test } from "vitest";

import {
  buildDirectoryStructureText,
  buildJsonSummary,
  buildPlainBlockHeading,
  buildPlainSummaryText,
  PLAIN_LONG_SEPARATOR,
  PLAIN_SHORT_SEPARATOR,
} from "../../src/render/native/common.js";
import { renderNativeJsonSection } from "../../src/render/native/json.js";
import { renderNativePlainSection } from "../../src/render/native/plain.js";
import type { StructuredRenderPlan } from "../../src/render/types.js";

function buildPlan(
  entries: StructuredRenderPlan["entries"],
): StructuredRenderPlan {
  return {
    entries,
    ordering: entries.map((entry) => entry.path),
  };
}

describe("native render contract", () => {
  test("plain renderer preserves the current separator and tail-padding contract", () => {
    const plan = buildPlan([
      {
        path: "docs/guide.md",
        content: "alpha\nbeta\n",
        sha256: "a".repeat(64),
        tokenCount: 2,
      },
      {
        path: "src/index.ts",
        content: "export const answer = 42;",
        sha256: "b".repeat(64),
        tokenCount: 6,
        language: "typescript",
      },
    ]);

    const rendered = renderNativePlainSection({
      plan,
      headerText:
        "cx section handover\nshared handover: demo-handover.plain.txt",
    });

    expect(rendered.outputText).toBe(
      [
        buildPlainSummaryText(),
        buildPlainBlockHeading("User Provided Header"),
        "cx section handover",
        "shared handover: demo-handover.plain.txt",
        "",
        buildPlainBlockHeading("Directory Structure"),
        buildDirectoryStructureText(plan.ordering),
        "",
        buildPlainBlockHeading("Files"),
        "",
        PLAIN_SHORT_SEPARATOR,
        "File: docs/guide.md",
        PLAIN_SHORT_SEPARATOR,
        "alpha",
        "beta",
        "",
        "",
        PLAIN_SHORT_SEPARATOR,
        "File: src/index.ts",
        PLAIN_SHORT_SEPARATOR,
        "export const answer = 42;",
        "",
        "",
        "",
        "",
        "",
        PLAIN_LONG_SEPARATOR,
        "End of Codebase",
        PLAIN_LONG_SEPARATOR,
        "",
      ].join("\n"),
    );

    expect(rendered.fileSpans.get("docs/guide.md")).toEqual({
      outputStartLine: 67,
      outputEndLine: 68,
    });
    expect(rendered.fileSpans.get("src/index.ts")).toEqual({
      outputStartLine: 74,
      outputEndLine: 74,
    });
  });

  test("json renderer preserves the current summary shape and newline contract", () => {
    const plan = buildPlan([
      {
        path: "docs/guide.md",
        content: "alpha\nbeta",
        sha256: "a".repeat(64),
        tokenCount: 2,
      },
      {
        path: "src/index.ts",
        content: "export const answer = 42;\n",
        sha256: "b".repeat(64),
        tokenCount: 6,
        language: "typescript",
      },
    ]);

    const rendered = renderNativeJsonSection({
      plan,
      headerText: "cx section handover",
    });

    expect(rendered.outputText).toBe(
      JSON.stringify(
        {
          ...buildJsonSummary("cx section handover", plan.ordering),
          files: {
            "docs/guide.md": "alpha\nbeta",
            "src/index.ts": "export const answer = 42;\n",
          },
        },
        null,
        2,
      ),
    );
    expect(rendered.outputText.endsWith("\n")).toBe(false);
    expect(rendered.fileSpans.size).toBe(0);
  });
});
