import { describe, expect, test } from "bun:test";

import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../src/shared/manifestSummary.js";

describe("shared manifest summary utilities", () => {
  const manifest = {
    projectName: "demo",
    sections: [{ name: "src" }, { name: "docs" }],
    assets: [{ sourcePath: "images/logo.png" }, { sourcePath: "assets/font.woff" }],
    files: [
      { path: "src/index.ts", section: "src", kind: "text" },
      { path: "docs/guide.md", section: "docs", kind: "text" },
      { path: "images/logo.png", section: "-", kind: "asset" },
    ],
  };

  test("summarizeManifest returns counts for selected rows", () => {
    const summary = summarizeManifest("demo-manifest.json", manifest as any);
    expect(summary.manifestName).toBe("demo-manifest.json");
    expect(summary.projectName).toBe("demo");
    expect(summary.sectionCount).toBe(2);
    expect(summary.assetCount).toBe(1);
    expect(summary.fileCount).toBe(3);
    expect(summary.textFileCount).toBe(2);
    expect(summary.assetFileCount).toBe(1);
  });

  test("selectManifestSections filters only selected sections", () => {
    const rows = [
      { path: "src/index.ts", section: "src", kind: "text" },
      { path: "docs/guide.md", section: "docs", kind: "text" },
    ];
    const sections = selectManifestSections(manifest as any, rows as any);
    expect(sections.map((section) => section.name)).toEqual(["src", "docs"]);
  });

  test("selectManifestAssets returns only referenced assets", () => {
    const rows = [
      { path: "images/logo.png", section: "-", kind: "asset" },
    ];
    const assets = selectManifestAssets(manifest as any, rows as any);
    expect(assets).toEqual([{ sourcePath: "images/logo.png" }]);
  });
});