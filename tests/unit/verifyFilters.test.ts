import { describe, expect, test } from "bun:test";

import { selectManifestRows } from "../../src/shared/verifyFilters.js";

describe("shared verify filter utilities", () => {
  const rows = [
    { path: "src/index.ts", section: "src", kind: "text" },
    { path: "src/util.ts", section: "src", kind: "text" },
    { path: "docs/guide.md", section: "docs", kind: "text" },
    { path: "images/logo.png", section: "-", kind: "asset" },
  ];

  test("selectManifestRows filters by section", () => {
    const filtered = selectManifestRows(rows as any, {
      sections: ["src"],
      files: undefined,
    });
    expect(filtered.map((row) => row.path)).toEqual([
      "src/index.ts",
      "src/util.ts",
      "images/logo.png",
    ]);
  });

  test("selectManifestRows filters by file names", () => {
    const filtered = selectManifestRows(rows as any, {
      sections: undefined,
      files: ["docs/guide.md", "images/logo.png"],
    });
    expect(filtered.map((row) => row.path)).toEqual([
      "docs/guide.md",
      "images/logo.png",
    ]);
  });

  test("selectManifestRows applies both section and file filters", () => {
    const filtered = selectManifestRows(rows as any, {
      sections: ["src"],
      files: ["src/index.ts", "docs/guide.md"],
    });
    expect(filtered.map((row) => row.path)).toEqual(["src/index.ts"]);
  });
});