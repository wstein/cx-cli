// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CxConfig } from "../../src/config/types.js";
import { buildManifest } from "../../src/manifest/build.js";
import type { BundlePlan } from "../../src/planning/types.js";
import { sha256NormalizedText } from "../../src/shared/hashing.js";

function createConfig(): CxConfig {
  return {
    projectName: "demo",
    sourceRoot: ".",
    outputDir: "dist/demo-bundle",
    repomix: {
      style: "xml",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: false,
    },
    tokens: {
      encoding: "cl100k_base",
    },
    manifest: {
      format: "json",
      pretty: false,
      includeFileSha256: true,
      includeOutputSha256: true,
      includeOutputSpans: false,
      includeSourceMetadata: false,
    },
    files: {
      include: [],
      exclude: [],
      followSymlinks: false,
      unmatched: "ignore",
    },
    dedup: {
      mode: "fail",
      order: "config",
    },
    behaviorSources: {
      dedupMode: "cx.toml",
      repomixMissingExtension: "cx.toml",
      configDuplicateEntry: "cx.toml",
      assetsLayout: "cx.toml",
    },
    assets: {
      include: [],
      exclude: [],
      target_dir: "assets",
      layout: "flat",
    },
    config: {
      duplicate_entry: "warn",
    },
    manifestSettings: {
      includeLinkedNotes: false,
    },
  } as unknown as CxConfig;
}

describe("manifest build", () => {
  test("falls back to normalized source content hashing when structured hash is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-manifest-build-"));
    try {
      const filePath = path.join(root, "foo.txt");
      const content = "hello\n";
      await fs.writeFile(filePath, content, "utf8");

      const config = createConfig();
      const plan: BundlePlan = {
        projectName: "demo",
        sourceRoot: root,
        bundleDir: path.join(root, "dist"),
        checksumFile: "demo.sha256",
        sections: [
          {
            name: "src",
            style: "xml",
            outputFile: "src.xml",
            files: [
              {
                relativePath: "foo.txt",
                absolutePath: filePath,
                kind: "text",
                mediaType: "text/plain",
                sizeBytes: content.length,
                sha256: "",
                mtime: new Date().toISOString(),
                provenance: ["section_match"],
              },
            ],
          },
        ],
        assets: [],
        unmatchedFiles: [],
        warnings: [],
        vcsKind: "none",
        dirtyState: "clean",
        modifiedFiles: [],
      };

      const sectionOutputs = [
        {
          name: "src",
          style: "xml" as const,
          outputFile: "src.xml",
          outputSha256: "deadbeef",
          fileCount: 1,
          sizeBytes: content.length,
          tokenCount: 0,
          outputTokenCount: 0,
        },
      ];

      const manifest = await buildManifest({
        config,
        plan,
        sectionOutputs,
        bundleIndexFile: "demo-bundle-index.txt",
        cxVersion: "0.1.0",
        repomixVersion: "0.1.0",
        sectionSpanMaps: new Map(),
        sectionTokenMaps: new Map(),
        sectionHashMaps: new Map().set("src", new Map()),
        dirtyState: "clean",
        modifiedFiles: [],
      });

      expect(manifest.sections[0]?.files[0]?.sha256).toBe(
        sha256NormalizedText(content),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
