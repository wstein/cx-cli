// test-lane: contract

import { describe, expect, test } from "vitest";

import { buildSectionHandoverText } from "../../src/render/sectionHandover.js";

describe("section handover contract", () => {
  test("uses sparse semantic anchors instead of a dense machine document", () => {
    const rendered = buildSectionHandoverText({
      projectName: "demo",
      sectionName: "docs",
      outputFile: "demo-docs.xml.txt",
      fileCount: 2,
      style: "xml",
      handoverFile: "demo-handover.xml.txt",
    });

    expect(rendered).toContain("cx section handover");
    expect(rendered).toContain("<section_identity>");
    expect(rendered).toContain("</section_identity>");
    expect(rendered).toContain("<usage>");
    expect(rendered).toContain("</usage>");
    expect(rendered).toContain("<path_semantics>");
    expect(rendered).toContain("</path_semantics>");
    expect(rendered).toContain("<authoritative_semantics>");
    expect(rendered).toContain("</authoritative_semantics>");
    expect(rendered).toContain("<shared_context>");
    expect(rendered).toContain("</shared_context>");
    expect(rendered).not.toContain("<?xml");
  });
});
