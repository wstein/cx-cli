import { describe, expect, test } from "bun:test";

import type { CxManifest, ManifestFileRow } from "../../src/manifest/types.js";

import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../src/shared/manifestSummary.js";

describe("shared manifest summary utilities", () => {
  const manifest: CxManifest = {
    schemaVersion: 6,
    bundleVersion: 1,
    projectName: "demo",
    sourceRoot: "/tmp/demo",
    bundleDir: "/tmp/demo/dist",
    checksumFile: "demo.sha256",
    createdAt: "2025-01-01T00:00:00Z",
    cxVersion: "0.0.0",
    repomixVersion: "0.0.0",
    checksumAlgorithm: "sha256",
    settings: {
      globalStyle: "xml",
      tokenEncoding: "o200k_base",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: true,
      normalizationPolicy: "repomix-default-v1",
      includeLinkedNotes: false,
    },
    totalTokenCount: 0,
    vcsProvider: "none",
    dirtyState: "clean",
    modifiedFiles: [],
    sections: [
      {
        name: "src",
        files: [],
        style: "xml",
        outputFile: "src.xml",
        outputSha256: "hash",
      } as unknown as CxManifest["sections"][number] & {
        outputSizeBytes: number;
        outputTokenCount: number;
        outputStartLine: number;
        outputEndLine: number;
      },
      {
        name: "docs",
        files: [],
        style: "xml",
        outputFile: "docs.xml",
        outputSha256: "hash",
      } as unknown as CxManifest["sections"][number] & {
        outputSizeBytes: number;
        outputTokenCount: number;
        outputStartLine: number;
        outputEndLine: number;
      },
    ],
    assets: [
      {
        sourcePath: "images/logo.png",
        storedPath: "assets/logo.png",
        sha256: "hash",
        sizeBytes: 100,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "image/png",
      },
      {
        sourcePath: "assets/font.woff",
        storedPath: "assets/font.woff",
        sha256: "hash",
        sizeBytes: 200,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "font/woff",
      },
    ],
    files: [
      {
        path: "src/index.ts",
        section: "src",
        kind: "text",
        storedIn: "packed",
        sha256: "hash",
        sizeBytes: 100,
        tokenCount: 10,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "text/plain",
        outputStartLine: 1,
        outputEndLine: 10,
      },
      {
        path: "docs/guide.md",
        section: "docs",
        kind: "text",
        storedIn: "packed",
        sha256: "hash",
        sizeBytes: 200,
        tokenCount: 20,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "text/markdown",
        outputStartLine: 1,
        outputEndLine: 20,
      },
      {
        path: "images/logo.png",
        section: "-",
        kind: "asset",
        storedIn: "copied",
        sha256: "hash",
        sizeBytes: 100,
        tokenCount: 0,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "image/png",
        outputStartLine: null,
        outputEndLine: null,
      },
    ],
  };

  test("summarizeManifest returns counts for selected rows", () => {
    const summary = summarizeManifest("demo-manifest.json", manifest);
    expect(summary.manifestName).toBe("demo-manifest.json");
    expect(summary.projectName).toBe("demo");
    expect(summary.sectionCount).toBe(2);
    expect(summary.assetCount).toBe(1);
    expect(summary.fileCount).toBe(3);
    expect(summary.textFileCount).toBe(2);
    expect(summary.assetFileCount).toBe(1);
  });

  test("selectManifestSections filters only selected sections", () => {
    const rows: ManifestFileRow[] = [
      {
        path: "src/index.ts",
        section: "src",
        kind: "text",
        storedIn: "packed",
        sha256: "hash",
        sizeBytes: 100,
        tokenCount: 10,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "text/plain",
        outputStartLine: 1,
        outputEndLine: 10,
      },
      {
        path: "docs/guide.md",
        section: "docs",
        kind: "text",
        storedIn: "packed",
        sha256: "hash",
        sizeBytes: 100,
        tokenCount: 10,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "text/markdown",
        outputStartLine: 1,
        outputEndLine: 10,
      },
    ];
    const sections = selectManifestSections(manifest, rows);
    expect(sections.map((section) => section.name)).toEqual(["src", "docs"]);
  });

  test("selectManifestAssets returns only referenced assets", () => {
    const rows: ManifestFileRow[] = [
      {
        path: "images/logo.png",
        section: "-",
        kind: "asset",
        storedIn: "copied",
        sha256: "hash",
        sizeBytes: 100,
        tokenCount: 0,
        mtime: "2025-01-01T00:00:00Z",
        mediaType: "image/png",
        outputStartLine: null,
        outputEndLine: null,
      },
    ];
    const assets = selectManifestAssets(manifest, rows);
    expect(assets[0]?.sourcePath).toBe("images/logo.png");
  });
});
